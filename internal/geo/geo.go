package geo

import (
	"log"
	"net"
	"os"
	"sync"

	"github.com/oschwald/geoip2-golang"
)

var (
	reader *geoip2.Reader
	mu     sync.RWMutex
)

// Init opens the MaxMind DB. If the file doesn't exist, geo features are silently disabled.
func Init(path string) error {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		log.Printf("[geo] MaxMind DB not found at %s — geo features disabled (download GeoLite2-City.mmdb from maxmind.com)", path)
		return nil
	}
	r, err := geoip2.Open(path)
	if err != nil {
		return err
	}
	mu.Lock()
	reader = r
	mu.Unlock()
	log.Printf("[geo] MaxMind DB loaded: %s", path)
	return nil
}

// Available returns true if the DB is loaded.
func Available() bool {
	mu.RLock()
	defer mu.RUnlock()
	return reader != nil
}

// GeoInfo holds resolved geographic info.
type GeoInfo struct {
	CountryCode string  `json:"country_code"`
	CountryName string  `json:"country_name"`
	City        string  `json:"city"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
}

// Reload closes the current reader and opens a new one from path.
func Reload(path string) error {
	r, err := geoip2.Open(path)
	if err != nil {
		return err
	}
	mu.Lock()
	old := reader
	reader = r
	mu.Unlock()
	if old != nil {
		old.Close()
	}
	log.Printf("[geo] reader hot-reloaded from %s", path)
	return nil
}

// Lookup resolves an IP string to GeoInfo. Returns nil if not found or DB not loaded.
func Lookup(ipStr string) *GeoInfo {
	mu.RLock()
	r := reader
	mu.RUnlock()
	if r == nil {
		return nil
	}
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return nil
	}
	record, err := r.City(ip)
	if err != nil {
		return nil
	}
	cityName := ""
	if v, ok := record.City.Names["en"]; ok {
		cityName = v
	}
	countryName := ""
	if v, ok := record.Country.Names["en"]; ok {
		countryName = v
	}
	return &GeoInfo{
		CountryCode: record.Country.IsoCode,
		CountryName: countryName,
		City:        cityName,
		Lat:         record.Location.Latitude,
		Lng:         record.Location.Longitude,
	}
}
