package bootstrap

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"testing"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/account"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/mail"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// capturedMail 只在测试内保存本次实际发送的验证码，不打印验证码或邮箱。
type capturedMail struct {
	mu        sync.Mutex
	codes     map[string]string
	delegate  app.Sender
	recipient string
}

func (s *capturedMail) SendCode(ctx context.Context, email, code string, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.delegate != nil {
		if email != s.recipient {
			return fmt.Errorf("测试禁止向未指定收件人发送邮件")
		}
		if err := s.delegate.SendCode(ctx, email, code, ttl); err != nil {
			return err
		}
	}
	s.codes[email] = code
	return nil
}

func (s *capturedMail) code(email string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.codes[email]
}

func authRequest(t *testing.T, c writeClient, path string, input any, status int) writeClient {
	t.Helper()
	body, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest("POST", c.url+"/api/commands/"+path, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := c.http.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var output wire[identity.SessionView]
	if err := json.NewDecoder(res.Body).Decode(&output); err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != status {
		t.Fatalf("%s HTTP %d，期望 %d: %s", path, res.StatusCode, status, output.Message)
	}
	if status == 200 {
		for _, cookie := range res.Cookies() {
			if cookie.Name == "exec_graph_v1_session" {
				c.token = cookie.Value
			}
		}
		c.csrf = output.Data.CSRFToken
	}
	return c
}

func accountFlow(t *testing.T, s *writeSystem, sender *capturedMail, email string) writeClient {
	t.Helper()
	anon := writeClient{url: s.server.URL, http: &http.Client{Timeout: 40 * time.Second}}
	anon.call(t, "POST", "auth/code-send", app.CodeInput{Purpose: "register", Email: email}, 200, "")
	anon.call(t, "POST", "auth/code-send", app.CodeInput{Purpose: "register", Email: email}, 429, "")
	password := "integration-first-password-493"
	registration := app.RegisterInput{Email: email, Code: "000000", Password: password, Name: "普通注册验证"}
	if sender.code(email) == registration.Code {
		registration.Code = "111111"
	}
	anon.call(t, "POST", "auth/register", registration, 400, "")
	registration.Code = sender.code(email)
	client := authRequest(t, anon, "auth/register", registration, 200)
	session := decode[identity.SessionView](t, client.call(t, "GET", "auth/session", nil, 200, ""))
	if session.User.IsTestAccount || session.User.Email != email || session.User.Version != 1 {
		t.Fatal("普通注册错误接受了测试标记或未建立会话")
	}
	anon.call(t, "POST", "auth/register", registration, 400, "")
	var credential model.UserCredential
	mustDB(t, s.deps.DB.Where("user_uuid = ?", session.User.ID).Take(&credential))
	if credential.PasswordHash == password || credential.AuthVersion != 1 {
		t.Fatal("密码未哈希或认证版本错误")
	}
	anon.call(t, "POST", "auth/code-send", app.CodeInput{Purpose: "reset-password", Email: email}, 200, "")
	reset := app.ResetInput{Email: email, Code: sender.code(email), Password: "integration-reset-password-725"}
	anon.call(t, "POST", "auth/password-reset", reset, 200, "")
	client.call(t, "GET", "auth/session", nil, 401, "")
	anon.call(t, "POST", "auth/password-reset", reset, 400, "")
	login := struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}{email, password}
	authRequest(t, anon, "auth/login", login, 401)
	login.Password = reset.Password
	client = authRequest(t, anon, "auth/login", login, 200)
	client.call(t, "GET", "auth/session", nil, 200, "")
	return client
}

func TestRealMailRegistrationAndPasswordReset(t *testing.T) {
	if os.Getenv("EXEC_GRAPH_MAIL_INTEGRATION") != "1" || os.Getenv("EXEC_GRAPH_INTEGRATION") != "1" {
		t.Skip("同时显式启用数据库与邮件，并指定收件人")
	}
	recipient := os.Getenv("EXEC_GRAPH_MAIL_TEST_RECIPIENT")
	if recipient == "" {
		t.Fatal("真实邮件测试必须明确指定获授权收件人")
	}
	c, err := config.Load(config.Path())
	if err != nil {
		t.Fatal(err)
	}
	c.Mail.Enabled = true
	real, err := mail.New(c.Mail, c.Credentials)
	if err != nil {
		t.Fatal(err)
	}
	sender := &capturedMail{codes: map[string]string{}, delegate: real, recipient: recipient}
	s := writeFixtureDependencies(t, nil, nil, sender)
	accountFlow(t, s, sender, recipient)
	t.Log("邮件服务已接受注册、重置两封验证码邮件；HTTP 验证与旧会话撤销通过，收件箱送达由收件人确认")
}

func TestRealAccountCredentialsAndOneTimeCodes(t *testing.T) {
	sender := &capturedMail{codes: map[string]string{}}
	s := writeFixtureDependencies(t, nil, nil, sender)
	email := id.New() + "@example.com"
	client := accountFlow(t, s, sender, email)
	client.call(t, "POST", "auth/code-send", app.CodeInput{Purpose: "change-password", Email: email}, 200, "")
	input := app.ChangePasswordInput{CurrentPassword: "integration-reset-password-725", Password: "integration-changed-password-729", Code: sender.code(email)}
	client.call(t, "POST", "auth/password-change", input, 200, "")
	client.call(t, "GET", "auth/session", nil, 401, "")
	client = authRequest(t, client, "auth/login", struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}{email, input.Password}, 200)
	otherEmail := id.New() + "@example.com"
	client.call(t, "POST", "auth/code-send", app.CodeInput{Purpose: "change-email", Email: otherEmail}, 200, "")
	client.call(t, "POST", "auth/email-change", app.ChangeEmailInput{CurrentPassword: input.Password, Email: otherEmail, Code: sender.code(otherEmail)}, 200, "")
	client.call(t, "GET", "auth/session", nil, 401, "")
	client = authRequest(t, client, "auth/login", struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}{otherEmail, input.Password}, 200)
	client.call(t, "GET", "auth/session", nil, 200, "")
	// 原子消耗在并发核验时只能成功一次，连续五次错误使正确码也失效。
	ctx := context.Background()
	if err := s.deps.Sessions.Issue(ctx, "concurrent", email, "123456", time.Minute); err != nil {
		t.Fatal(err)
	}
	results := make(chan bool, 2)
	failures := make(chan error, 2)
	for i := 0; i < 2; i++ {
		go func() {
			ok, err := s.deps.Sessions.Consume(ctx, "concurrent", email, "123456")
			results <- ok
			failures <- err
		}()
	}
	successes := 0
	for i := 0; i < 2; i++ {
		if <-results {
			successes++
		}
		if err := <-failures; err != nil {
			t.Fatal(err)
		}
	}
	if successes != 1 {
		t.Fatal("验证码被重复消耗")
	}
	if err := s.deps.Sessions.Issue(ctx, "attempts", email, "123456", time.Minute); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 5; i++ {
		if ok, err := s.deps.Sessions.Consume(ctx, "attempts", email, "000000"); err != nil || ok {
			t.Fatal("错误验证码校验异常", err)
		}
	}
	if ok, err := s.deps.Sessions.Consume(ctx, "attempts", email, "123456"); err != nil || ok {
		t.Fatal("次数耗尽后验证码仍可用", err)
	}
}
