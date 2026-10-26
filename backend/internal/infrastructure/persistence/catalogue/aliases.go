package catalogue

import (
	"context"

	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
)

// aliases 只返回显式导入的旧资源标识，供前端保留深链接和本地草稿键。
func (r *Repository) aliases(ctx context.Context, kind string, ids []string) (map[string]string, error) {
	result := map[string]string{}
	var rows []model.LegacyAlias
	if len(ids) == 0 {
		return result, nil
	}
	if err := r.db.WithContext(ctx).Where("kind = ? AND resource_uuid IN ?", kind, ids).Order("alias").Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.ResourceUUID] = row.Alias
	}
	return result, nil
}
