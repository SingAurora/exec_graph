package action

import (
	"gorm.io/gorm"

	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
)

// DeleteNode 清理终端节点的文档、图片和引用关系；调用方已持有图锁并验证终端状态。
func (t *actionTransaction) DeleteNode(graphID, nodeID string) error {
	return t.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("graph_uuid = ? AND node_uuid = ?", graphID, nodeID).Delete(&model.NodeDocument{}).Error; err != nil {
			return err
		}
		if err := tx.Where("graph_uuid = ? AND node_uuid = ?", graphID, nodeID).Delete(&model.DocumentState{}).Error; err != nil {
			return err
		}
		if err := tx.Where("graph_uuid = ? AND node_uuid = ?", graphID, nodeID).Delete(&model.DocumentVersion{}).Error; err != nil {
			return err
		}
		if err := tx.Where("graph_uuid = ? AND (source_node_uuid = ? OR target_node_uuid = ?)", graphID, nodeID, nodeID).Delete(&model.ActionReference{}).Error; err != nil {
			return err
		}
		if err := tx.Where("node_uuid = ?", nodeID).Delete(&model.ActionImage{}).Error; err != nil {
			return err
		}
		return tx.Where("uuid = ? AND graph_uuid = ?", nodeID, graphID).Delete(&model.ActionNode{}).Error
	})
}
