package app

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	infrastructuremail "github.com/singaurora/exec-graph/backend/internal/infrastructure/mail"
	infrastructureredis "github.com/singaurora/exec-graph/backend/internal/infrastructure/redis"
	infrastructurestorage "github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	"gorm.io/gorm"
)

type server struct {
	db      *sql.DB
	orm     *gorm.DB
	mailer  *infrastructuremail.Mailer
	storage *infrastructurestorage.COSStorage
	redis   *infrastructureredis.SessionStore
	config  Config
}

type emailRequest struct {
	Email   string `json:"email"`
	Purpose string `json:"purpose"`
}

type registerRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Code     string `json:"code"`
}

var verificationCodePattern = regexp.MustCompile(`^\d{6}$`)

const (
	verificationPurposeRegister       = "register"
	verificationPurposeChangeEmail    = "change_email"
	verificationPurposeChangePassword = "change_password"
	verificationPurposeResetPassword  = "reset_password"
)

func (s *server) routes() http.Handler {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), corsMiddleware())
	router.HandleMethodNotAllowed = true
	router.NoMethod(func(context *gin.Context) {
		context.JSON(http.StatusMethodNotAllowed, gin.H{"error": "不支持的请求方法"})
	})
	router.NoRoute(func(context *gin.Context) {
		context.JSON(http.StatusNotFound, gin.H{"error": "接口不存在"})
	})

	api := router.Group("/api")
	api.GET("/health", gin.WrapF(s.health))

	auth := api.Group("/auth")
	auth.POST("/send-code", gin.WrapF(s.sendCode))
	auth.POST("/register", gin.WrapF(s.register))
	auth.POST("/login", gin.WrapF(s.login))
	auth.POST("/logout", gin.WrapF(s.logout))
	auth.GET("/me", gin.WrapF(s.me))
	auth.POST("/change-email", gin.WrapF(s.changeEmail))
	auth.POST("/change-password", gin.WrapF(s.changePassword))
	auth.POST("/reset-password", gin.WrapF(s.resetPassword))

	users := api.Group("/users")
	users.GET("/me", gin.WrapF(s.handleCurrentUser))
	users.PATCH("/me", gin.WrapF(s.handleCurrentUser))
	users.POST("/me/avatar", gin.WrapF(s.handleAvatar))
	users.POST("/me/background", gin.WrapF(s.handleProfileBackground))

	projects := api.Group("/projects")
	projects.GET("", gin.WrapF(s.handleProjects))
	projects.POST("", gin.WrapF(s.handleProjects))
	projects.GET("/*path", gin.WrapF(s.handleProjects))
	projects.POST("/*path", gin.WrapF(s.handleProjects))
	projects.PATCH("/*path", gin.WrapF(s.handleProjects))
	projects.DELETE("/*path", gin.WrapF(s.handleProjects))

	explore := api.Group("/explore")
	explore.GET("/projects", gin.WrapF(s.handleExploreProjects))
	explore.GET("/network", gin.WrapF(s.handleExploreNetwork))
	explore.GET("/projects/:id", gin.WrapF(s.handleExploreProject))
	explore.GET("/contribution-sources", gin.WrapF(s.handleContributionSources))
	explore.GET("/my-contributions", gin.WrapF(s.handleMyContributions))

	collaboration := api.Group("/collaboration-calls")
	collaboration.GET("/:id", gin.WrapF(s.handleCollaborationCall))
	collaboration.POST("/:id/submissions", gin.WrapF(s.handleCollaborationCall))
	collaboration.POST("/:id/reviews", gin.WrapF(s.handleCollaborationCall))
	collaboration.POST("/reviews/:id/adopt", gin.WrapF(s.handleCollaborationReview))

	contracts := api.Group("/smart-contracts")
	contracts.GET("", gin.WrapF(s.handleSmartContracts))
	contracts.POST("", gin.WrapF(s.handleSmartContracts))
	contracts.GET("/*path", gin.WrapF(s.handleSmartContracts))
	contracts.DELETE("/*path", gin.WrapF(s.handleSmartContracts))

	aiKeys := api.Group("/ai-keys")
	aiKeys.GET("", gin.WrapF(s.handleAIKeys))
	aiKeys.POST("", gin.WrapF(s.handleAIKeys))
	aiKeys.POST("/*path", gin.WrapF(s.handleAIKeys))
	aiKeys.DELETE("/*path", gin.WrapF(s.handleAIKeys))

	aiReviews := api.Group("/ai-reviews")
	aiReviews.POST("/node", gin.WrapF(s.reviewExecutionNode))
	aiReviews.POST("/node/clarification", gin.WrapF(s.reviewExecutionNodeClarification))
	aiReviews.POST("/node-draft", gin.WrapF(s.reviewNodeDraft))

	conversations := api.Group("/conversations")
	conversations.GET("/*path", gin.WrapF(s.handleConversations))
	conversations.POST("/*path", gin.WrapF(s.handleConversations))

	return router
}

