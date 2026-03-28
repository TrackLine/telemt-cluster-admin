package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mshalenkov/telemt-cluster-admin/internal/db"
	"github.com/mshalenkov/telemt-cluster-admin/internal/models"
)

func ClusterSummary(c *gin.Context) {
	backends, err := db.GetBackendNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	entries, err := db.GetEntryNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	sum := models.ClusterSummary{}
	sum.NodesTotal = len(backends) + len(entries)

	var covSum float64
	covCount := 0
	for _, n := range backends {
		if n.Status == models.StatusOK || n.Status == models.StatusWarn {
			sum.NodesOnline++
		}
		sum.TotalLiveConnections += n.LiveConnections
		sum.TotalBytesIn += n.BytesIn
		sum.TotalBytesOut += n.BytesOut
		sum.DirectConnections += n.DirectConnections
		sum.MEConnections += n.MEConnections
		if n.Enabled {
			covSum += n.CoveragePct
			covCount++
		}
	}
	for _, n := range entries {
		if n.Status == models.StatusOK || n.Status == models.StatusWarn {
			sum.NodesOnline++
		}
		sum.TotalBytesIn += n.BytesIn
		sum.TotalBytesOut += n.BytesOut
	}
	if covCount > 0 {
		sum.AvgCoveragePct = covSum / float64(covCount)
	}

	c.JSON(http.StatusOK, sum)
}

func ClusterTopology(c *gin.Context) {
	backends, err := db.GetBackendNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	entries, err := db.GetEntryNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	topo := models.Topology{
		Nodes: []models.TopologyNode{},
		Edges: []models.TopologyEdge{},
	}

	for _, n := range entries {
		topo.Nodes = append(topo.Nodes, models.TopologyNode{
			ID:     n.ID,
			Name:   n.Name,
			Type:   "entry",
			Region: n.Region,
			Status: n.Status,
			Load:   n.CurrentSessions,
		})
	}
	for _, n := range backends {
		topo.Nodes = append(topo.Nodes, models.TopologyNode{
			ID:     n.ID,
			Name:   n.Name,
			Type:   "backend",
			Region: n.Region,
			Status: n.Status,
			Load:   n.LiveConnections,
		})
		// Every entry node connects to every backend node
		for _, e := range entries {
			topo.Edges = append(topo.Edges, models.TopologyEdge{
				Source: e.ID,
				Target: n.ID,
			})
		}
	}

	c.JSON(http.StatusOK, topo)
}

func GetMetrics(c *gin.Context) {
	nodeID := c.Param("node_id")
	metric := c.Query("metric")
	rangeStr := c.DefaultQuery("range", "1h")

	hours := 1
	switch rangeStr {
	case "6h":
		hours = 6
	case "24h":
		hours = 24
	}

	// Also accept numeric hours
	if n, err := strconv.Atoi(rangeStr); err == nil {
		hours = n
	}

	samples, err := db.GetMetricHistory(nodeID, metric, hours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if samples == nil {
		samples = []models.MetricSample{}
	}
	c.JSON(http.StatusOK, gin.H{
		"node_id": nodeID,
		"metric":  metric,
		"range":   rangeStr,
		"data":    samples,
	})
}
