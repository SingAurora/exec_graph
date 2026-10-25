package bootstrap

import (
	"context"
	"fmt"
	app "github.com/singaurora/exec-graph/backend/internal/application/demoseed"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/demoseed"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/schema"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/security"
)

// SeedDemo 仅由管理命令显式调用，密码只用于计算哈希，不写入日志或文件。
func SeedDemo(ctx context.Context, deps *Dependencies, password string) (string, error) {
	if deps.Config.App.Environment == "production" {
		return "", fmt.Errorf("生产环境禁止导入演示账号")
	}
	if err := schema.Check(ctx, deps.DB); err != nil {
		return "", err
	}
	source, digest, err := demoseed.Load()
	if err != nil {
		return "", err
	}
	data, err := app.Prepare(source, digest, password, security.Passwords{})
	if err != nil {
		return "", err
	}
	changed, err := demoseed.New(deps.DB).Import(ctx, data)
	if err != nil {
		return "", err
	}
	if !changed {
		return "演示批次已存在，未覆盖账号、凭据或业务数据", nil
	}
	return fmt.Sprintf("导入完成：%d 个数据库标记测试用户、%d 张图、%d 条行动", len(data.Users), len(data.Graphs), len(data.Nodes)), nil
}
