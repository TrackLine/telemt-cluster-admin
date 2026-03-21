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
	OK   bool   `json:"ok"`
	Data T      `json:"data"`
	Err  any    `json:"error"` // string or object on failure
}

// /v1/stats/me-writers
type meWritersData struct {
	Summary struct {
		CoveragePct  float64 `json:"coverage_pct"`
		AliveWriters int     `json:"alive_writers"`
	} `json:"summary"`
	Writers []struct {
		State string `json:"state"` // "alive", "draining", "degraded", …
	} `json:"writers"`
}

// /v1/users — array of UserInfo
type telemetUserInfo struct {
	CurrentConnections int      `json:"current_connections"`
	TotalOctets        int64    `json:"total_octets"`
	ActiveUniqueIPs    []string `json:"active_unique_ips_list"`
}

// Canonical types used by the scheduler.
type telemetMeWriters struct {
	CoveragePct  float64
	AliveWriters int
	Draining     bool
}

type telemetEdge struct {
	LiveConnections int
	TotalBytes      int64    // total_octets summed across all users
	ClientIPs       []string // deduplicated active IPs for geo lookup
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

	// 2. /v1/users — live connections, bytes, client IPs
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

// fetchEnvelope GETs a URL and decodes the telemt API envelope,
// returning the inner Data field or an error.
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

// TelemetConnection is kept for compatibility but populated from /v1/users IPs now.
type TelemetConnection struct {
	RemoteAddr string
}
