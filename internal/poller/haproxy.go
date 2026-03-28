package poller

import (
	"encoding/csv"
	"fmt"
	"io"
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

// FetchHAProxyStats fetches and parses HAProxy CSV stats from the stats endpoint.
func FetchHAProxyStats(hostname string, port int) (*haproxyStats, error) {
	url := fmt.Sprintf("http://%s:%d/stats;csv;norefresh", hostname, port)
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	return parseHAProxyCSV(resp.Body)
}

// parseHAProxyCSV parses HAProxy CSV stats output.
// HAProxy CSV columns: pxname,svname,qcur,qmax,scur,smax,slim,stot,bin,bout,dreq,dresp,ereq,econ,eresp,
//   wretr,wredis,status,weight,act,bck,chkfail,chkdown,lastchg,downtime,qlimit,pid,iid,sid,throttle,lbtot,tracked,type,rate,rate_lim,rate_max,...
func parseHAProxyCSV(r io.Reader) (*haproxyStats, error) {
	reader := csv.NewReader(r)
	reader.Comment = '#'
	reader.TrimLeadingSpace = true
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("parse csv: %w", err)
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("empty response")
	}

	// Find column indices from header row
	header := records[0]
	// HAProxy prepends "# " to header; csv.Reader with Comment='#' skips comment lines.
	// But the header line starts with "# pxname,...", so after trimming it might be fine.
	// Let's normalize header names.
	colIdx := make(map[string]int)
	for i, h := range header {
		colIdx[strings.TrimSpace(strings.TrimPrefix(h, "#"))] = i
	}

	// Fallback positional indices if header parsing failed
	const (
		colPxname  = 0
		colSvname  = 1
		colScur    = 4
		colStot    = 7
		colBin     = 8
		colBout    = 9
		colStatus  = 17
		colType    = 32 // 0=frontend,1=backend,2=server,3=socket/listener
	)

	idxScur := getIdx(colIdx, "scur", colScur)
	idxStot := getIdx(colIdx, "stot", colStot)
	idxBin := getIdx(colIdx, "bin", colBin)
	idxBout := getIdx(colIdx, "bout", colBout)
	idxStatus := getIdx(colIdx, "status", colStatus)
	idxType := getIdx(colIdx, "type", colType)

	stats := &haproxyStats{}
	frontendDone := false

	for _, row := range records[1:] {
		if len(row) < 18 {
			continue
		}
		rowType := safeInt(row, idxType)
		status := safeStr(row, idxStatus)

		switch rowType {
		case 0: // frontend — aggregate sessions
			if !frontendDone {
				stats.CurrentSessions = safeInt(row, idxScur)
				stats.TotalConnections = safeInt64(row, idxStot)
				stats.BytesIn = safeInt64(row, idxBin)
				stats.BytesOut = safeInt64(row, idxBout)
				frontendDone = true
			}
		case 2: // server entries
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

func getIdx(m map[string]int, key string, fallback int) int {
	if v, ok := m[key]; ok {
		return v
	}
	return fallback
}

func safeStr(row []string, idx int) string {
	if idx < len(row) {
		return strings.TrimSpace(row[idx])
	}
	return ""
}

func safeInt(row []string, idx int) int {
	s := safeStr(row, idx)
	v, _ := strconv.Atoi(s)
	return v
}

func safeInt64(row []string, idx int) int64 {
	s := safeStr(row, idx)
	v, _ := strconv.ParseInt(s, 10, 64)
	return v
}
