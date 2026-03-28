package db

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/mshalenkov/telemt-cluster-admin/internal/models"
)

var DB *sql.DB

func Init(path string) error {
	var err error
	DB, err = sql.Open("sqlite3", path+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return fmt.Errorf("open sqlite: %w", err)
	}
	DB.SetMaxOpenConns(1)
	return migrate()
}

func migrate() error {
	_, err := DB.Exec(`
	CREATE TABLE IF NOT EXISTS backend_nodes (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		hostname TEXT NOT NULL,
		region TEXT NOT NULL DEFAULT '',
		api_port INTEGER NOT NULL DEFAULT 9091,
		enabled INTEGER NOT NULL DEFAULT 1,
		status TEXT NOT NULL DEFAULT 'unknown',
		last_polled_at DATETIME,
		created_at DATETIME NOT NULL,
		live_connections INTEGER NOT NULL DEFAULT 0,
		coverage_pct REAL NOT NULL DEFAULT 0,
		alive_writers INTEGER NOT NULL DEFAULT 0,
		draining INTEGER NOT NULL DEFAULT 0,
		bytes_in INTEGER NOT NULL DEFAULT 0,
		bytes_out INTEGER NOT NULL DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS entry_nodes (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		hostname TEXT NOT NULL,
		region TEXT NOT NULL DEFAULT '',
		stats_port INTEGER NOT NULL DEFAULT 8404,
		enabled INTEGER NOT NULL DEFAULT 1,
		status TEXT NOT NULL DEFAULT 'unknown',
		last_polled_at DATETIME,
		created_at DATETIME NOT NULL,
		current_sessions INTEGER NOT NULL DEFAULT 0,
		total_connections INTEGER NOT NULL DEFAULT 0,
		bytes_in INTEGER NOT NULL DEFAULT 0,
		bytes_out INTEGER NOT NULL DEFAULT 0,
		backends_up INTEGER NOT NULL DEFAULT 0,
		backends_down INTEGER NOT NULL DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS metric_samples (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		node_id TEXT NOT NULL,
		node_type TEXT NOT NULL,
		metric_name TEXT NOT NULL,
		value REAL NOT NULL,
		sampled_at DATETIME NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_metric_samples_node_time
		ON metric_samples (node_id, metric_name, sampled_at);

	CREATE TABLE IF NOT EXISTS geo_snapshots (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		country_code TEXT NOT NULL,
		country_name TEXT NOT NULL,
		city TEXT NOT NULL DEFAULT '',
		lat REAL NOT NULL DEFAULT 0,
		lng REAL NOT NULL DEFAULT 0,
		connections INTEGER NOT NULL DEFAULT 1,
		node_id TEXT NOT NULL DEFAULT '',
		sampled_at DATETIME NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_geo_sampled ON geo_snapshots (sampled_at);
	`)
	if err != nil {
		return err
	}

	// Incremental migrations — add new columns to existing tables.
	// SQLite does not support IF NOT EXISTS in ALTER TABLE, so we swallow
	// "duplicate column" errors which means the column already exists.
	for _, col := range []string{
		"direct_connections INTEGER NOT NULL DEFAULT 0",
		"me_connections INTEGER NOT NULL DEFAULT 0",
		"handshake_timeouts INTEGER NOT NULL DEFAULT 0",
		"uptime_seconds INTEGER NOT NULL DEFAULT 0",
		"accepting_conns INTEGER NOT NULL DEFAULT 1",
		"read_only INTEGER NOT NULL DEFAULT 0",
		"lat_lte_100ms INTEGER NOT NULL DEFAULT 0",
		"lat_101_500ms INTEGER NOT NULL DEFAULT 0",
		"lat_501_1000ms INTEGER NOT NULL DEFAULT 0",
		"lat_gt_1000ms INTEGER NOT NULL DEFAULT 0",
	} {
		addColumnIfMissing("backend_nodes", col)
	}

	return nil
}

func addColumnIfMissing(table, colDef string) {
	_, err := DB.Exec("ALTER TABLE " + table + " ADD COLUMN " + colDef)
	if err != nil && !strings.Contains(err.Error(), "duplicate column") {
		log.Printf("[db] migration warning (%s): %v", table, err)
	}
}

