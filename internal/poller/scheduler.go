package poller

import (
	"log"
	"time"

	"github.com/mshalenkov/telemt-cluster-admin/internal/db"
	"github.com/mshalenkov/telemt-cluster-admin/internal/geo"
	"github.com/mshalenkov/telemt-cluster-admin/internal/models"
)

// Start launches the background polling loop.
func Start(interval time.Duration) {
	go func() {
		// Initial poll immediately
		poll()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		cleanTicker := time.NewTicker(time.Hour)
		defer cleanTicker.Stop()

		for {
			select {
			case <-ticker.C:
				poll()
			case <-cleanTicker.C:
				db.PurgeOldSamples()
				db.PurgeOldGeoSnapshots()
			}
		}
	}()
}

func poll() {
	pollBackends()
	pollEntries()
}

func pollBackends() {
	nodes, err := db.GetBackendNodes()
	if err != nil {
		log.Printf("[poller] get backends: %v", err)
		return
	}
	now := time.Now()
	for _, n := range nodes {
		if !n.Enabled {
			continue
		}
		n := n // capture
		go func() {
			mw, edge, err := FetchTelemetStats(n.Hostname, n.APIPort)
			t := time.Now()
			n.LastPolled = &t

			if err != nil {
				log.Printf("[poller] backend %s (%s:%d): %v", n.Name, n.Hostname, n.APIPort, err)
				n.Status = models.StatusDown
			} else {
				n.CoveragePct = mw.CoveragePct
				n.AliveWriters = mw.AliveWriters
				n.Draining = mw.Draining
				n.LiveConnections = edge.LiveConnections
				n.BytesIn = edge.TotalBytes
				n.BytesOut = 0
				n.Status = coverageStatus(mw.CoveragePct, mw.Draining)

				// Extra stats — non-fatal
				extra := FetchTelemetExtra(n.Hostname, n.APIPort)
				n.DirectConnections = extra.DirectConnections
				n.MEConnections = extra.MEConnections
				n.HandshakeTimeouts = extra.HandshakeTimeouts
				n.UptimeSeconds = extra.UptimeSeconds
				n.AcceptingConns = extra.AcceptingConns
				n.ReadOnly = extra.ReadOnly
				n.LatLte100ms = extra.LatLte100ms
				n.Lat101500ms = extra.Lat101500ms
				n.Lat5011000ms = extra.Lat5011000ms
				n.LatGt1000ms = extra.LatGt1000ms

				// Record metric samples
				for _, s := range []models.MetricSample{
					{NodeID: n.ID, NodeType: "backend", MetricName: "live_connections", Value: float64(edge.LiveConnections), SampledAt: now},
					{NodeID: n.ID, NodeType: "backend", MetricName: "coverage_pct", Value: mw.CoveragePct, SampledAt: now},
					{NodeID: n.ID, NodeType: "backend", MetricName: "bytes_total", Value: float64(edge.TotalBytes), SampledAt: now},
				} {
					if err := db.InsertMetricSample(s); err != nil {
						log.Printf("[poller] insert sample: %v", err)
					}
				}

				// Collect client geo data from active user IPs
				if geo.Available() && len(edge.ClientIPs) > 0 {
					countryCounts := map[string]*db.GeoSnapshot{}
					for _, ip := range edge.ClientIPs {
						info := geo.Lookup(ip)
						if info == nil {
							continue
						}
						key := info.CountryCode + "|" + info.City
						if existing, ok := countryCounts[key]; ok {
							existing.Connections++
						} else {
							countryCounts[key] = &db.GeoSnapshot{
								CountryCode: info.CountryCode,
								CountryName: info.CountryName,
								City:        info.City,
								Lat:         info.Lat,
								Lng:         info.Lng,
								Connections: 1,
								NodeID:      n.ID,
								SampledAt:   time.Now(),
							}
						}
					}
					var snapshots []db.GeoSnapshot
					for _, s := range countryCounts {
						snapshots = append(snapshots, *s)
					}
					if len(snapshots) > 0 {
						db.InsertGeoSnapshots(snapshots)
					}
				}
			}

			if err := db.UpdateBackendNode(&n); err != nil {
				log.Printf("[poller] update backend %s: %v", n.ID, err)
			}
		}()
	}
}

func pollEntries() {
	nodes, err := db.GetEntryNodes()
	if err != nil {
		log.Printf("[poller] get entries: %v", err)
		return
	}
	now := time.Now()
	for _, n := range nodes {
		if !n.Enabled {
			continue
		}
		n := n
		go func() {
			stats, err := FetchHAProxyStats(n.Hostname, n.StatsPort)
			t := time.Now()
			n.LastPolled = &t

			if err != nil {
				log.Printf("[poller] entry %s (%s:%d): %v", n.Name, n.Hostname, n.StatsPort, err)
				n.Status = models.StatusDown
			} else {
				n.CurrentSessions = stats.CurrentSessions
				n.TotalConnections = stats.TotalConnections
				n.BytesIn = stats.BytesIn
				n.BytesOut = stats.BytesOut
				n.BackendsUp = stats.BackendsUp
				n.BackendsDown = stats.BackendsDown
				n.Status = entryStatus(stats)

				for _, s := range []models.MetricSample{
					{NodeID: n.ID, NodeType: "entry", MetricName: "current_sessions", Value: float64(stats.CurrentSessions), SampledAt: now},
					{NodeID: n.ID, NodeType: "entry", MetricName: "bytes_in", Value: float64(stats.BytesIn), SampledAt: now},
					{NodeID: n.ID, NodeType: "entry", MetricName: "bytes_out", Value: float64(stats.BytesOut), SampledAt: now},
				} {
					if err := db.InsertMetricSample(s); err != nil {
						log.Printf("[poller] insert sample: %v", err)
					}
				}
			}

			if err := db.UpdateEntryNode(&n); err != nil {
				log.Printf("[poller] update entry %s: %v", n.ID, err)
			}
		}()
	}
}

func coverageStatus(pct float64, draining bool) models.NodeStatus {
	if draining {
		return models.StatusWarn
	}
	switch {
	case pct >= 80:
		return models.StatusOK
	case pct >= 50:
		return models.StatusWarn
	default:
		return models.StatusDown
	}
}

func entryStatus(s *haproxyStats) models.NodeStatus {
	if s.BackendsUp == 0 {
		return models.StatusDown
	}
	if s.BackendsDown > 0 {
		return models.StatusWarn
	}
	return models.StatusOK
}
