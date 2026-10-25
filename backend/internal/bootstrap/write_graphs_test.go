package bootstrap

import (
	"bytes"
	"io"
	"log/slog"
	"net/http/httptest"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/following"
	"github.com/singaurora/exec-graph/backend/internal/application/graph"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/application/profile"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestRealGraphProfileFollowingWrites(t *testing.T) {
	s := writeFixture(t)
	jo, lin := s.as(t, id.Demo("user", "jo")), s.as(t, id.Demo("user", "lin"))
	key := id.New()
	input := graph.CreateGraphInput{Title: "幂等空图", Description: ""}
	first := jo.call(t, "POST", "graphs/create", input, 200, key)
	second := jo.call(t, "POST", "graphs/create", input, 200, key)
	if !bytes.Equal(first, second) {
		t.Fatal("同一提交没有重放原响应")
	}
	created := decode[catalogue.GraphView](t, first)
	input.Title = "另一个提交"
	jo.call(t, "POST", "graphs/create", input, 409, key)
	jo.call(t, "POST", "graphs/create", input, 400, "")
	wrongCSRF := jo
	wrongCSRF.csrf = "wrong"
	wrongCSRF.call(t, "POST", "graphs/create", input, 403, id.New())
	unauth := jo
	unauth.token = "missing"
	unauth.call(t, "POST", "graphs/create", input, 401, id.New())
	guide := "只根据已经发生的事实整理"
	update := graph.UpdateGraphInput{GraphID: created.ID, ExpectedVersion: 1, Title: "更新后的空图", Description: "", ContextGuide: &guide}
	lin.call(t, "POST", "graphs/update", update, 403, "")
	update.AvatarAssetID = str(id.New())
	jo.call(t, "POST", "graphs/update", update, 403, "")
	update.AvatarAssetID = nil
	updated := decode[catalogue.GraphView](t, jo.call(t, "POST", "graphs/update", update, 200, ""))
	if updated.Version != 2 || updated.Title != update.Title {
		t.Fatal("图资料未更新")
	}
	jo.call(t, "POST", "graphs/update", update, 409, "")
	update.ExpectedVersion, update.ContextGuide = 2, nil
	preserved := decode[catalogue.GraphView](t, jo.call(t, "POST", "graphs/update", update, 200, ""))
	if preserved.ContextGuide != guide {
		t.Fatal("修改图资料意外清除了整理指引")
	}
	count := uint32(1)
	remove := graph.DeleteGraphInput{GraphID: created.ID, ExpectedVersion: 3, ExpectedNodeCount: &count}
	jo.call(t, "POST", "graphs/delete", remove, 409, "")
	count = 0
	jo.call(t, "POST", "graphs/delete", remove, 200, "")
	jo.call(t, "GET", "graphs/detail?graphId="+created.ID, nil, 404, "")
	jo.call(t, "POST", "graphs/update", graph.UpdateGraphInput{GraphID: created.ID, ExpectedVersion: 2, Title: "不能复活"}, 404, "")
	if again := jo.call(t, "POST", "graphs/create", graph.CreateGraphInput{Title: "幂等空图", Description: ""}, 200, key); !bytes.Equal(first, again) {
		t.Fatal("删除后重试创建丢失了原始回执")
	}
	var hidden model.Graph
	mustDB(t, s.deps.DB.Where("uuid = ?", created.ID).Take(&hidden))
	if hidden.DeletedAt == nil {
		t.Fatal("删除未持久化")
	}
	zero := uint32(0)
	jo.call(t, "POST", "graphs/delete", graph.DeleteGraphInput{GraphID: id.Demo("graph", "cooking"), ExpectedVersion: 1, ExpectedNodeCount: &zero}, 403, "")

	current := decode[identity.SessionView](t, jo.call(t, "GET", "auth/session", nil, 200, ""))
	original := current.User.Highlights.ExpressionNodeIDs
	newOrder := append([]string{}, original...)
	newOrder[0], newOrder[4] = newOrder[4], newOrder[0]
	highlight := profile.SetHighlightsInput{ExpectedVersion: current.User.Version, ExpressionNodeIDs: newOrder}
	selected := decode[identity.AccountView](t, jo.call(t, "POST", "profiles/highlights-set", highlight, 200, ""))
	if selected.Highlights.ExpressionNodeIDs[0] != newOrder[0] {
		t.Fatal("精选顺序未保存")
	}
	jo.call(t, "POST", "profiles/highlights-set", highlight, 409, "")
	tooMany := append(append([]string{}, newOrder...), id.New())
	jo.call(t, "POST", "profiles/highlights-set", profile.SetHighlightsInput{ExpectedVersion: selected.Version, ExpressionNodeIDs: tooMany}, 400, "")
	jo.call(t, "POST", "profiles/highlights-set", profile.SetHighlightsInput{ExpectedVersion: selected.Version, ExpressionNodeIDs: []string{newOrder[0], newOrder[0]}}, 400, "")
	jo.call(t, "POST", "profiles/highlights-set", profile.SetHighlightsInput{ExpectedVersion: selected.Version, ExpressionNodeIDs: []string{id.Demo("action", "cooking-2")}}, 403, "")
	info := profile.UpdateProfileInput{ExpectedVersion: selected.Version, Name: "数据库里的新昵称", Gender: "unknown", Bio: "真实保存的简介"}
	saved := decode[identity.AccountView](t, jo.call(t, "POST", "profiles/update", info, 200, ""))
	if saved.Name != info.Name || saved.Version != selected.Version+1 || len(saved.Highlights.ExpressionNodeIDs) != 5 {
		t.Fatal("资料更新覆盖了精选或未增加版本")
	}
	jo.call(t, "POST", "profiles/update", info, 409, "")
	cleared := decode[identity.AccountView](t, jo.call(t, "POST", "profiles/highlights-set", profile.SetHighlightsInput{ExpectedVersion: saved.Version, ExpressionNodeIDs: []string{}}, 200, ""))
	if len(cleared.Highlights.ExpressionNodeIDs) != 0 || cleared.Name != info.Name {
		t.Fatal("清空精选影响其他资料")
	}

	state := true
	follow := following.SetFollowingInput{Kind: "user", TargetID: id.Demo("user", "lin"), Following: &state}
	jo.call(t, "POST", "following/set", follow, 200, "")
	jo.call(t, "POST", "following/set", follow, 200, "")
	follow.TargetID = id.Demo("user", "jo")
	jo.call(t, "POST", "following/set", follow, 409, "")
	follow.TargetID = id.New()
	jo.call(t, "POST", "following/set", follow, 409, "")
	empty := jo.graph(t)
	follow.Kind, follow.TargetID = "graph", empty.ID
	jo.call(t, "POST", "following/set", follow, 409, "")
	follow.TargetID = id.Demo("graph", "cooking")
	jo.call(t, "POST", "following/set", follow, 200, "")
	state = false
	jo.call(t, "POST", "following/set", follow, 200, "")
	jo.call(t, "POST", "following/set", follow, 200, "")
	list := decode[catalogue.FollowingView](t, jo.call(t, "GET", "following/sources", nil, 200, ""))
	for _, uuid := range list.GraphIDs {
		if uuid == follow.TargetID {
			t.Fatal("取消关注未保存")
		}
	}

	// 重新装配 HTTP 服务，验证事实来自数据库而不是原 handler 的内存。
	s.server.Close()
	restarted := httptest.NewServer(HTTP(s.deps, slog.New(slog.NewTextHandler(io.Discard, nil))))
	t.Cleanup(restarted.Close)
	jo.url = restarted.URL
	refreshed := decode[identity.SessionView](t, jo.call(t, "GET", "auth/session", nil, 200, ""))
	if refreshed.User.Name != info.Name || len(refreshed.User.Highlights.ExpressionNodeIDs) != 0 {
		t.Fatal("刷新后资料或精选丢失")
	}
}
