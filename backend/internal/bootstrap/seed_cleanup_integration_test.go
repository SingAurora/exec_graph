package bootstrap

import (
	"context"
	"reflect"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/schema"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestRealDemoCleanupPreservesCredentialsAndAllowsFreshGraph(t *testing.T) {
	s := writeFixture(t)
	var before []model.UserCredential
	mustDB(t, s.deps.DB.Order("id").Find(&before))
	if len(before) != 7 {
		t.Fatalf("清理前应有 7 个凭据，实际 %d", len(before))
	}
	report, err := ClearDemo(context.Background(), s.deps)
	if err != nil {
		t.Fatal(err)
	}
	if report.Users != 7 || report.Actions != 37 || report.Graphs == 0 || report.MediaAssets != 7 {
		t.Fatalf("清理数量不符: %+v", report)
	}
	var after []model.UserCredential
	mustDB(t, s.deps.DB.Order("id").Find(&after))
	if !reflect.DeepEqual(before, after) {
		t.Fatal("清理改变了账号邮箱、密码或认证版本")
	}
	for _, value := range schema.Models() {
		var count int64
		mustDB(t, s.deps.DB.Model(value).Count(&count))
		expected := int64(0)
		switch value.(type) {
		case *model.User, *model.UserCredential:
			expected = 7
		}
		if count != expected {
			t.Fatalf("%T 清理后剩余 %d，期望 %d", value, count, expected)
		}
	}
	// 重复执行不应重新产生数据，也不应改变登录凭据。
	report, err = ClearDemo(context.Background(), s.deps)
	if err != nil || report.Total() != 0 {
		t.Fatalf("重复清理失败: %+v %v", report, err)
	}
	client := s.as(t, id.Demo("user", "jo"))
	client.call(t, "GET", "auth/session", nil, 200, "")
	page := decode[catalogue.GraphPageView](t, client.call(t, "GET", "graphs/getList?page=1&pageSize=100", nil, 200, ""))
	graphs := page.Items
	if len(graphs) != 0 {
		t.Fatal("清理后目录应为空")
	}
	if graph := client.graph(t); graph.ID == "" {
		t.Fatal("保留账号不能创建新图")
	}
}
