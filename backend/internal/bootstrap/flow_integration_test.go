package bootstrap

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/database"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/schema"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/security"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/session"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type wire[T any] struct {
	Code    int    `json:"code"`
	Message string `json:"msg"`
	Data    T      `json:"data"`
}

func TestRealDatabaseSeedAndHTTPFlow(t *testing.T) {
	if os.Getenv("EXEC_GRAPH_INTEGRATION") != "1" {
		t.Skip("显式启用后才连接真实 MySQL 和 Redis")
	}
	c, err := config.Load(config.Path())
	if err != nil {
		t.Fatal(err)
	}
	suffix := strings.ReplaceAll(id.New(), "-", "")
	c.Database.Schema = "eg_flow_" + suffix
	c.Redis.Prefix = "exec_graph:it:" + suffix + ":"
	c.App.EnableDemoLogin = true
	c.App.Environment = "test"
	if err := database.CreateSchema(c.Database); err != nil {
		t.Fatal(err)
	}
	db, err := database.Open(c.Database)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close(db)
	defer func() {
		if err := db.Exec("DROP DATABASE `" + c.Database.Schema + "`").Error; err != nil {
			t.Error(err)
		}
	}()
	redis, err := session.Open(context.Background(), c.Redis)
	if err != nil {
		t.Fatal(err)
	}
	defer redis.Close()
	deps := &Dependencies{Config: c, DB: db, Sessions: redis}
	if err := schema.Migrate(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	password := security.Passwords{}.Token()
	if _, err := SeedDemo(context.Background(), deps, password); err != nil {
		t.Fatal(err)
	}
	var users, nodes, testAccounts int64
	db.Model(&model.User{}).Count(&users)
	db.Model(&model.User{}).Where("is_test_account = ? AND test_dataset = ?", true, "frontend-demo-v1").Count(&testAccounts)
	db.Model(&model.ActionNode{}).Count(&nodes)
	if users != 7 || testAccounts != 7 || nodes != 37 {
		t.Fatalf("导入数量或测试标记错误: users=%d test=%d nodes=%d", users, testAccounts, nodes)
	}
	mainID := id.Demo("user", "jo")
	if err := db.Model(&model.User{}).Where("uuid = ?", mainID).Update("name", "导入后修改的昵称").Error; err != nil {
		t.Fatal(err)
	}
	if _, err := SeedDemo(context.Background(), deps, "another-password"); err != nil {
		t.Fatal(err)
	}
	var after model.User
	if err := db.Where("uuid = ?", mainID).Take(&after).Error; err != nil || after.Name != "导入后修改的昵称" {
		t.Fatalf("重复导入覆盖了业务: %v", err)
	}
	server := httptest.NewServer(HTTP(deps, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer server.Close()
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar, Timeout: 10 * time.Second}
	request := func(method, path, body, csrf string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(method, server.URL+path, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		if method == http.MethodPost {
			req.Header.Set("Content-Type", "application/json")
		}
		if csrf != "" {
			req.Header.Set("X-CSRF-Token", csrf)
		}
		response, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return response
	}
	response := request("GET", "/api/commands/auth/session", "", "")
	expectStatus(t, response, 401)
	response.Body.Close()
	response = request("POST", "/api/commands/auth/demo-login", `{"userId":"someone-else"}`, "")
	expectStatus(t, response, 400)
	response.Body.Close()
	response = request("POST", "/api/commands/auth/demo-login", `{}`, "")
	expectStatus(t, response, 200)
	demo := readWire[identity.SessionView](t, response)
	if demo.Data.User.ID != mainID || !demo.Data.User.IsTestAccount || len(demo.Data.User.Highlights.ExpressionNodeIDs) != 5 || demo.Data.CSRFToken == "" {
		t.Fatal("测试号会话返回不完整")
	}
	cookies := response.Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteLaxMode || cookies[0].Path != "/api" {
		t.Fatal("cookie 策略错误")
	}
	response = request("GET", "/api/commands/profiles/catalogue", "", "")
	expectStatus(t, response, 200)
	public, err := io.ReadAll(response.Body)
	response.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(public, []byte(`"email"`)) || bytes.Contains(public, []byte(`"isTestAccount"`)) || bytes.Contains(public, []byte(`"passwordHash"`)) {
		t.Fatal("公开目录泄露私有字段")
	}
	response = request("GET", "/api/commands/graphs/detail?graphId=cooking", "", "")
	graph := readWire[app.GraphView](t, response)
	if graph.Data.ID != id.Demo("graph", "cooking") {
		t.Fatal("旧链接映射失败")
	}
	response = request("GET", "/api/commands/actions/context?graphId=cooking", "", "")
	expectStatus(t, response, 200)
	actions := readWire[[]app.ActionView](t, response)
	if len(actions.Data) != 18 {
		t.Fatal("图上下文未完整返回")
	}
	authors := map[string]bool{}
	for _, node := range actions.Data {
		if !id.Valid(node.ID) || !id.Valid(node.GraphID) || !id.Valid(node.AuthorID) {
			t.Fatal("接口泄露短 ID 或自增主键")
		}
		authors[node.AuthorID] = true
		if node.Number == 12 && (node.AgreementMarkdown == nil || *node.AgreementMarkdown != "") {
			t.Fatal("主动清空被错误转换成继承")
		}
		if node.Number == 18 && len(node.ReferenceAgreements) != 0 {
			t.Fatal("未知核对必须适配为缺少记录，避免当前 UI 误当作不满足")
		}
		if len(node.Conversation) == 0 {
			t.Fatal("原始形成过程丢失")
		}
	}
	if len(authors) < 2 {
		t.Fatal("导入错误地把所有行动归给同一作者")
	}
	response = request("GET", "/api/commands/actions/context?graphId=cooking&graphId=daily", "", "")
	expectStatus(t, response, 400)
	response.Body.Close()
	var conversation model.AIConversation
	if err := db.Where("node_uuid = ?", id.Demo("action", "cooking-12")).Take(&conversation).Error; err != nil {
		t.Fatal(err)
	}
	secret := "UNCONFIRMED_PRIVATE_INPUT"
	if err := db.Create(&model.AIMessage{UUID: id.New(), ConversationUUID: conversation.UUID, SequenceNumber: conversation.NextMessageSequence, Speaker: "user", AuthorUUID: &mainID, Body: secret, CreatedAt: time.Now().UTC()}).Error; err != nil {
		t.Fatal(err)
	}
	response = request("GET", "/api/commands/actions/detail?nodeId=cooking-12", "", "")
	body, _ := io.ReadAll(response.Body)
	response.Body.Close()
	if bytes.Contains(body, []byte(secret)) {
		t.Fatal("未确认对话被公开")
	}
	response = request("GET", "/api/commands/graphs/detail?graphId=cycling", "", "")
	imageGraph := readWire[app.GraphView](t, response)
	if imageGraph.Data.Avatar == nil {
		t.Fatal("演示配图地址丢失")
	}
	response = request("GET", *imageGraph.Data.Avatar, "", "")
	expectStatus(t, response, 200)
	picture, _ := io.ReadAll(response.Body)
	response.Body.Close()
	if len(picture) < 100 || response.Header.Get("Content-Type") != "image/jpeg" {
		t.Fatal("站内配图不可读取")
	}
	response = request("POST", "/api/commands/auth/logout", `{}`, "wrong")
	expectStatus(t, response, 403)
	response.Body.Close()
	response = request("POST", "/api/commands/auth/logout", `{}`, demo.Data.CSRFToken)
	expectStatus(t, response, 200)
	response.Body.Close()
	response = request("GET", "/api/commands/auth/session", "", "")
	expectStatus(t, response, 401)
	response.Body.Close()
	loginBody, _ := json.Marshal(struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}{"qiao@example.com", password})
	response = request("POST", "/api/commands/auth/login", string(loginBody), "")
	expectStatus(t, response, 200)
	login := readWire[identity.SessionView](t, response)
	if login.Data.User.ID != mainID {
		t.Fatal("密码登录身份不正确")
	}
	if err := db.Model(&model.UserCredential{}).Where("user_uuid = ?", mainID).Update("auth_version", 2).Error; err != nil {
		t.Fatal(err)
	}
	response = request("GET", "/api/commands/auth/session", "", "")
	expectStatus(t, response, 401)
	response.Body.Close()
	// 精确撤销本测试建立的剩余会话；不扫描或清空配置里的 Redis。
	if err := redis.Delete(context.Background(), cookieValue(jar, server.URL)); err != nil {
		t.Fatal(err)
	}
	disabled := *deps
	disabled.Config = deps.Config
	disabled.Config.App.EnableDemoLogin = false
	forbidden := httptest.NewServer(HTTP(&disabled, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer forbidden.Close()
	req, _ := http.NewRequest("POST", forbidden.URL+"/api/commands/auth/demo-login", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	response, err = client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	expectStatus(t, response, 403)
	response.Body.Close()
}

func expectStatus(t *testing.T, response *http.Response, status int) {
	t.Helper()
	if response.StatusCode != status {
		body, _ := io.ReadAll(response.Body)
		response.Body.Close()
		t.Fatalf("HTTP 状态 %d，期望 %d: %s", response.StatusCode, status, body)
	}
	if response.Header.Get("X-Request-Id") == "" {
		t.Fatal("缺少请求追踪编号")
	}
}
func readWire[T any](t *testing.T, response *http.Response) wire[T] {
	t.Helper()
	defer response.Body.Close()
	var value wire[T]
	if err := json.NewDecoder(response.Body).Decode(&value); err != nil {
		t.Fatal(err)
	}
	if value.Code != 0 {
		t.Fatalf("业务失败 %d: %s", value.Code, value.Message)
	}
	return value
}
func cookieValue(jar *cookiejar.Jar, rawURL string) string {
	request, _ := http.NewRequest("GET", rawURL+"/api/commands/auth/session", nil)
	for _, cookie := range jar.Cookies(request.URL) {
		if cookie.Name == "exec_graph_v1_session" {
			return cookie.Value
		}
	}
	return ""
}
