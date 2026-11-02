package action

import (
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// NodeDocuments 读取节点自己的表达/约定状态和草案。
func (t *actionTransaction) NodeDocuments(nodeID string) ([]app.NodeDocument, error) {
	var rows []model.NodeDocument
	if err := t.DB.Where("node_uuid = ?", nodeID).Order("kind").Find(&rows).Error; err != nil {
		return nil, err
	}
	documents := make([]app.NodeDocument, 0, len(rows))
	for _, row := range rows {
		document := app.NodeDocument{Kind: row.Kind, Status: row.Status, PublishedVersion: value(row.PublishedVersion), ErrorCode: value(row.ErrorCode), ErrorMessage: value(row.ErrorMessage)}
		if row.DraftMarkdown != nil {
			document.DraftMarkdown = *row.DraftMarkdown
		}
		documents = append(documents, document)
	}
	return documents, nil
}

// SaveNodeDocuments 覆盖指定节点的文档草案/状态；发布版本由 Revise 单独维护。
func (t *actionTransaction) SaveNodeDocuments(nodeID string, documents []app.NodeDocument) error {
	now := time.Now().UTC()
	for _, document := range documents {
		row := model.NodeDocument{Status: document.Status, ErrorCode: optional(document.ErrorCode), ErrorMessage: optional(document.ErrorMessage), UpdatedAt: now}
		if document.DraftMarkdown != "" {
			row.DraftMarkdown = &document.DraftMarkdown
		}
		updates := map[string]any{"status": document.Status, "draft_markdown": nil, "error_code": optional(document.ErrorCode), "error_message": optional(document.ErrorMessage), "updated_at": now}
		if document.DraftMarkdown != "" {
			updates["draft_markdown"] = document.DraftMarkdown
		}
		result := t.DB.Model(&model.NodeDocument{}).Where("node_uuid = ? AND kind = ?", nodeID, document.Kind).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			var node model.ActionNode
			if err := t.DB.Select("graph_uuid").Where("uuid = ?", nodeID).Take(&node).Error; err != nil {
				return err
			}
			row.UUID, row.NodeUUID, row.Kind, row.GraphUUID = id.New(), nodeID, document.Kind, node.GraphUUID
			if err := t.DB.Create(&row).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func value(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

// DocumentHistory 按类型和发布时间返回节点自己的已发布文档版本。
func (t *actionTransaction) DocumentHistory(nodeID string) ([]app.DocumentVersionView, error) {
	var rows []model.DocumentVersion
	if err := t.DB.Where("node_uuid = ?", nodeID).Order("kind, revision_number").Find(&rows).Error; err != nil {
		return nil, err
	}
	versions := make([]app.DocumentVersionView, 0, len(rows))
	for _, row := range rows {
		version := app.DocumentVersionView{Kind: row.Kind, Revision: row.RevisionNumber, Mode: row.Mode, Markdown: row.Markdown, ActorID: row.ActorUUID, ChangeKind: row.ChangeKind, CreatedAt: row.CreatedAt}
		if row.GenerationUUID != nil {
			version.GenerationID = *row.GenerationUUID
		}
		versions = append(versions, version)
	}
	return versions, nil
}
