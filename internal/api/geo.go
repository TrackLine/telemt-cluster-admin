package api

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mshalenkov/telemt-cluster-admin/internal/db"
	"github.com/mshalenkov/telemt-cluster-admin/internal/geo"
)

type GeoClientPoint struct {
	CountryCode string  `json:"country_code"`
	CountryName string  `json:"country_name"`
	City        string  `json:"city"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	Connections int     `json:"connections"`
}

type GeoResponse struct {
	GeoAvailable     bool             `json:"geo_available"`
	Points           []GeoClientPoint `json:"points"`
	TotalCountries   int              `json:"total_countries"`
	TotalConnections int              `json:"total_connections"`
}

func GetGeoClients(c *gin.Context) {
	hoursStr := c.DefaultQuery("hours", "1")
	hours, _ := strconv.Atoi(hoursStr)
	if hours < 1 || hours > 24 {
		hours = 1
	}

	snapshots, err := db.GetGeoSummary(hours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	countries := map[string]struct{}{}
	totalConns := 0
	points := make([]GeoClientPoint, 0, len(snapshots))
	for _, s := range snapshots {
		points = append(points, GeoClientPoint{
			CountryCode: s.CountryCode,
			CountryName: s.CountryName,
			City:        s.City,
			Lat:         s.Lat,
			Lng:         s.Lng,
			Connections: s.Connections,
		})
		countries[s.CountryCode] = struct{}{}
		totalConns += s.Connections
	}

	c.JSON(http.StatusOK, GeoResponse{
		GeoAvailable:     geo.Available(),
		Points:           points,
		TotalCountries:   len(countries),
		TotalConnections: totalConns,
	})
}

func GetGeoStatus(c *gin.Context) {
	c.JSON(http.StatusOK, geo.GetStatus())
}

func TriggerGeoUpdate(c *gin.Context) {
	go func() {
		if err := geo.DownloadDB(); err != nil {
			log.Printf("[geo] manual update failed: %v", err)
		}
	}()
	c.JSON(http.StatusAccepted, gin.H{"message": "update started"})
}
