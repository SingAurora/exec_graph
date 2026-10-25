// Package catalogue 将 GORM 记录映射成明确的公开读取 DTO。
package catalogue

import (
	"context"
	"errors"
	"fmt"
	"net/url"

	app "github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"gorm.io/gorm"
)

// Repository 持有组合根注入的数据库连接。
type Repository struct{ db *gorm.DB }

// New 创建只读仓储。
func New(db *gorm.DB) *Repository { return &Repository{db: db} }

func (r *Repository) resolve(ctx context.Context, kind, value string) (string, error) {
	if id.Valid(value) {
		return value, nil
	}
	if value == "" || len(value) > 100 {
		return "", fault.New(fault.Invalid, "资源标识不合法")
	}
	var alias model.LegacyAlias
	err := r.db.WithContext(ctx).Where("kind = ? AND alias = ?", kind, value).Take(&alias).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", fault.New(fault.NotFound, "资源不存在")
	}
	return alias.ResourceUUID, err
}

// MediaURL 生成稳定站内地址，不保存临时签名 URL。
func MediaURL(uuid *string) *string {
	if uuid == nil {
		return nil
	}
	value := "/api/commands/media/file?assetId=" + url.QueryEscape(*uuid)
	return &value
}

// Profiles 只读取公开字段，不把凭据、邮箱或测试标记发往公开目录。
func (r *Repository) Profiles(ctx context.Context) ([]app.ProfileView, error) {
	var users []model.User
	if err := r.db.WithContext(ctx).Where("disabled_at IS NULL").Order("id").Find(&users).Error; err != nil {
		return nil, fmt.Errorf("读取公开用户: %w", err)
	}
	return r.profiles(ctx, users)
}

// Profile 返回指定用户的公开部分，供账户用例组合私有字段。
func (r *Repository) Profile(ctx context.Context, uuid string) (app.ProfileView, error) {
	var user model.User
	err := r.db.WithContext(ctx).Where("uuid = ?", uuid).Take(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return app.ProfileView{}, fault.New(fault.NotFound, "用户不存在")
	}
	if err != nil {
		return app.ProfileView{}, err
	}
	views, err := r.profiles(ctx, []model.User{user})
	if err != nil {
		return app.ProfileView{}, err
	}
	return views[0], nil
}

func (r *Repository) profiles(ctx context.Context, users []model.User) ([]app.ProfileView, error) {
	views := make([]app.ProfileView, 0, len(users))
	ids := make([]string, 0, len(users))
	for _, u := range users {
		ids = append(ids, u.UUID)
	}
	if len(ids) == 0 {
		return views, nil
	}
	var nodes []model.ActionNode
	if err := r.db.WithContext(ctx).Table("action_nodes AS n").Select("n.author_uuid, n.created_at").Joins("JOIN graphs g ON g.uuid = n.graph_uuid").Where("g.deleted_at IS NULL AND n.author_uuid IN ?", ids).Find(&nodes).Error; err != nil {
		return nil, err
	}
	days := map[string]map[string]bool{}
	for _, n := range nodes {
		if days[n.AuthorUUID] == nil {
			days[n.AuthorUUID] = map[string]bool{}
		}
		days[n.AuthorUUID][n.CreatedAt.UTC().Format("2006-01-02")] = true
	}
	var highlights []model.ProfileHighlight
	if err := r.db.WithContext(ctx).Table("profile_highlights AS h").Select("h.*").Joins("JOIN action_nodes n ON n.uuid = h.node_uuid").Joins("JOIN graphs g ON g.uuid = n.graph_uuid").Joins("JOIN action_document_states s ON s.node_uuid = n.uuid AND s.kind = 'expression'").Joins("JOIN action_document_versions v ON v.uuid = s.effective_version_uuid").Where("h.user_uuid IN ? AND g.deleted_at IS NULL AND v.mode = ?", ids, "update").Order("h.position").Find(&highlights).Error; err != nil {
		return nil, err
	}
	selected := map[string][]string{}
	for _, h := range highlights {
		selected[h.UserUUID] = append(selected[h.UserUUID], h.NodeUUID)
	}
	for _, u := range users {
		avatar := ""
		if image := MediaURL(u.AvatarAssetUUID); image != nil {
			avatar = *image
		}
		list := selected[u.UUID]
		if list == nil {
			list = []string{}
		}
		views = append(views, app.ProfileView{ID: u.UUID, Name: u.Name, Gender: u.Gender, Bio: u.BiographyMarkdown, Avatar: avatar, BackgroundImage: MediaURL(u.CoverAssetUUID), ActiveDays: len(days[u.UUID]), Highlights: app.Highlights{ExpressionNodeIDs: list}})
	}
	return views, nil
}

