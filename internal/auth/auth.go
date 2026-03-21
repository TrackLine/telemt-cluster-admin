package auth

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"sync"
	"time"
)

const sessionDuration = 24 * time.Hour

var (
	mu           sync.RWMutex
	sessionToken string
	sessionExp   time.Time
	adminUser    string
	adminPass    string
	authEnabled  bool
)

// Init reads ADMIN_USER / ADMIN_PASSWORD from env.
// If ADMIN_PASSWORD is empty, auth is disabled (open access).
func Init() {
	adminUser = os.Getenv("ADMIN_USER")
	if adminUser == "" {
		adminUser = "admin"
	}
	adminPass = os.Getenv("ADMIN_PASSWORD")
	authEnabled = adminPass != ""
	if authEnabled {
		// generate a fresh ephemeral token slot on startup
		sessionToken = ""
	}
}

// Enabled reports whether authentication is required.
func Enabled() bool { return authEnabled }

// Login validates credentials and returns a session token on success.
func Login(user, pass string) (string, bool) {
	if user != adminUser || pass != adminPass {
		return "", false
	}
	token := randomToken()
	mu.Lock()
	sessionToken = token
	sessionExp = time.Now().Add(sessionDuration)
	mu.Unlock()
	return token, true
}

// ValidToken reports whether the given token is a valid, non-expired session.
func ValidToken(token string) bool {
	if !authEnabled {
		return true
	}
	if token == "" {
		return false
	}
	mu.RLock()
	defer mu.RUnlock()
	return token == sessionToken && time.Now().Before(sessionExp)
}

// Logout invalidates the current session.
func Logout() {
	mu.Lock()
	sessionToken = ""
	mu.Unlock()
}

func randomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
