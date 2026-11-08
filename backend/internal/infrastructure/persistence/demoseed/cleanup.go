package demoseed

import (
	"context"
	"fmt"

	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"gorm.io/gorm"
)

const demoDataset = "frontend-demo-v1"

// CleanupReport 记录一次演示数据清理实际删除的记录数。
type CleanupReport struct {
	Users             int64
	ProfilesReset     int64
	Graphs            int64
	Actions           int64
	DocumentVersions  int64
	DocumentStates    int64
	References        int64
	Conversations     int64
	Messages          int64
	Generations       int64
	GenerationLinks   int64
	GenerationSources int64
	Highlights        int64
	UserFollows       int64
	GraphFollows      int64
	Idempotency       int64
	ActionImages      int64
	DocumentImages    int64
	BiographyImages   int64
	MediaRetention    int64
	MediaAssets       int64
	SeedImports       int64
}

// Total 返回删除的业务记录总数，不包含保留的测试账号和凭据。
func (r CleanupReport) Total() int64 {
	return r.Graphs + r.Actions + r.DocumentVersions + r.DocumentStates + r.References +
		r.Conversations + r.Messages + r.Generations + r.GenerationLinks + r.GenerationSources +
		r.Highlights + r.UserFollows + r.GraphFollows + r.Idempotency + r.ActionImages +
		r.DocumentImages + r.BiographyImages + r.MediaRetention + r.MediaAssets + r.SeedImports
}