// Graphs 从实际行动作者推导参与人，过滤已删除图。
func (r *Repository) Graphs(ctx context.Context) ([]app.GraphView, error) {
	var graphs []model.Graph
	if err := r.db.WithContext(ctx).Where("deleted_at IS NULL").Order("created_at DESC, uuid DESC").Find(&graphs).Error; err != nil {
		return nil, err
	}
	return r.graphs(ctx, graphs)
}

// Graph 支持显式演示 alias 到 UUID 映射。
func (r *Repository) Graph(ctx context.Context, value string) (app.GraphView, error) {
	uuid, err := r.resolve(ctx, "graph", value)
	if err != nil {
		return app.GraphView{}, err
	}
	var graph model.Graph
	err = r.db.WithContext(ctx).Where("uuid = ? AND deleted_at IS NULL", uuid).Take(&graph).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return app.GraphView{}, fault.New(fault.NotFound, "行动图不存在")
	}
	if err != nil {
		return app.GraphView{}, err
	}
	views, err := r.graphs(ctx, []model.Graph{graph})
	if err != nil {
		return app.GraphView{}, err
	}
	return views[0], nil
}

func (r *Repository) graphs(ctx context.Context, graphs []model.Graph) ([]app.GraphView, error) {
	result := make([]app.GraphView, 0, len(graphs))
	ids := []string{}
	for _, g := range graphs {
		ids = append(ids, g.UUID)
	}
	if len(ids) == 0 {
		return result, nil
	}
	var members []model.ActionNode
	if err := r.db.WithContext(ctx).Select("graph_uuid, author_uuid").Where("graph_uuid IN ?", ids).Group("graph_uuid, author_uuid").Order("author_uuid").Find(&members).Error; err != nil {
		return nil, err
	}
	participants := map[string][]string{}
	for _, m := range members {
		participants[m.GraphUUID] = append(participants[m.GraphUUID], m.AuthorUUID)
	}
	for _, g := range graphs {
		people := participants[g.UUID]
		if people == nil {
			people = []string{}
		}
		result = append(result, app.GraphView{ID: g.UUID, OwnerID: g.OwnerUUID, ParticipantIDs: people, Title: g.Title, Description: g.Description, Avatar: MediaURL(g.AvatarAssetUUID), BackgroundImage: MediaURL(g.CoverAssetUUID), ContextGuide: g.ContextGuide, Version: g.Version, CreatedAt: g.CreatedAt, UpdatedAt: g.UpdatedAt})
	}
	return result, nil
}

// Following 过滤已不可用的用户和图。
func (r *Repository) Following(ctx context.Context, uuid string) (app.FollowingView, error) {
	out := app.FollowingView{UserIDs: []string{}, GraphIDs: []string{}}
	if err := r.db.WithContext(ctx).Table("user_follows AS f").Joins("JOIN users u ON u.uuid = f.followed_user_uuid AND u.disabled_at IS NULL").Where("f.follower_uuid = ?", uuid).Order("f.id").Pluck("f.followed_user_uuid", &out.UserIDs).Error; err != nil {
		return out, err
	}
	err := r.db.WithContext(ctx).Table("graph_follows AS f").Joins("JOIN graphs g ON g.uuid = f.graph_uuid AND g.deleted_at IS NULL").Where("f.user_uuid = ?", uuid).Order("f.id").Pluck("f.graph_uuid", &out.GraphIDs).Error
	return out, err
}

// Media 只解析合法、已就绪的站内资源 UUID。
func (r *Repository) Media(ctx context.Context, uuid string) (app.MediaMetadata, error) {
	if !id.Valid(uuid) {
		return app.MediaMetadata{}, fault.New(fault.Invalid, "图片标识不合法")
	}
	var asset model.MediaAsset
	err := r.db.WithContext(ctx).Where("uuid = ? AND status = ? AND deleted_at IS NULL", uuid, "ready").Take(&asset).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return app.MediaMetadata{}, fault.New(fault.NotFound, "图片不存在")
	}
	if err != nil {
		return app.MediaMetadata{}, err
	}
	if asset.MIMEType == nil {
		return app.MediaMetadata{}, fmt.Errorf("图片元信息不完整")
	}
	return app.MediaMetadata{ObjectKey: asset.ObjectKey, MIMEType: *asset.MIMEType}, nil
}
