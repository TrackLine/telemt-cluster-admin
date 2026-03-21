package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mshalenkov/telemt-cluster-admin/internal/api"
	"github.com/mshalenkov/telemt-cluster-admin/internal/db"
	"github.com/mshalenkov/telemt-cluster-admin/internal/geo"
	"github.com/mshalenkov/telemt-cluster-admin/internal/poller"
)

//go:embed all:web/dist
var webFS embed.FS

func main() {
	dbPath := env("DB_PATH", "./data/cluster.db")
	port := env("PORT", "3000")
	pollInterval := envDuration("POLL_INTERVAL", 15*time.Second)

	if err := os.MkdirAll("data", 0755); err != nil {
		log.Fatalf("mkdir data: %v", err)
	}

	if err := db.Init(dbPath); err != nil {
		log.Fatalf("db init: %v", err)
	}
	log.Printf("database: %s", dbPath)

	geoDBPath := env("GEOIP_DB", "./data/GeoLite2-City.mmdb")
	if err := geo.Init(geoDBPath); err != nil {
		log.Printf("geo init: %v", err)
	}
	maxmindKey := env("MAXMIND_LICENSE_KEY", "")
	geo.InitUpdater(geoDBPath, maxmindKey)

	poller.Start(pollInterval)
	log.Printf("poller started (interval: %s)", pollInterval)

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	v1 := r.Group("/api")
	{
		v1.GET("/nodes/backends", api.ListBackendNodes)
		v1.POST("/nodes/backends", api.CreateBackendNode)
		v1.PATCH("/nodes/backends/:id", api.PatchBackendNode)
		v1.DELETE("/nodes/backends/:id", api.DeleteBackendNode)
		v1.POST("/nodes/backends/test", api.TestBackendNode)

		v1.GET("/nodes/entries", api.ListEntryNodes)
		v1.POST("/nodes/entries", api.CreateEntryNode)
		v1.PATCH("/nodes/entries/:id", api.PatchEntryNode)
		v1.DELETE("/nodes/entries/:id", api.DeleteEntryNode)
		v1.POST("/nodes/entries/test", api.TestEntryNode)

		v1.GET("/cluster/summary", api.ClusterSummary)
		v1.GET("/cluster/topology", api.ClusterTopology)
		v1.GET("/metrics/:node_id", api.GetMetrics)

		v1.GET("/geo/clients", api.GetGeoClients)
		v1.GET("/geo/status", api.GetGeoStatus)
		v1.POST("/geo/update", api.TriggerGeoUpdate)
	}

	// Serve SPA — embedded frontend
	distFS, err := fs.Sub(webFS, "web/dist")
	if err != nil {
		log.Fatalf("embed sub: %v", err)
	}
	fileServer := http.FileServer(http.FS(distFS))
	indexHTML, err := fs.ReadFile(distFS, "index.html")
	if err != nil {
		log.Fatalf("embed index.html: %v", err)
	}
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path[1:] // strip leading /
		if _, err := fs.Stat(distFS, path); err != nil {
			// SPA fallback: serve index.html for client-side routing
			c.Data(http.StatusOK, "text/html; charset=utf-8", indexHTML)
			return
		}
		fileServer.ServeHTTP(c.Writer, c.Request)
	})

	log.Printf("listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server: %v", err)
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}