// GetBackendNodes returns all backend nodes.
func GetBackendNodes() ([]models.BackendNode, error) {
	rows, err := DB.Query(`SELECT id,name,hostname,region,api_port,enabled,status,last_polled_at,created_at,
		live_connections,coverage_pct,alive_writers,draining,bytes_in,bytes_out,
		direct_connections,me_connections,handshake_timeouts,uptime_seconds,
		accepting_conns,read_only,lat_lte_100ms,lat_101_500ms,lat_501_1000ms,lat_gt_1000ms
		FROM backend_nodes ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var nodes []models.BackendNode
	for rows.Next() {
		n, err := scanBackendNode(rows)
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, *n)
	}
	return nodes, nil
}

func GetBackendNode(id string) (*models.BackendNode, error) {
	rows, err := DB.Query(`SELECT id,name,hostname,region,api_port,enabled,status,last_polled_at,created_at,
		live_connections,coverage_pct,alive_writers,draining,bytes_in,bytes_out,
		direct_connections,me_connections,handshake_timeouts,uptime_seconds,
		accepting_conns,read_only,lat_lte_100ms,lat_101_500ms,lat_501_1000ms,lat_gt_1000ms
		FROM backend_nodes WHERE id=?`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, nil
	}
	return scanBackendNode(rows)
}

func scanBackendNode(rows *sql.Rows) (*models.BackendNode, error) {
	var n models.BackendNode
	var enabled, draining, acceptingConns, readOnly int
	var lastPolled sql.NullTime

	err := rows.Scan(
		&n.ID, &n.Name, &n.Hostname, &n.Region, &n.APIPort,
		&enabled, &n.Status, &lastPolled, &n.CreatedAt,
		&n.LiveConnections, &n.CoveragePct, &n.AliveWriters,
		&draining, &n.BytesIn, &n.BytesOut,
		&n.DirectConnections, &n.MEConnections, &n.HandshakeTimeouts, &n.UptimeSeconds,
		&acceptingConns, &readOnly,
		&n.LatLte100ms, &n.Lat101500ms, &n.Lat5011000ms, &n.LatGt1000ms,
	)
	if err != nil {
		return nil, err
	}

	n.Enabled = enabled == 1
	n.Draining = draining == 1
	n.AcceptingConns = acceptingConns == 1
	n.ReadOnly = readOnly == 1
	if lastPolled.Valid {
		n.LastPolled = &lastPolled.Time
	}
	return &n, nil
}

func InsertBackendNode(n *models.BackendNode) error {
	_, err := DB.Exec(`INSERT INTO backend_nodes (id,name,hostname,region,api_port,enabled,status,created_at)
		VALUES (?,?,?,?,?,?,?,?)`,
		n.ID, n.Name, n.Hostname, n.Region, n.APIPort, boolInt(n.Enabled), string(n.Status), n.CreatedAt)
	return err
}

func UpdateBackendNode(n *models.BackendNode) error {
	_, err := DB.Exec(`UPDATE backend_nodes SET
		name=?,hostname=?,region=?,api_port=?,enabled=?,status=?,last_polled_at=?,
		live_connections=?,coverage_pct=?,alive_writers=?,draining=?,bytes_in=?,bytes_out=?,
		direct_connections=?,me_connections=?,handshake_timeouts=?,uptime_seconds=?,
		accepting_conns=?,read_only=?,
		lat_lte_100ms=?,lat_101_500ms=?,lat_501_1000ms=?,lat_gt_1000ms=?
		WHERE id=?`,
		n.Name, n.Hostname, n.Region, n.APIPort, boolInt(n.Enabled), string(n.Status), n.LastPolled,
		n.LiveConnections, n.CoveragePct, n.AliveWriters, boolInt(n.Draining), n.BytesIn, n.BytesOut,
		n.DirectConnections, n.MEConnections, n.HandshakeTimeouts, n.UptimeSeconds,
		boolInt(n.AcceptingConns), boolInt(n.ReadOnly),
		n.LatLte100ms, n.Lat101500ms, n.Lat5011000ms, n.LatGt1000ms,
		n.ID)
	return err
}

func DeleteBackendNode(id string) error {
	_, err := DB.Exec(`DELETE FROM backend_nodes WHERE id=?`, id)
	return err
}

// GetEntryNodes returns all entry nodes.
func GetEntryNodes() ([]models.EntryNode, error) {
	rows, err := DB.Query(`SELECT id,name,hostname,region,stats_port,enabled,status,last_polled_at,created_at,
		current_sessions,total_connections,bytes_in,bytes_out,backends_up,backends_down FROM entry_nodes ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var nodes []models.EntryNode
	for rows.Next() {
		var n models.EntryNode
		var enabled int
		var lastPolled sql.NullTime
		err := rows.Scan(&n.ID, &n.Name, &n.Hostname, &n.Region, &n.StatsPort, &enabled, &n.Status,
			&lastPolled, &n.CreatedAt, &n.CurrentSessions, &n.TotalConnections,
			&n.BytesIn, &n.BytesOut, &n.BackendsUp, &n.BackendsDown)
		if err != nil {
			return nil, err
		}
		n.Enabled = enabled == 1
		if lastPolled.Valid {
			n.LastPolled = &lastPolled.Time
		}
		nodes = append(nodes, n)
	}
	return nodes, nil
}

func GetEntryNode(id string) (*models.EntryNode, error) {
	row := DB.QueryRow(`SELECT id,name,hostname,region,stats_port,enabled,status,last_polled_at,created_at,
		current_sessions,total_connections,bytes_in,bytes_out,backends_up,backends_down FROM entry_nodes WHERE id=?`, id)
	var n models.EntryNode
	var enabled int
	var lastPolled sql.NullTime
	err := row.Scan(&n.ID, &n.Name, &n.Hostname, &n.Region, &n.StatsPort, &enabled, &n.Status,
		&lastPolled, &n.CreatedAt, &n.CurrentSessions, &n.TotalConnections,
		&n.BytesIn, &n.BytesOut, &n.BackendsUp, &n.BackendsDown)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	n.Enabled = enabled == 1
	if lastPolled.Valid {
		n.LastPolled = &lastPolled.Time
	}
	return &n, nil
}

func InsertEntryNode(n *models.EntryNode) error {
	_, err := DB.Exec(`INSERT INTO entry_nodes (id,name,hostname,region,stats_port,enabled,status,created_at)
		VALUES (?,?,?,?,?,?,?,?)`,
		n.ID, n.Name, n.Hostname, n.Region, n.StatsPort, boolInt(n.Enabled), string(n.Status), n.CreatedAt)
	return err
}

func UpdateEntryNode(n *models.EntryNode) error {
	_, err := DB.Exec(`UPDATE entry_nodes SET name=?,hostname=?,region=?,stats_port=?,enabled=?,status=?,
		last_polled_at=?,current_sessions=?,total_connections=?,bytes_in=?,bytes_out=?,backends_up=?,backends_down=?
		WHERE id=?`,
		n.Name, n.Hostname, n.Region, n.StatsPort, boolInt(n.Enabled), string(n.Status),
		n.LastPolled, n.CurrentSessions, n.TotalConnections, n.BytesIn, n.BytesOut,
		n.BackendsUp, n.BackendsDown, n.ID)
	return err
}

func DeleteEntryNode(id string) error {
	_, err := DB.Exec(`DELETE FROM entry_nodes WHERE id=?`, id)
	return err
}

// InsertMetricSample stores one data point.
func InsertMetricSample(s models.MetricSample) error {
	_, err := DB.Exec(`INSERT INTO metric_samples (node_id,node_type,metric_name,value,sampled_at)
		VALUES (?,?,?,?,?)`, s.NodeID, s.NodeType, s.MetricName, s.Value, s.SampledAt)
	return err
}

// GetMetricHistory returns time-series for a node/metric over a duration (hours).
func GetMetricHistory(nodeID, metric string, hours int) ([]models.MetricSample, error) {
	since := time.Now().Add(-time.Duration(hours) * time.Hour)
	rows, err := DB.Query(`SELECT node_id,node_type,metric_name,value,sampled_at FROM metric_samples
		WHERE node_id=? AND metric_name=? AND sampled_at >= ? ORDER BY sampled_at`,
		nodeID, metric, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var samples []models.MetricSample
	for rows.Next() {
		var s models.MetricSample
		if err := rows.Scan(&s.NodeID, &s.NodeType, &s.MetricName, &s.Value, &s.SampledAt); err != nil {
			return nil, err
		}
		samples = append(samples, s)
	}
	return samples, nil
}

// PurgeOldSamples deletes samples older than 48 hours.
func PurgeOldSamples() {
	cutoff := time.Now().Add(-48 * time.Hour)
	res, err := DB.Exec(`DELETE FROM metric_samples WHERE sampled_at < ?`, cutoff)
	if err != nil {
		log.Printf("[db] purge error: %v", err)
		return
	}
	n, _ := res.RowsAffected()
	if n > 0 {
		log.Printf("[db] purged %d old metric samples", n)
	}
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