// Cleanup 清空指定演示账号名下的业务数据（含后续手动创建的内容），保留账号及其登录凭据。
// 测试账号本身仍可用于登录，之后可以从空账号状态手动创建真实数据。
func (r *Repository) Cleanup(ctx context.Context, dataset string) (CleanupReport, error) {
	if dataset == "" {
		dataset = demoDataset
	}
	var report CleanupReport
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var users []model.User
		if err := tx.Where("is_test_account = ? AND test_dataset = ?", true, dataset).Find(&users).Error; err != nil {
			return fmt.Errorf("读取演示账号: %w", err)
		}
		if len(users) == 0 {
			return nil
		}
		userIDs := make([]string, 0, len(users))
		for _, user := range users {
			userIDs = append(userIDs, user.UUID)
		}

		var graphs []model.Graph
		if err := tx.Where("owner_uuid IN ?", userIDs).Find(&graphs).Error; err != nil {
			return fmt.Errorf("读取演示图: %w", err)
		}
		graphIDs := make([]string, 0, len(graphs))
		for _, graph := range graphs {
			graphIDs = append(graphIDs, graph.UUID)
		}

		var actions []model.ActionNode
		query := tx.Where("author_uuid IN ?", userIDs)
		if len(graphIDs) > 0 {
			query = query.Or("graph_uuid IN ?", graphIDs)
		}
		if err := query.Find(&actions).Error; err != nil {
			return fmt.Errorf("读取演示行动: %w", err)
		}
		actionIDs := make([]string, 0, len(actions))
		for _, action := range actions {
			actionIDs = append(actionIDs, action.UUID)
		}

		var documents []model.DocumentVersion
		query = tx.Where("actor_uuid IN ?", userIDs)
		if len(graphIDs) > 0 {
			query = query.Or("graph_uuid IN ?", graphIDs)
		}
		if len(actionIDs) > 0 {
			query = query.Or("node_uuid IN ?", actionIDs)
		}
		if err := query.Find(&documents).Error; err != nil {
			return fmt.Errorf("读取演示文档: %w", err)
		}
		documentIDs := make([]string, 0, len(documents))
		for _, document := range documents {
			documentIDs = append(documentIDs, document.UUID)
		}

		var conversations []model.AIConversation
		query = tx.Where("owner_uuid IN ?", userIDs)
		if len(graphIDs) > 0 {
			query = query.Or("graph_uuid IN ?", graphIDs)
		}
		if len(actionIDs) > 0 {
			query = query.Or("node_uuid IN ?", actionIDs)
		}
		if err := query.Find(&conversations).Error; err != nil {
			return fmt.Errorf("读取演示对话: %w", err)
		}
		conversationIDs := make([]string, 0, len(conversations))
		for _, conversation := range conversations {
			conversationIDs = append(conversationIDs, conversation.UUID)
		}

		var generations []model.AIGeneration
		query = tx.Where("requested_by_uuid IN ?", userIDs)
		if len(graphIDs) > 0 {
			query = query.Or("graph_uuid IN ?", graphIDs)
		}
		if len(conversationIDs) > 0 {
			query = query.Or("conversation_uuid IN ?", conversationIDs)
		}
		if err := query.Find(&generations).Error; err != nil {
			return fmt.Errorf("读取演示生成记录: %w", err)
		}
		generationIDs := make([]string, 0, len(generations))
		for _, generation := range generations {
			generationIDs = append(generationIDs, generation.UUID)
		}

		var assets []model.MediaAsset
		query = tx.Where("owner_uuid IN ?", userIDs).Or("object_key LIKE ?", "demo/v1/%")
		if len(graphIDs) > 0 {
			query = query.Or("uuid IN (SELECT avatar_asset_uuid FROM graphs WHERE uuid IN ? AND avatar_asset_uuid IS NOT NULL)", graphIDs)
			query = query.Or("uuid IN (SELECT cover_asset_uuid FROM graphs WHERE uuid IN ? AND cover_asset_uuid IS NOT NULL)", graphIDs)
		}
		if err := query.Find(&assets).Error; err != nil {
			return fmt.Errorf("读取演示图片: %w", err)
		}
		assetIDs := make([]string, 0, len(assets))
		for _, asset := range assets {
			assetIDs = append(assetIDs, asset.UUID)
		}

		// 清空简介及演示图片引用；姓名、性别、账号标记及登录凭据保留。
		result := tx.Model(&model.User{}).Where("uuid IN ?", userIDs).Select("AvatarAssetUUID", "CoverAssetUUID", "BiographyMarkdown").Updates(model.User{BiographyMarkdown: ""})
		if result.Error != nil {
			return fmt.Errorf("清空测试账号演示资料: %w", result.Error)
		}
		report.ProfilesReset = result.RowsAffected

		var err error
		if report.ActionImages, err = deleteCount(tx, &model.ActionImage{}, "node_uuid IN ?", actionIDs); err != nil {
			return err
		}
		if report.DocumentImages, err = deleteCount(tx, &model.DocumentImage{}, "document_version_uuid IN ?", documentIDs); err != nil {
			return err
		}
		if report.BiographyImages, err = deleteCount(tx, &model.BiographyImage{}, "user_uuid IN ?", userIDs); err != nil {
			return err
		}
		if report.GenerationLinks, err = deleteCount(tx, &model.GenerationMessage{}, "generation_uuid IN ? OR conversation_uuid IN ?", generationIDs, conversationIDs); err != nil {
			return err
		}
		if report.GenerationSources, err = deleteCount(tx, &model.GenerationSource{}, "generation_uuid IN ? OR graph_uuid IN ?", generationIDs, graphIDs); err != nil {
			return err
		}
		if report.Messages, err = deleteCount(tx, &model.AIMessage{}, "conversation_uuid IN ?", conversationIDs); err != nil {
			return err
		}
		if report.Generations, err = deleteCount(tx, &model.AIGeneration{}, "uuid IN ?", generationIDs); err != nil {
			return err
		}
		if report.Conversations, err = deleteCount(tx, &model.AIConversation{}, "uuid IN ?", conversationIDs); err != nil {
			return err
		}
		if report.References, err = deleteCount(tx, &model.ActionReference{}, "graph_uuid IN ? OR source_node_uuid IN ? OR target_node_uuid IN ?", graphIDs, actionIDs, actionIDs); err != nil {
			return err
		}
		if report.DocumentStates, err = deleteCount(tx, &model.DocumentState{}, "graph_uuid IN ? OR node_uuid IN ?", graphIDs, actionIDs); err != nil {
			return err
		}
		if report.DocumentVersions, err = deleteCount(tx, &model.DocumentVersion{}, "uuid IN ?", documentIDs); err != nil {
			return err
		}
		if report.Idempotency, err = deleteCount(tx, &model.IdempotencyRecord{}, "user_uuid IN ?", userIDs); err != nil {
			return err
		}
		if report.Highlights, err = deleteCount(tx, &model.ProfileHighlight{}, "user_uuid IN ? OR node_uuid IN ?", userIDs, actionIDs); err != nil {
			return err
		}
		if report.UserFollows, err = deleteCount(tx, &model.UserFollow{}, "follower_uuid IN ? OR followed_user_uuid IN ?", userIDs, userIDs); err != nil {
			return err
		}
		if report.GraphFollows, err = deleteCount(tx, &model.GraphFollow{}, "user_uuid IN ? OR graph_uuid IN ?", userIDs, graphIDs); err != nil {
			return err
		}
		if report.Actions, err = deleteCount(tx, &model.ActionNode{}, "uuid IN ?", actionIDs); err != nil {
			return err
		}
		if report.Graphs, err = deleteCount(tx, &model.Graph{}, "uuid IN ?", graphIDs); err != nil {
			return err
		}
		if report.MediaRetention, err = deleteCount(tx, &model.MediaRetention{}, "asset_uuid IN ?", assetIDs); err != nil {
			return err
		}
		if report.MediaAssets, err = deleteCount(tx, &model.MediaAsset{}, "uuid IN ?", assetIDs); err != nil {
			return err
		}
		if report.SeedImports, err = deleteCount(tx, &model.SeedImport{}, "dataset = ?", dataset); err != nil {
			return err
		}
		report.Users = int64(len(users))
		return nil
	})
	if err != nil {
		return CleanupReport{}, fmt.Errorf("清理演示数据失败: %w", err)
	}
	return report, nil
}

func deleteCount(tx *gorm.DB, value any, query string, args ...any) (int64, error) {
	result := tx.Where(query, args...).Delete(value)
	if result.Error != nil {
		return 0, fmt.Errorf("删除 %T: %w", value, result.Error)
	}
	return result.RowsAffected, nil
}
