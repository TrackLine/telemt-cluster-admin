package poller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

var httpClient = &http.Client{Timeout: 5 * time.Second}

// telemt REST API wraps every response in this envelope.
type apiEnvelope[T any] struct {
	OK  bool `json:"ok"`
	Data T   `json:"data"`
	Err any  `json:"error"`
}

// /v1/stats/me-writers
type meWritersData struct {
	Summary struct {
		CoveragePct  float64 `json:"coverage_pct"`
		AliveWriters int     `json:"alive_writers"`
	} `json:"summary"`
	Writers []struct {
		State string `json:"state"`
	} `json:"writers"`
}

// /v1/users — array of UserInfo
type telemetUserInfo struct {
	Username           string   `json:"username"`
	CurrentConnections int      `json:"current_connections"`
	TotalOctets        int64    `json:"total_octets"`
	ActiveUniqueIPs    []string `json:"active_unique_ips_list"`
}

// /v1/stats/summary
type summaryData struct {
	DirectConnections int   `json:"direct_connections"`
	MEConnections     int   `json:"me_connections"`
	HandshakeTimeouts int   `json:"handshake_timeouts"`
	UptimeSeconds     int64 `json:"uptime_seconds"`
	AcceptingConns    bool  `json:"accepting_new_connections"`
}

// /v1/health
type healthData struct {
	Status   string `json:"status"`
	ReadOnly bool   `json:"read_only"`
}

// /v1/stats/zero/all — only the upstream latency bucket part
type zeroAllData struct {
	Upstream struct {
		LatencyLte100ms  int64 `json:"latency_lte_100ms"`
		Latency101500ms  int64 `json:"latency_101_500ms"`
		Latency5011000ms int64 `json:"latency_501_1000ms"`
		LatencyGt1000ms  int64 `json:"latency_gt_1000ms"`
	} `json:"upstream"`
}

// Canonical types used by the scheduler.
type telemetMeWriters struct {
	CoveragePct  float64
	AliveWriters int
	Draining     bool
}

type telemetEdge struct {
	LiveConnections int
	TotalBytes      int64
	ClientIPs       []string
}

type telemetExtra struct {
	DirectConnections int
	MEConnections     int
	HandshakeTimeouts int
	UptimeSeconds     int64
	AcceptingConns    bool
	ReadOnly          bool
	LatLte100ms       int64
	Lat101500ms       int64
	Lat5011000ms      int64
	LatGt1000ms       int64
}

// FetchTelemetStats fetches live stats from a telemt node's REST API.
func FetchTelemetStats(hostname string, port int) (*telemetMeWriters, *telemetEdge, error) {
	base := fmt.Sprintf("http://%s:%d", hostname, port)

	// 1. /v1/stats/me-writers — coverage & writer health
	mwEnv, err := fetchEnvelope[meWritersData](base + "/v1/stats/me-writers")
	if err != nil {
		return nil, nil, fmt.Errorf("me-writers: %w", err)
	}

	draining := false
	for _, w := range mwEnv.Writers {
		if w.State == "draining" {
			draining = true
			break
		}
	}

	mw := &telemetMeWriters{
		CoveragePct:  mwEnv.Summary.CoveragePct,
		AliveWriters: mwEnv.Summary.AliveWriters,
		Draining:     draining,
	}

	// 2. /v1/users — live connections, bytes, client IPs, top users
	usersEnv, err := fetchEnvelope[[]telemetUserInfo](base + "/v1/users")
	if err != nil {
		return nil, nil, fmt.Errorf("users: %w", err)
	}

	edge := &telemetEdge{}
	seenIPs := map[string]struct{}{}
	for _, u := range usersEnv {
		edge.LiveConnections += u.CurrentConnections
		edge.TotalBytes += u.TotalOctets
		for _, ip := range u.ActiveUniqueIPs {
			if _, ok := seenIPs[ip]; !ok {
				seenIPs[ip] = struct{}{}
				edge.ClientIPs = append(edge.ClientIPs, ip)
			}
		}
	}

	return mw, edge, nil
}

// FetchTelemetExtra fetches additional stats: summary, health, zero counters.
// Errors are non-fatal — returns zero-value struct fields for missing data.
func FetchTelemetExtra(hostname string, port int) *telemetExtra {
	base := fmt.Sprintf("http://%s:%d", hostname, port)
	extra := &telemetExtra{AcceptingConns: true} // default to accepting

	// /v1/stats/summary
	sum, err := fetchEnvelope[summaryData](base + "/v1/stats/summary")
	if err == nil {
		extra.DirectConnections = sum.DirectConnections
		extra.MEConnections = sum.MEConnections
		extra.HandshakeTimeouts = sum.HandshakeTimeouts
		extra.UptimeSeconds = sum.UptimeSeconds
		extra.AcceptingConns = sum.AcceptingConns
	}

	// /v1/health
	health, err := fetchEnvelope[healthData](base + "/v1/health")
	if err == nil {
		extra.ReadOnly = health.ReadOnly
	}

	// /v1/stats/zero/all — latency buckets
	zero, err := fetchEnvelope[zeroAllData](base + "/v1/stats/zero/all")
	if err == nil {
		extra.LatLte100ms = zero.Upstream.LatencyLte100ms
		extra.Lat101500ms = zero.Upstream.Latency101500ms
		extra.Lat5011000ms = zero.Upstream.Latency5011000ms
		extra.LatGt1000ms = zero.Upstream.LatencyGt1000ms
	}

	return extra
}

// fetchEnvelope GETs a URL and decodes the telemt API envelope.
func fetchEnvelope[T any](url string) (T, error) {
	var zero T
	resp, err := httpClient.Get(url)
	if err != nil {
		return zero, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return zero, fmt.Errorf("status %d", resp.StatusCode)
	}

	var env apiEnvelope[T]
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		return zero, fmt.Errorf("decode: %w", err)
	}
	if !env.OK {
		return zero, fmt.Errorf("api error: %v", env.Err)
	}
	return env.Data, nil
}

// TelemetConnection is kept for compatibility.
type TelemetConnection struct {
	RemoteAddr string
}
