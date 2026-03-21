package poller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type telemetMeWriters struct {
	CoveragePct  float64 `json:"coverage_pct"`
	AliveWriters int     `json:"alive_writers"`
	Draining     bool    `json:"draining"`
}

type telemetEdge struct {
	LiveConnections int   `json:"live_connections"`
	BytesIn         int64 `json:"bytes_in"`
	BytesOut        int64 `json:"bytes_out"`
}

var httpClient = &http.Client{Timeout: 5 * time.Second}

// FetchTelemetStats fetches live stats from a telemt node's REST API.
func FetchTelemetStats(hostname string, port int) (*telemetMeWriters, *telemetEdge, error) {
	base := fmt.Sprintf("http://%s:%d", hostname, port)

	mw, err := fetchJSON[telemetMeWriters](base + "/v1/stats/me-writers")
	if err != nil {
		return nil, nil, fmt.Errorf("me-writers: %w", err)
	}

	edge, err := fetchJSON[telemetEdge](base + "/v1/runtime/edge")
	if err != nil {
		return nil, nil, fmt.Errorf("runtime/edge: %w", err)
	}

	return mw, edge, nil
}

func fetchJSON[T any](url string) (*T, error) {
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	var v T
	if err := json.NewDecoder(resp.Body).Decode(&v); err != nil {
		return nil, err
	}
	return &v, nil
}

// TelemetConnection represents a single live connection from the telemt connections endpoint.
type TelemetConnection struct {
	RemoteAddr string `json:"remote_addr"`
	DC         int    `json:"dc"`
	BytesIn    int64  `json:"bytes_in"`
	BytesOut   int64  `json:"bytes_out"`
}

// TelemetConnectionsResp is the response from /v1/runtime/connections.
type TelemetConnectionsResp struct {
	Connections []TelemetConnection `json:"connections"`
}

// FetchTelemetConnections tries to get the live connections list from a telemt node.
// Returns nil, nil if the endpoint doesn't exist (404) — this is not an error.
func FetchTelemetConnections(hostname string, port int) ([]TelemetConnection, error) {
	url := fmt.Sprintf("http://%s:%d/v1/runtime/connections", hostname, port)
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		// endpoint not supported by this telemt version
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("connections: status %d", resp.StatusCode)
	}
	var r TelemetConnectionsResp
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, err
	}
	return r.Connections, nil
}