func (s *server) health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *server) sendCode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}

	var request emailRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	purpose := strings.TrimSpace(request.Purpose)
	if purpose == "" {
		purpose = verificationPurposeRegister
	}
	if purpose != verificationPurposeRegister && purpose != verificationPurposeChangeEmail && purpose != verificationPurposeChangePassword && purpose != verificationPurposeResetPassword {
		writeError(w, http.StatusBadRequest, "验证码用途不正确")
		return
	}
	var currentUser authenticatedUser
	if purpose == verificationPurposeChangeEmail || purpose == verificationPurposeChangePassword {
		var ok bool
		currentUser, ok = s.requireUser(w, r)
		if !ok {
			return
		}
	}
	email, err := normalizeEmail(request.Email)
	if purpose == verificationPurposeChangePassword {
		email = currentUser.Email
		err = nil
	}
	if err != nil || (purpose == verificationPurposeChangeEmail && email == currentUser.Email) {
		writeError(w, http.StatusBadRequest, "请输入与当前账号不同的有效邮箱")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	var exists bool
	if err := s.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = ?)`, email).Scan(&exists); err != nil {
		writeError(w, http.StatusInternalServerError, "检查邮箱失败")
		return
	}
	if exists && purpose == verificationPurposeRegister {
		writeError(w, http.StatusConflict, "该邮箱已经注册")
		return
	}
	if exists && purpose == verificationPurposeChangeEmail {
		writeError(w, http.StatusConflict, "该邮箱已经注册")
		return
	}
	if !exists && purpose == verificationPurposeResetPassword {
		writeError(w, http.StatusNotFound, "该邮箱尚未注册")
		return
	}

	code, err := newVerificationCode()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成验证码失败")
		return
	}
	if err := s.mailer.SendVerificationCode(ctx, email, code); err != nil {
		fmt.Printf("send verification email failed for %s: %v\n", email, err)
		writeError(w, http.StatusBadGateway, "验证码邮件发送失败，请稍后重试")
		return
	}

	codeHash := hashValue(code)
	_, err = s.db.ExecContext(ctx, `
		UPDATE email_verification_codes
		SET used_at = NOW()
		WHERE email = ? AND purpose = ? AND used_at IS NULL`, email, purpose)
	if err == nil {
		_, err = s.db.ExecContext(ctx, `
			INSERT INTO email_verification_codes (email, purpose, code_hash, expires_at, send_ip)
			VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)`, email, purpose, codeHash, s.config.Tencent.SES.CodeTTLMinutes, clientIP(r))
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存验证码失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "验证码已发送"})
}

func (s *server) register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}

	var request registerRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	username := strings.TrimSpace(request.Username)
	email, emailErr := normalizeEmail(request.Email)
	if len([]rune(username)) < 2 || len([]rune(username)) > 64 {
		writeError(w, http.StatusBadRequest, "用户名长度需要在 2 到 64 个字符之间")
		return
	}
	if emailErr != nil {
		writeError(w, http.StatusBadRequest, "请输入有效邮箱")
		return
	}
	if len(request.Password) < 6 {
		writeError(w, http.StatusBadRequest, "密码至少需要 6 个字符")
		return
	}
	if !verificationCodePattern.MatchString(request.Code) {
		writeError(w, http.StatusBadRequest, "请输入 6 位验证码")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	var verificationID uint64
	var expectedHash string
	err := s.db.QueryRowContext(ctx, `
		SELECT id, code_hash
		FROM email_verification_codes
		WHERE email = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW()
		ORDER BY id DESC LIMIT 1`, email, verificationPurposeRegister).Scan(&verificationID, &expectedHash)
	if errors.Is(err, sql.ErrNoRows) || !equalHash(expectedHash, request.Code) {
		writeError(w, http.StatusBadRequest, "验证码错误或已过期")
		return
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建账号失败")
		return
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `UPDATE email_verification_codes SET used_at = NOW() WHERE id = ? AND used_at IS NULL`, verificationID); err != nil {
		writeError(w, http.StatusInternalServerError, "确认验证码失败")
		return
	}
	var databaseUserID int64
	var userHandle string
	for attempt := 0; attempt < 3; attempt++ {
		userHandle, err = newUserID()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "生成用户 ID 失败")
			return
		}
		result, insertErr := tx.ExecContext(ctx, `
			INSERT INTO users (username, user_id, email, password_hash, email_verified_at)
			VALUES (?, ?, ?, ?, NOW())`, username, userHandle, email, request.Password)
		if insertErr == nil {
			databaseUserID, err = result.LastInsertId()
			break
		}
		if strings.Contains(strings.ToLower(insertErr.Error()), "uq_users_user_id") {
			continue
		}
		if strings.Contains(insertErr.Error(), "Duplicate entry") {
			writeError(w, http.StatusConflict, "该邮箱已经注册")
		} else {
			writeError(w, http.StatusInternalServerError, "创建账号失败")
		}
		return
	}
	if databaseUserID == 0 || err != nil {
		writeError(w, http.StatusInternalServerError, "读取账号信息失败")
		return
	}
	if err := ensureDefaultProjectTx(ctx, tx, uint64(databaseUserID)); err != nil {
		writeError(w, http.StatusInternalServerError, "创建默认项目失败")
		return
	}
	token, err := s.createSessionTx(ctx, tx, uint64(databaseUserID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建登录会话失败")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "保存账号失败")
		return
	}
	s.cacheSession(r.Context(), token, authenticatedUser{ID: uint64(databaseUserID), Username: username, UserID: userHandle, Email: email})
	writeJSON(w, http.StatusCreated, map[string]any{
		"accessToken": token,
		"user":        map[string]any{"id": databaseUserID, "email": email, "username": username, "userId": userHandle},
	})
}

var userIDPattern = regexp.MustCompile(`^[A-Za-z0-9_]{2,24}$`)

func normalizeUserID(value string) (string, error) {
	userID := strings.TrimPrefix(strings.TrimSpace(value), "@")
	if !userIDPattern.MatchString(userID) {
		return "", errors.New("用户 ID 需要是 2 到 24 位字母、数字或下划线")
	}
	return userID, nil
}

func normalizeEmail(value string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(value))
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || !strings.Contains(email, "@") {
		return "", errors.New("invalid email")
	}
	return email, nil
}

func newVerificationCode() (string, error) {
	number, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", number.Int64()), nil
}

func hashValue(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func equalHash(expectedHash, value string) bool {
	return expectedHash != "" && expectedHash == hashValue(value)
}

func clientIP(r *http.Request) string {
	address, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return address
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	return decoder.Decode(target)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func corsMiddleware() gin.HandlerFunc {
	return func(context *gin.Context) {
		context.Header("Access-Control-Allow-Origin", "http://localhost:5173")
		context.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		context.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		if context.Request.Method == http.MethodOptions {
			context.Status(http.StatusNoContent)
			context.Abort()
			return
		}
		context.Next()
	}
}
