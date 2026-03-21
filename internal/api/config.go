package api

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// ClusterMode is either "simple" (telemt only, no HAProxy) or "full" (HAProxy + telemt).
type AppConfig struct {
	ClusterMode string `json:"cluster_mode"`
}

func GetConfig(c *gin.Context) {
	mode := os.Getenv("CLUSTER_MODE")
	if mode != "simple" && mode != "full" {
		mode = "full"
	}
	c.JSON(http.StatusOK, AppConfig{ClusterMode: mode})
}
