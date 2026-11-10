package catalogue

import (
	"context"

	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"gorm.io/gorm"
)

func resourceRows(q *gorm.DB, offset, limit int) ([]string, int, error) {
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows, err := q.Select("n.uuid").Group("n.uuid").Order("MAX(n.created_at) DESC, n.uuid DESC").Offset(offset).Limit(limit).Rows()
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	ids := make([]string, 0, limit)
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
}

func agreementRows(q *gorm.DB, offset, limit int) ([]string, int, error) {
	var total int64
	if err := q.Distinct("r.target_node_uuid").Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows, err := q.Select("target.uuid").Group("target.uuid").Order("MAX(target.created_at) DESC, target.uuid DESC").Offset(offset).Limit(limit).Rows()
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	ids := make([]string, 0, limit)
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
}

// ProfileResourceNodeIDs 按资源选出个人主页当前页的种子节点。
func (r *Repository) ProfileResourceNodeIDs(ctx context.Context, userUUID, resource string, offset, limit int) ([]string, int, error) {
	db := r.db.WithContext(ctx)
	switch resource {
	case "action":
		q := db.Table("action_nodes AS n").Joins("JOIN graphs g ON g.uuid = n.graph_uuid AND g.deleted_at IS NULL").Where("n.author_uuid = ?", userUUID)
		return resourceRows(q, offset, limit)
	case "expression":
		q := db.Table("action_nodes AS n").
			Joins("JOIN graphs g ON g.uuid = n.graph_uuid AND g.deleted_at IS NULL").
			Joins("JOIN action_document_states s ON s.node_uuid = n.uuid AND s.kind = 'expression'").
			Joins("JOIN action_document_versions v ON v.uuid = s.effective_version_uuid").
			Where("n.author_uuid = ? AND TRIM(v.markdown) <> ''", userUUID).
			Where("NOT EXISTS (SELECT 1 FROM action_references r WHERE r.graph_uuid = n.graph_uuid AND r.source_node_uuid = n.uuid)")
		return resourceRows(q, offset, limit)
	case "agreement":
		q := db.Table("action_references AS r").
			Joins("JOIN graphs g ON g.uuid = r.graph_uuid AND g.deleted_at IS NULL").
			Joins("JOIN action_nodes AS target ON target.uuid = r.target_node_uuid").
			Joins("JOIN action_nodes AS source ON source.uuid = r.source_node_uuid").
			Joins("JOIN action_document_states s ON s.node_uuid = source.uuid AND s.kind = 'agreement'").
			Joins("JOIN action_document_versions v ON v.uuid = s.effective_version_uuid").
			Where("r.agreement_status = 'satisfied' AND source.author_uuid <> target.author_uuid AND TRIM(v.markdown) <> ''").
			Where("target.author_uuid = ? OR source.author_uuid = ?", userUUID, userUUID)
		return agreementRows(q, offset, limit)
	default:
		return nil, 0, fault.New(fault.Invalid, "个人主页资源类型不合法")
	}
}

// FollowingResourceNodeIDs 按资源选出关注页当前页的种子节点。
func (r *Repository) FollowingResourceNodeIDs(ctx context.Context, userUUID, resource string, offset, limit int) ([]string, int, error) {
	db := r.db.WithContext(ctx)
	scope := func(q *gorm.DB) *gorm.DB {
		return q.Where("(n.graph_uuid IN (SELECT graph_uuid FROM graph_follows WHERE user_uuid = ?) OR n.author_uuid IN (SELECT followed_user_uuid FROM user_follows WHERE follower_uuid = ?))", userUUID, userUUID)
	}
	switch resource {
	case "expression":
		q := db.Table("action_nodes AS n").
			Joins("JOIN graphs g ON g.uuid = n.graph_uuid AND g.deleted_at IS NULL").
			Joins("JOIN action_document_states s ON s.node_uuid = n.uuid AND s.kind = 'expression'").
			Joins("JOIN action_document_versions v ON v.uuid = s.effective_version_uuid").
			Where("TRIM(v.markdown) <> ''").
			Where("NOT EXISTS (SELECT 1 FROM action_references r WHERE r.graph_uuid = n.graph_uuid AND r.source_node_uuid = n.uuid)")
		q = scope(q)
		return resourceRows(q, offset, limit)
	case "agreement":
		q := db.Table("action_references AS r").
			Joins("JOIN graphs g ON g.uuid = r.graph_uuid AND g.deleted_at IS NULL").
			Joins("JOIN action_nodes AS target ON target.uuid = r.target_node_uuid").
			Joins("JOIN action_nodes AS source ON source.uuid = r.source_node_uuid").
			Joins("JOIN action_document_states s ON s.node_uuid = source.uuid AND s.kind = 'agreement'").
			Joins("JOIN action_document_versions v ON v.uuid = s.effective_version_uuid").
			Where("r.agreement_status = 'satisfied' AND source.author_uuid <> target.author_uuid AND TRIM(v.markdown) <> ''").
			Where("(target.graph_uuid IN (SELECT graph_uuid FROM graph_follows WHERE user_uuid = ?) OR target.author_uuid IN (SELECT followed_user_uuid FROM user_follows WHERE follower_uuid = ?) OR source.author_uuid IN (SELECT followed_user_uuid FROM user_follows WHERE follower_uuid = ?))", userUUID, userUUID, userUUID)
		return agreementRows(q, offset, limit)
	default:
		return nil, 0, fault.New(fault.Invalid, "关注资源类型不合法")
	}
}
