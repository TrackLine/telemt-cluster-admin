package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mshalenkov/telemt-cluster-admin/internal/db"
	"github.com/mshalenkov/telemt-cluster-admin/internal/models"
	"github.com/mshalenkov/telemt-cluster-admin/internal/poller"
)

// ── Backend Nodes ──────────────────────────────────────────────────────────

func ListBackendNodes(c *gin.Context) {
	nodes, err := db.GetBackendNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if nodes == nil {
		nodes = []models.BackendNode{}
	}
	c.JSON(http.StatusOK, nodes)
}

type createBackendReq struct {
	Name     string `json:"name" binding:"required"`
	Hostname string `json:"hostname" binding:"required"`
	Region   string `json:"region"`
	APIPort  int    `json:"api_port"`
}

func CreateBackendNode(c *gin.Context) {
	var req createBackendReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.APIPort == 0 {
		req.APIPort = 9091
	}
	n := models.BackendNode{
		ID:        uuid.New().String(),
		Name:      req.Name,
		Hostname:  req.Hostname,
		Region:    req.Region,
		APIPort:   req.APIPort,
		Enabled:   true,
		Status:    models.StatusUnknown,
		CreatedAt: time.Now(),
	}
	if err := db.InsertBackendNode(&n); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, n)
}

type patchBackendReq struct {
	Name     *string `json:"name"`
	Hostname *string `json:"hostname"`
	Region   *string `json:"region"`
	APIPort  *int    `json:"api_port"`
	Enabled  *bool   `json:"enabled"`
}

func PatchBackendNode(c *gin.Context) {
	id := c.Param("id")
	n, err := db.GetBackendNode(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if n == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var req patchBackendReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name != nil {
		n.Name = *req.Name
	}
	if req.Hostname != nil {
		n.Hostname = *req.Hostname
	}
	if req.Region != nil {
		n.Region = *req.Region
	}
	if req.APIPort != nil {
		n.APIPort = *req.APIPort
	}
	if req.Enabled != nil {
		n.Enabled = *req.Enabled
	}
	if err := db.UpdateBackendNode(n); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, n)
}

func DeleteBackendNode(c *gin.Context) {
	id := c.Param("id")
	if err := db.DeleteBackendNode(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// ── Entry Nodes ────────────────────────────────────────────────────────────

func ListEntryNodes(c *gin.Context) {
	nodes, err := db.GetEntryNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if nodes == nil {
		nodes = []models.EntryNode{}
	}
	c.JSON(http.StatusOK, nodes)
}

type createEntryReq struct {
	Name      string `json:"name" binding:"required"`
	Hostname  string `json:"hostname" binding:"required"`
	Region    string `json:"region"`
	StatsPort int    `json:"stats_port"`
}

func CreateEntryNode(c *gin.Context) {
	var req createEntryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.StatsPort == 0 {
		req.StatsPort = 8404
	}
	n := models.EntryNode{
		ID:        uuid.New().String(),
		Name:      req.Name,
		Hostname:  req.Hostname,
		Region:    req.Region,
		StatsPort: req.StatsPort,
		Enabled:   true,
		Status:    models.StatusUnknown,
		CreatedAt: time.Now(),
	}
	if err := db.InsertEntryNode(&n); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, n)
}

type patchEntryReq struct {
	Name      *string `json:"name"`
	Hostname  *string `json:"hostname"`
	Region    *string `json:"region"`
	StatsPort *int    `json:"stats_port"`
	Enabled   *bool   `json:"enabled"`
}

func PatchEntryNode(c *gin.Context) {
	id := c.Param("id")
	n, err := db.GetEntryNode(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if n == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var req patchEntryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name != nil {
		n.Name = *req.Name
	}
	if req.Hostname != nil {
		n.Hostname = *req.Hostname
	}
	if req.Region != nil {
		n.Region = *req.Region
	}
	if req.StatsPort != nil {
		n.StatsPort = *req.StatsPort
	}
	if req.Enabled != nil {
		n.Enabled = *req.Enabled
	}
	if err := db.UpdateEntryNode(n); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, n)
}

func DeleteEntryNode(c *gin.Context) {
	id := c.Param("id")
	if err := db.DeleteEntryNode(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// ── Test Connection ────────────────────────────────────────────────────────

type testBackendReq struct {
	Hostname string `json:"hostname" binding:"required"`
	APIPort  int    `json:"api_port"`
}

func TestBackendNode(c *gin.Context) {
	var req testBackendReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.APIPort == 0 {
		req.APIPort = 9091
	}
	_, _, err := poller.FetchTelemetStats(req.Hostname, req.APIPort)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type testEntryReq struct {
	Hostname  string `json:"hostname" binding:"required"`
	StatsPort int    `json:"stats_port"`
}

func TestEntryNode(c *gin.Context) {
	var req testEntryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.StatsPort == 0 {
		req.StatsPort = 8404
	}
	_, err := poller.FetchHAProxyStats(req.Hostname, req.StatsPort)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
