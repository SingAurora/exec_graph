package media

import (
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"gorm.io/gorm"
)

// references 检查全部显式图片位置；清理时连软删除内容与历史文档一起保护。
func references(db *gorm.DB, uuid string, public bool) (bool, error) {
	users := db.Model(&model.User{}).Where("avatar_asset_uuid = ? OR cover_asset_uuid = ?", uuid, uuid)
	graphs := db.Model(&model.Graph{}).Where("avatar_asset_uuid = ? OR cover_asset_uuid = ?", uuid, uuid)
	actions := db.Table("action_images AS i").Where("i.asset_uuid = ?", uuid)
	documents := db.Table("document_images AS i").Where("i.asset_uuid = ?", uuid)
	biographies := db.Table("profile_biography_images AS i").Where("i.asset_uuid = ?", uuid)
	if public {
		users = users.Where("disabled_at IS NULL")
		graphs = graphs.Where("deleted_at IS NULL")
		actions = actions.Joins("JOIN action_nodes n ON n.uuid = i.node_uuid").Joins("JOIN graphs g ON g.uuid = n.graph_uuid AND g.deleted_at IS NULL")
		documents = documents.Joins("JOIN action_document_versions v ON v.uuid = i.document_version_uuid").Joins("JOIN graphs g ON g.uuid = v.graph_uuid AND g.deleted_at IS NULL")
		biographies = biographies.Joins("JOIN users u ON u.uuid = i.user_uuid AND u.disabled_at IS NULL")
	}
	for _, query := range []*gorm.DB{users, graphs, actions, documents, biographies} {
		var count int64
		if err := query.Count(&count).Error; err != nil {
			return false, err
		}
		if count > 0 {
			return true, nil
		}
	}
	return false, nil
}
