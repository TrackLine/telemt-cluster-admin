package db

import (
	"time"
)

// timeFormats that mattn/go-sqlite3 may use when storing time values.
var sqliteTimeFormats = []string{
	time.RFC3339Nano,
	time.RFC3339,
	"2006-01-02T15:04:05.999999999Z07:00",
	"2006-01-02 15:04:05.999999999Z07:00",
	"2006-01-02 15:04:05Z07:00",
	"2006-01-02 15:04:05",
}

func parseTime(s string) time.Time {
	for _, f := range sqliteTimeFormats {
		if t, err := time.Parse(f, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

// GeoSnapshot represents a resolved country/city with connection count at a point in time.
type GeoSnapshot struct {
	CountryCode string
	CountryName string
	City        string
	Lat         float64
	Lng         float64
	Connections int
	NodeID      string
	SampledAt   time.Time
}

// InsertGeoSnapshots stores a batch of geo data for one polling cycle.
func InsertGeoSnapshots(snapshots []GeoSnapshot) error {
	if len(snapshots) == 0 {
		return nil
	}
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare(`INSERT INTO geo_snapshots (country_code,country_name,city,lat,lng,connections,node_id,sampled_at) VALUES (?,?,?,?,?,?,?,?)`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	for _, s := range snapshots {
		if _, err := stmt.Exec(s.CountryCode, s.CountryName, s.City, s.Lat, s.Lng, s.Connections, s.NodeID, s.SampledAt); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// GetGeoSummary returns aggregated geo data from the last `hours` hours.
func GetGeoSummary(hours int) ([]GeoSnapshot, error) {
	since := time.Now().Add(-time.Duration(hours) * time.Hour)
	rows, err := DB.Query(`
		SELECT country_code, country_name, city, AVG(lat), AVG(lng), SUM(connections), MAX(sampled_at)
		FROM geo_snapshots
		WHERE sampled_at >= ?
		GROUP BY country_code, city
		ORDER BY SUM(connections) DESC
		LIMIT 500
	`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []GeoSnapshot
	for rows.Next() {
		var s GeoSnapshot
		var sampledAtStr string
		if err := rows.Scan(&s.CountryCode, &s.CountryName, &s.City, &s.Lat, &s.Lng, &s.Connections, &sampledAtStr); err != nil {
			return nil, err
		}
		s.SampledAt = parseTime(sampledAtStr)
		result = append(result, s)
	}
	return result, nil
}

// PurgeOldGeoSnapshots deletes geo records older than 24 hours.
func PurgeOldGeoSnapshots() {
	cutoff := time.Now().Add(-24 * time.Hour)
	DB.Exec(`DELETE FROM geo_snapshots WHERE sampled_at < ?`, cutoff)
}
