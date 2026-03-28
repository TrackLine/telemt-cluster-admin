package poller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

type haproxyStats struct {
	CurrentSessions  int
	TotalConnections int64
	BytesIn          int64
	BytesOut         int64
	BackendsUp       int
	BackendsDown     int
}

// haproxyStatItem matches one field entry in HAProxy's JSON stats export.
type haproxyStatItem struct {
	ObjType string `json:"objType"`
	ProxyID int    `json:"proxyId"`
	ID      int    `json:"id"`
	Field   struct {
		Pos  int    `json:"pos"`
		Name string `json:"name"`
	} `json:"field"`
	Value struct {
		Type  string      `json:"type"`
		Value interface{} `json:"value"`
	} `json:"value"`
}

func (item *haproxyStatItem) strVal() string {
	if s, ok := item.Value.Value.(string); ok {
		return s
	}
	return ""
}

func (item *haproxyStatItem) int64Val() int64 {
	switch v := item.Value.Value.(type) {
	case float64:
		return int64(v)
	case string:
		n, _ := strconv.ParseInt(v, 10, 64)
		return n
	}
	return 0
}

// FetchHAProxyStats fetches live stats from HAProxy's JSON export endpoint.
func FetchHAProxyStats(hostname string, port int) (*haproxyStats, error) {
	url := fmt.Sprintf("http://%s:%d/stats;json;norefresh", hostname, port)
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}

	var groups [][]haproxyStatItem
	if err := json.NewDecoder(resp.Body).Decode(&groups); err != nil {
		return nil, fmt.Errorf("parse json: %w", err)
	}

	// Flatten into a single slice.
	var items []haproxyStatItem
	for _, g := range groups {
		items = append(items, g...)
	}
	return parseHAProxyJSON(items)
}

func parseHAProxyJSON(items []haproxyStatItem) (*haproxyStats, error) {
	type proxyKey struct{ proxyID, id int }

	// First pass: collect proxy names to filter out the stats frontend itself.
	proxyNames := make(map[proxyKey]string, 16)
	for _, item := range items {
		if item.Field.Name == "pxname" {
			proxyNames[proxyKey{item.ProxyID, item.ID}] = item.strVal()
		}
	}

	stats := &haproxyStats{}
	frontendProxyID := -1

	for _, item := range items {
		key := proxyKey{item.ProxyID, item.ID}

		switch item.ObjType {
		case "Frontend":
			if proxyNames[key] == "stats" {
				continue
			}
			// Lock onto the first non-stats frontend.
			if frontendProxyID == -1 {
				frontendProxyID = item.ProxyID
			}
			if item.ProxyID != frontendProxyID {
				continue
			}
			switch item.Field.Name {
			case "scur":
				stats.CurrentSessions = int(item.int64Val())
			case "stot":
				stats.TotalConnections = item.int64Val()
			case "bin":
				stats.BytesIn = item.int64Val()
			case "bout":
				stats.BytesOut = item.int64Val()
			}

		case "Server":
			if item.Field.Name != "status" {
				continue
			}
			status := item.strVal()
			switch {
			case strings.HasPrefix(status, "UP"):
				stats.BackendsUp++
			case strings.HasPrefix(status, "DOWN"), strings.HasPrefix(status, "MAINT"):
				stats.BackendsDown++
			}
		}
	}

	return stats, nil
}
