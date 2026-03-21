package geo

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"
)

// UpdateStatus tracks the state of a DB update.
type UpdateStatus struct {
	InProgress bool       `json:"in_progress"`
	LastUpdate *time.Time `json:"last_update,omitempty"`
	LastError  string     `json:"last_error,omitempty"`
	DBPath     string     `json:"db_path"`
	Available  bool       `json:"available"`
}

var (
	updating   atomic.Bool
	lastUpdate *time.Time
	lastError  string
	dbPath     string
	licenseKey string
)

// InitUpdater sets the DB path and MaxMind license key.
// If licenseKey is non-empty, starts a weekly auto-updater goroutine.
func InitUpdater(path, key string) {
	dbPath = path
	licenseKey = key
	if key != "" {
		log.Printf("[geo] MaxMind license key configured — auto-update enabled")
		go func() {
			// If DB doesn't exist yet, download immediately
			if _, err := os.Stat(path); os.IsNotExist(err) {
				log.Printf("[geo] DB not found, downloading now...")
				if err := DownloadDB(); err != nil {
					log.Printf("[geo] initial download failed: %v", err)
				}
			}
			// Then update weekly
			ticker := time.NewTicker(7 * 24 * time.Hour)
			for range ticker.C {
				log.Printf("[geo] weekly auto-update triggered")
				if err := DownloadDB(); err != nil {
					log.Printf("[geo] auto-update failed: %v", err)
				}
			}
		}()
	}
}

// GetStatus returns the current updater status.
func GetStatus() UpdateStatus {
	return UpdateStatus{
		InProgress: updating.Load(),
		LastUpdate: lastUpdate,
		LastError:  lastError,
		DBPath:     dbPath,
		Available:  Available(),
	}
}

// DownloadDB downloads the GeoLite2-City database from MaxMind and hot-reloads it.
// Returns an error if the license key is not configured or the download fails.
func DownloadDB() error {
	if licenseKey == "" {
		return fmt.Errorf("MAXMIND_LICENSE_KEY not configured")
	}
	if !updating.CompareAndSwap(false, true) {
		return fmt.Errorf("update already in progress")
	}
	defer updating.Store(false)

	log.Printf("[geo] downloading GeoLite2-City from MaxMind...")

	url := fmt.Sprintf(
		"https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=%s&suffix=tar.gz",
		licenseKey,
	)

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		lastError = err.Error()
		return fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		lastError = fmt.Sprintf("HTTP %d", resp.StatusCode)
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	// Extract .mmdb from tar.gz
	mmdbBytes, err := extractMMDB(resp.Body)
	if err != nil {
		lastError = err.Error()
		return fmt.Errorf("extract: %w", err)
	}

	// Write to a temp file first, then atomic rename
	tmpPath := dbPath + ".tmp"
	if err := os.WriteFile(tmpPath, mmdbBytes, 0644); err != nil {
		lastError = err.Error()
		return fmt.Errorf("write tmp: %w", err)
	}

	if err := os.Rename(tmpPath, dbPath); err != nil {
		lastError = err.Error()
		return fmt.Errorf("rename: %w", err)
	}

	// Hot-reload the reader
	if err := Reload(dbPath); err != nil {
		lastError = err.Error()
		return fmt.Errorf("reload: %w", err)
	}

	now := time.Now()
	lastUpdate = &now
	lastError = ""
	log.Printf("[geo] GeoLite2-City updated successfully (%d KB)", len(mmdbBytes)/1024)
	return nil
}

// extractMMDB reads a tar.gz stream and returns the contents of the first .mmdb file found.
func extractMMDB(r io.Reader) ([]byte, error) {
	gz, err := gzip.NewReader(r)
	if err != nil {
		return nil, fmt.Errorf("gzip: %w", err)
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("tar: %w", err)
		}
		if hdr.Typeflag == tar.TypeReg && strings.HasSuffix(filepath.Base(hdr.Name), ".mmdb") {
			data, err := io.ReadAll(tr)
			if err != nil {
				return nil, fmt.Errorf("read mmdb: %w", err)
			}
			return data, nil
		}
	}
	return nil, fmt.Errorf("no .mmdb file found in archive")
}
