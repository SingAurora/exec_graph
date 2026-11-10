package catalogue

import (
	"context"

	app "github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
)

// NodeContext 只读取一组节点及其所有直接/间接祖先的完整行动视图。
func (r *Repository) NodeContext(ctx context.Context, seedIDs []string) ([]app.ActionView, error) {
	if len(seedIDs) == 0 {
		return []app.ActionView{}, nil
	}
	rows, err := r.db.WithContext(ctx).Raw(`WITH RECURSIVE chain(uuid) AS (
			SELECT uuid FROM action_nodes WHERE uuid IN ?
			UNION
			SELECT ref.source_node_uuid FROM action_references ref JOIN chain c ON ref.target_node_uuid = c.uuid
		)
		SELECT uuid FROM chain`, seedIDs).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	all := make([]string, 0, len(seedIDs))
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		all = append(all, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	var nodes []model.ActionNode
	if err := r.db.WithContext(ctx).Where("uuid IN ?", all).Find(&nodes).Error; err != nil {
		return nil, err
	}
	return r.actions(ctx, nodes)
}
