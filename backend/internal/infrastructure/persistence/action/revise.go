package action

import (
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func (t *actionTransaction) Revise(r app.Revision) error {
	now, uuid := time.Now().UTC(), id.New()
	text := ""
	if r.Document.Markdown != nil {
		text = *r.Document.Markdown
	}
	doc := model.DocumentVersion{UUID: uuid, GraphUUID: r.GraphID, NodeUUID: r.NodeID, Kind: r.Kind, RevisionNumber: r.Number, Mode: r.Document.Mode, ChangeKind: r.ChangeKind, Markdown: text, ActorUUID: r.ActorID, GenerationUUID: pointer(r.GenerationID), PreviousVersionUUID: pointer(r.Previous.ID), CreatedAt: now}
	if err := t.DB.Create(&doc).Error; err != nil {
		return err
	}
	// 首次写入时状态行可能还不存在；必须真正创建，否则后续版本号会从 0 重新计算并撞唯一键。
	state := model.DocumentState{GraphUUID: r.GraphID, NodeUUID: r.NodeID, Kind: r.Kind}
	if err := t.DB.Where("node_uuid = ? AND kind = ?", r.NodeID, r.Kind).Assign(map[string]any{
		"graph_uuid": r.GraphID, "mode": r.Document.Mode, "local_version_uuid": uuid,
		"effective_version_uuid": uuid, "updated_at": now,
	}).FirstOrCreate(&state).Error; err != nil {
		return err
	}
	if err := t.DB.Model(&model.ActionNode{}).Where("uuid = ?", r.NodeID).Updates(model.ActionNode{Version: r.ExpectedVersion + 1, UpdatedAt: now}).Error; err != nil {
		return err
	}
	// 使用 map 更新，确保 draft_markdown 被真正清空；GORM 的结构体更新会跳过 nil 字段。
	result := t.DB.Model(&model.NodeDocument{}).Where("node_uuid = ? AND kind = ?", r.NodeID, r.Kind).Updates(map[string]any{
		"status": "published", "draft_markdown": nil, "published_version_uuid": uuid,
		"error_code": nil, "error_message": nil, "updated_at": now,
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return t.DB.Create(&model.NodeDocument{UUID: id.New(), GraphUUID: r.GraphID, NodeUUID: r.NodeID, Kind: r.Kind, Status: "published", PublishedVersion: &uuid, CreatedAt: now, UpdatedAt: now}).Error
	}
	return nil
}
