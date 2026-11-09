package catalogue

import (
	"context"

	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// FeedNodeIDs 只选出内容流一页的具体节点。
func (r *Repository) FeedNodeIDs(ctx context.Context, kind string, offset, limit int) ([]string, int, error) {
	var total int64
	var ids []string
	switch kind {
	case "expressions":
		base := r.db.WithContext(ctx).Table("action_nodes AS n").
			Joins("JOIN graphs g ON g.uuid = n.graph_uuid AND g.deleted_at IS NULL").
			Joins("JOIN action_document_states s ON s.node_uuid = n.uuid AND s.kind = 'expression'").
			Joins("JOIN action_document_versions v ON v.uuid = s.effective_version_uuid").
			Where("TRIM(v.markdown) <> ''").
			Where("NOT EXISTS (SELECT 1 FROM action_references r WHERE r.graph_uuid = n.graph_uuid AND r.source_node_uuid = n.uuid)")
		if err := base.Count(&total).Error; err != nil {
			return nil, 0, err
		}
		rows, err := base.Select("n.uuid").Group("n.uuid").Order("MAX(n.created_at) DESC, n.uuid DESC").Offset(offset).Limit(limit).Rows()
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				return nil, 0, err
			}
			if id != "" {
				ids = append(ids, id)
			}
		}
		return ids, int(total), rows.Err()
	case "agreements":
		base := r.db.WithContext(ctx).Table("action_references AS r").
			Joins("JOIN graphs g ON g.uuid = r.graph_uuid AND g.deleted_at IS NULL").
			Joins("JOIN action_nodes AS target ON target.uuid = r.target_node_uuid").
			Joins("JOIN action_nodes AS source ON source.uuid = r.source_node_uuid").
			Joins("JOIN action_document_states AS s ON s.node_uuid = source.uuid AND s.kind = 'agreement'").
			Joins("JOIN action_document_versions AS v ON v.uuid = s.effective_version_uuid").
			Where("r.agreement_status = 'satisfied' AND source.author_uuid <> target.author_uuid AND TRIM(v.markdown) <> ''")
		if err := base.Distinct("r.target_node_uuid").Count(&total).Error; err != nil {
			return nil, 0, err
		}
		err := base.Select("target.uuid").Group("target.uuid").Order("MAX(target.created_at) DESC, target.uuid DESC").Offset(offset).Limit(limit).Pluck("target.uuid", &ids).Error
		return ids, int(total), err
	default:
		return nil, 0, fault.New(fault.Invalid, "内容流类型不合法")
	}
}
