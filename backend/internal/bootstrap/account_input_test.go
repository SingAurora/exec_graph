package bootstrap

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/account"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/application/profile"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/security"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestRealAccountInputRules(t *testing.T) {
	sender := &capturedMail{codes: map[string]string{}}
	s := writeFixtureDependencies(t, nil, nil, sender)
	anon := writeClient{url: s.server.URL, http: &http.Client{Timeout: 40 * time.Second}}
	email := id.New() + "@example.com"
	password := strings.Repeat("😀", 8)
	anon.call(t, "POST", "auth/code-send", account.CodeInput{Purpose: "register", Email: email}, 200, "")
	registration := account.RegisterInput{Email: email, Code: sender.code(email), Password: password, Name: " " + strings.Repeat("😀", 30) + " "}
	for _, name := range []string{strings.Repeat("😀", 31), "昵称\u200b", "昵称\n"} {
		input := registration
		input.Name = name
		anon.call(t, "POST", "auth/register", input, 400, "")
	}
	invalidPasswords := []string{"pass word", "pass\u00a0word", "pass\u3000word", "pass\u200bword", "pass\u202eword", strings.Repeat("😀", 7), strings.Repeat("😀", 65)}
	for _, password := range invalidPasswords {
		input := registration
		input.Password = password
		anon.call(t, "POST", "auth/register", input, 400, "")
	}
	longEmail := strings.Repeat("a", 64) + "@" + strings.Repeat("b", 63) + "." + strings.Repeat("c", 63) + "." + strings.Repeat("d", 62)
	anon.call(t, "POST", "auth/code-send", account.CodeInput{Purpose: "register", Email: longEmail}, 400, "")
	tooLong := registration
	tooLong.Email = longEmail
	anon.call(t, "POST", "auth/register", tooLong, 400, "")
	// 以上无效输入不能消耗验证码；同一验证码仍可完成合法注册。
	client := authRequest(t, anon, "auth/register", registration, 200)
	session := decode[identity.SessionView](t, client.call(t, "GET", "auth/session", nil, 200, ""))
	if session.User.Name != strings.Repeat("😀", 30) {
		t.Fatal("昵称未按码点上限保存，或未去除首尾空白")
	}
	info := profile.UpdateProfileInput{ExpectedVersion: session.User.Version, Name: "昵称\u202e", Gender: "unknown"}
	client.call(t, "POST", "profiles/update", info, 400, "")
	info.Name = strings.Repeat("😀", 31)
	client.call(t, "POST", "profiles/update", info, 400, "")
	info.Name = " 开发者👩‍💻 "
	saved := decode[identity.AccountView](t, client.call(t, "POST", "profiles/update", info, 200, ""))
	if saved.Name != "开发者👩‍💻" {
		t.Fatal("资料编辑未沿用注册昵称规则")
	}

	// 仅在隔离库构造旧密码，验证登录和当前密码校验不追溯新规则。
	legacy := " old\u200bsecret "
	hash, err := (security.Passwords{}).Hash(legacy)
	if err != nil {
		t.Fatal(err)
	}
	mustDB(t, s.deps.DB.Model(&model.UserCredential{}).Where("user_uuid = ?", session.User.ID).Update("password_hash", hash))
	client = authRequest(t, anon, "auth/login", map[string]string{"email": email, "password": legacy}, 200)
	client.call(t, "POST", "auth/code-send", account.CodeInput{Purpose: "change-password", Email: email}, 200, "")
	change := account.ChangePasswordInput{CurrentPassword: legacy, Code: sender.code(email), Password: "Ab!'\"\\;9"}
	for _, password := range invalidPasswords {
		input := change
		input.Password = password
		client.call(t, "POST", "auth/password-change", input, 400, "")
	}
	client.call(t, "POST", "auth/password-change", change, 200, "")
	client.call(t, "GET", "auth/session", nil, 401, "")
	client = authRequest(t, anon, "auth/login", map[string]string{"email": email, "password": change.Password}, 200)
	anon.call(t, "POST", "auth/code-send", account.CodeInput{Purpose: "reset-password", Email: email}, 200, "")
	reset := account.ResetInput{Email: email, Code: sender.code(email), Password: strings.Repeat("😀", 64)}
	for _, password := range invalidPasswords {
		input := reset
		input.Password = password
		anon.call(t, "POST", "auth/password-reset", input, 400, "")
	}
	anon.call(t, "POST", "auth/password-reset", reset, 200, "")
	client.call(t, "GET", "auth/session", nil, 401, "")
	client = authRequest(t, anon, "auth/login", map[string]string{"email": email, "password": reset.Password}, 200)
	client.call(t, "GET", "auth/session", nil, 200, "")
}
