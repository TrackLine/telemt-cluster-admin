package models

import "time"

type NodeStatus string

const (
	StatusOK      NodeStatus = "ok"
	StatusWarn    NodeStatus = "warn"
	StatusDown    NodeStatus = "down"
	StatusUnknown NodeStatus = "unknown"
)

type BackendNode struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Hostname    string     `json:"hostname"`
	Region      string     `json:"region"`
	APIPort     int        `json:"api_port"`
	Enabled     bool       `json:"enabled"`
	Status      NodeStatus `json:"status"`
	LastPolled  *time.Time `json:"last_polled_at"`
	CreatedAt   time.Time  `json:"created_at"`

	// Cached metrics
	LiveConnections int     `json:"live_connections"`
	CoveragePct     float64 `json:"coverage_pct"`
	AliveWriters    int     `json:"alive_writers"`
	Draining        bool    `json:"draining"`
	BytesIn         int64   `json:"bytes_in"`
	BytesOut        int64   `json:"bytes_out"`
}

type EntryNode struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Hostname    string     `json:"hostname"`
	Region      string     `json:"region"`
	StatsPort   int        `json:"stats_port"`
	Enabled     bool       `json:"enabled"`
	Status      NodeStatus `json:"status"`
	LastPolled  *time.Time `json:"last_polled_at"`
	CreatedAt   time.Time  `json:"created_at"`

	// Cached metrics
	CurrentSessions  int    `json:"current_sessions"`
	TotalConnections int64  `json:"total_connections"`
	BytesIn          int64  `json:"bytes_in"`
	BytesOut         int64  `json:"bytes_out"`
	BackendsUp       int    `json:"backends_up"`
	BackendsDown     int    `json:"backends_down"`
}

type MetricSample struct {
	ID         int64     `json:"-"`
	NodeID     string    `json:"node_id"`
	NodeType   string    `json:"node_type"`
	MetricName string    `json:"metric_name"`
	Value      float64   `json:"value"`
	SampledAt  time.Time `json:"sampled_at"`
}

type ClusterSummary struct {
	TotalLiveConnections int     `json:"total_live_connections"`
	NodesOnline          int     `json:"nodes_online"`
	NodesTotal           int     `json:"nodes_total"`
	AvgCoveragePct       float64 `json:"avg_coverage_pct"`
	TotalBytesIn         int64   `json:"total_bytes_in"`
	TotalBytesOut        int64   `json:"total_bytes_out"`
}

type TopologyNode struct {
	ID     string     `json:"id"`
	Name   string     `json:"name"`
	Type   string     `json:"type"` // "entry" or "backend"
	Region string     `json:"region"`
	Status NodeStatus `json:"status"`
	Load   int        `json:"load"` // connections for backends, sessions for entries
}

type TopologyEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type Topology struct {
	Nodes []TopologyNode `json:"nodes"`
	Edges []TopologyEdge `json:"edges"`
}
