package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mshalenkov/telemt-cluster-admin/internal/auth"
)

const sessionCookie = "proxy_admin_session"

// AuthMiddleware rejects requests without a valid session cookie.
// If auth is disabled (no ADMIN_PASSWORD), all requests pass through.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !auth.Enabled() {
			c.Next()
			return
		}
		token, _ := c.Cookie(sessionCookie)
		if !auth.ValidToken(token) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Next()
	}
}

// AuthStatus returns whether auth is enabled and the current session is valid.
func AuthStatus(c *gin.Context) {
	token, _ := c.Cookie(sessionCookie)
	c.JSON(http.StatusOK, gin.H{
		"enabled":       auth.Enabled(),
		"authenticated": !auth.Enabled() || auth.ValidToken(token),
	})
}

// AuthLogin validates credentials and sets a session cookie.
func AuthLogin(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username and password required"})
		return
	}
	token, ok := auth.Login(req.Username, req.Password)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	// maxAge: 24h = 86400s; HttpOnly to prevent JS access
	c.SetCookie(sessionCookie, token, 86400, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// AuthLogout clears the session.
func AuthLogout(c *gin.Context) {
	auth.Logout()
	c.SetCookie(sessionCookie, "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
