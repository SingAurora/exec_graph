// Package catalogue 将 GORM 记录映射成明确的公开读取 DTO。
package catalogue

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	sharedlocation "github.com/singaurora/exec-graph/backend/internal/shared/location"
	"github.com/singaurora/exec-graph/backend/internal/shared/timezone"
	"gorm.io/gorm"
)

// Repository 持有组合根注入的数据库连接。
type Repository struct{ db *gorm.DB }

// New 创建只读仓储。
func New(db *gorm.DB) *Repository { return &Repository{db: db} }

func (r *Repository) resolve(ctx context.Context, kind, value string) (string, error) {
	_ = ctx
	_ = kind
	if !id.Valid(value) {
		return "", fault.New(fault.Invalid, "资源标识必须是 UUID")
	}
	return value, nil
}

// MediaURL 生成稳定站内地址，不保存临时签名 URL。
func MediaURL(uuid *string) *string {
	if uuid == nil {
		return nil
	}
	value := "/api/commands/media/file?assetUuid=" + url.QueryEscape(*uuid)
	return &value
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
	var credentials []model.UserCredential
	if err := r.db.WithContext(ctx).Where("user_uuid IN ?", ids).Find(&credentials).Error; err != nil {
		return nil, fmt.Errorf("读取用户邮箱: %w", err)
	}
	emails := make(map[string]string, len(credentials))
	for _, credential := range credentials {
		emails[credential.UserUUID] = credential.Email
	}
	var nodes []model.ActionNode
	if err := r.db.WithContext(ctx).Table("action_nodes AS n").Select("n.author_uuid, n.created_at").Joins("JOIN graphs g ON g.uuid = n.graph_uuid").Where("g.deleted_at IS NULL AND n.author_uuid IN ?", ids).Find(&nodes).Error; err != nil {
		return nil, err
	}
	days := map[string]map[string]bool{}
	latest := map[string]time.Time{}
	for _, n := range nodes {
		if days[n.AuthorUUID] == nil {
			days[n.AuthorUUID] = map[string]bool{}
		}
		days[n.AuthorUUID][n.CreatedAt.In(timezone.China).Format("2006-01-02")] = true
		if value, ok := latest[n.AuthorUUID]; !ok || n.CreatedAt.After(value) {
			latest[n.AuthorUUID] = n.CreatedAt
		}
	}
	var highlights []model.ProfileHighlight
	if err := r.db.WithContext(ctx).Table("profile_highlights AS h").Select("h.*").Joins("JOIN action_nodes n ON n.uuid = h.node_uuid").Joins("JOIN graphs g ON g.uuid = n.graph_uuid").Joins("JOIN action_document_states s ON s.node_uuid = n.uuid AND s.kind = 'expression'").Joins("JOIN action_document_versions v ON v.uuid = s.effective_version_uuid").Joins("LEFT JOIN action_document_versions lv ON lv.uuid = s.local_version_uuid").Where("h.user_uuid IN ? AND g.deleted_at IS NULL AND v.mode = ? AND v.actor_uuid = h.user_uuid AND (n.author_uuid = h.user_uuid OR lv.actor_uuid = h.user_uuid)", ids, "update").Order("h.position").Find(&highlights).Error; err != nil {
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
		var recentActionAt *time.Time
		if value, ok := latest[u.UUID]; ok {
			china := timezone.InChina(value)
			recentActionAt = &china
		}
		var profileLocation *app.LocationView
		if u.LocationCode != nil {
			if value, ok := sharedlocation.Lookup(*u.LocationCode); ok {
				profileLocation = &app.LocationView{Code: value.Code, ProvinceCode: value.ProvinceCode, Province: value.Province, CityCode: value.CityCode, City: value.City, DistrictCode: value.DistrictCode, District: value.District}
			}
		}
		views = append(views, app.ProfileView{ID: u.UUID, Name: u.Name, Email: emails[u.UUID], Gender: u.Gender, Bio: u.BiographyMarkdown, Location: profileLocation, Avatar: avatar, BackgroundImage: MediaURL(u.CoverAssetUUID), AvatarAssetID: u.AvatarAssetUUID, BackgroundAssetID: u.CoverAssetUUID, ActiveDays: len(days[u.UUID]), RecentActionAt: recentActionAt, Highlights: app.Highlights{ExpressionNodeIDs: list}})
	}
	return views, nil
}

// Graphs 从实际行动作者推导参与人，过滤已删除图。
// GraphsPage 在数据库层筛选、排序和分页图目录。
func (r *Repository) GraphsPage(ctx context.Context, filter, keyword, order, userUUID string, offset, limit int) ([]app.GraphView, int, error) {
	query := r.db.WithContext(ctx).Model(&model.Graph{}).Where("graphs.deleted_at IS NULL")
	switch filter {
	case "owned":
		query = query.Where("graphs.owner_uuid = ?", userUUID)
	case "joined":
		query = query.Where("EXISTS (SELECT 1 FROM action_nodes n WHERE n.graph_uuid = graphs.uuid AND n.author_uuid = ?)", userUUID)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(graphs.title LIKE ? OR graphs.description LIKE ?)", like, like)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	activity := "COALESCE((SELECT MAX(n.created_at) FROM action_nodes n WHERE n.graph_uuid = graphs.uuid), graphs.created_at)"
	switch order {
	case "created":
		query = query.Order("graphs.created_at DESC, graphs.uuid DESC")
	case "name":
		query = query.Order("graphs.title ASC, graphs.uuid ASC")
	default:
		query = query.Order(activity + " DESC, graphs.uuid DESC")
	}
	var rows []model.Graph
	if err := query.Offset(offset).Limit(limit).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	views, err := r.graphs(ctx, rows)
	return views, int(total), err
}

// GraphsForAuthor 只读取某用户实际参与过的图。
func (r *Repository) GraphsForAuthor(ctx context.Context, userUUID string) ([]app.GraphView, error) {
	var rows []model.Graph
	err := r.db.WithContext(ctx).Where("deleted_at IS NULL AND EXISTS (SELECT 1 FROM action_nodes n WHERE n.graph_uuid = graphs.uuid AND n.author_uuid = ?)", userUUID).Order("created_at DESC, uuid DESC").Find(&rows).Error
	if err != nil {
		return nil, err
	}
	return r.graphs(ctx, rows)
}

// GraphsForFollowing 只读取关注图或关注用户参与过的图。
func (r *Repository) GraphsForFollowing(ctx context.Context, userUUID string) ([]app.GraphView, error) {
	var rows []model.Graph
	err := r.db.WithContext(ctx).Where("deleted_at IS NULL AND (EXISTS (SELECT 1 FROM graph_follows f WHERE f.graph_uuid = graphs.uuid AND f.user_uuid = ?) OR EXISTS (SELECT 1 FROM action_nodes n JOIN user_follows uf ON uf.followed_user_uuid = n.author_uuid AND uf.follower_uuid = ? WHERE n.graph_uuid = graphs.uuid))", userUUID, userUUID).Order("created_at DESC, uuid DESC").Find(&rows).Error
	if err != nil {
		return nil, err
	}
	return r.graphs(ctx, rows)
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
	type graphStat struct {
		GraphUUID    string
		ActionCount  int
		LastActionAt *time.Time
	}
	var stats []graphStat
	if err := r.db.WithContext(ctx).Table("action_nodes").Select("graph_uuid, COUNT(*) AS action_count, MAX(created_at) AS last_action_at").Where("graph_uuid IN ?", ids).Group("graph_uuid").Scan(&stats).Error; err != nil {
		return nil, err
	}
	actionCounts, lastActions := map[string]int{}, map[string]*time.Time{}
	for _, stat := range stats {
		actionCounts[stat.GraphUUID] = stat.ActionCount
		lastActions[stat.GraphUUID] = stat.LastActionAt
	}
	type expressionStat struct {
		GraphUUID       string
		ExpressionCount int
	}
	var expressions []expressionStat
	if err := r.db.WithContext(ctx).Table("action_nodes AS n").
		Select("n.graph_uuid, COUNT(*) AS expression_count").
		Joins("JOIN action_document_states s ON s.node_uuid = n.uuid AND s.kind = 'expression'").
		Joins("JOIN action_document_versions v ON v.uuid = s.effective_version_uuid").
		Where("n.graph_uuid IN ? AND TRIM(v.markdown) <> ''", ids).
		Where("NOT EXISTS (SELECT 1 FROM action_references r WHERE r.graph_uuid = n.graph_uuid AND r.source_node_uuid = n.uuid)").
		Group("n.graph_uuid").Scan(&expressions).Error; err != nil {
		return nil, err
	}
	expressionCounts := map[string]int{}
	for _, stat := range expressions {
		expressionCounts[stat.GraphUUID] = stat.ExpressionCount
	}
	for _, g := range graphs {
		people := participants[g.UUID]
		if people == nil {
			people = []string{}
		}
		var lastActionAt *time.Time
		if value := lastActions[g.UUID]; value != nil {
			china := timezone.InChina(*value)
			lastActionAt = &china
		}
		result = append(result, app.GraphView{ID: g.UUID, OwnerID: g.OwnerUUID, ParticipantIDs: people, ActionCount: actionCounts[g.UUID], ExpressionCount: expressionCounts[g.UUID], ParticipantCount: len(people), LastActionAt: lastActionAt, Title: g.Title, Description: g.Description, Avatar: MediaURL(g.AvatarAssetUUID), BackgroundImage: MediaURL(g.CoverAssetUUID), AvatarAssetID: g.AvatarAssetUUID, BackgroundAssetID: g.CoverAssetUUID, ContextGuide: g.ContextGuide, Version: g.Version, CreatedAt: timezone.InChina(g.CreatedAt), UpdatedAt: timezone.InChina(g.UpdatedAt)})
	}
	return result, nil
}

// ProfileStats 计算侧栏统计，不读取完整行动上下文。
func (r *Repository) ProfileStats(ctx context.Context, userUUID string) (app.ProfileStatsView, error) {
	var out app.ProfileStatsView
	var actions int64
	if err := r.db.WithContext(ctx).Table("action_nodes").Where("author_uuid = ?", userUUID).Count(&actions).Error; err != nil {
		return out, err
	}
	out.Actions = int(actions)
	var expressions int64
	if err := r.db.WithContext(ctx).Table("action_nodes AS n").
		Joins("JOIN action_document_states s ON s.node_uuid = n.uuid AND s.kind = 'expression'").
		Joins("JOIN action_document_versions v ON v.uuid = s.effective_version_uuid").
		Where("n.author_uuid = ? AND TRIM(v.markdown) <> ''", userUUID).
		Where("NOT EXISTS (SELECT 1 FROM action_references r WHERE r.graph_uuid = n.graph_uuid AND r.source_node_uuid = n.uuid)").
		Count(&expressions).Error; err != nil {
		return out, err
	}
	out.Expressions = int(expressions)
	var agreements int64
	if err := r.db.WithContext(ctx).Table("action_references AS r").
		Joins("JOIN action_nodes AS target ON target.uuid = r.target_node_uuid").
		Joins("JOIN action_nodes AS source ON source.uuid = r.source_node_uuid").
		Joins("JOIN action_document_states AS s ON s.node_uuid = source.uuid AND s.kind = 'agreement'").
		Joins("JOIN action_document_versions AS v ON v.uuid = s.effective_version_uuid").
		Where("r.agreement_status = 'satisfied' AND source.author_uuid <> target.author_uuid AND TRIM(v.markdown) <> ''").
		Where("target.author_uuid = ? OR source.author_uuid = ?", userUUID, userUUID).
		Count(&agreements).Error; err != nil {
		return out, err
	}
	out.Agreements = int(agreements)
	return out, nil
}

// Following 过滤已不可用的用户和图。
func (r *Repository) Following(ctx context.Context, uuid string) (app.FollowingView, error) {
	out := app.FollowingView{UserIDs: []string{}, GraphIDs: []string{}, Users: []app.ProfileView{}}
	if err := r.db.WithContext(ctx).Table("user_follows AS f").Joins("JOIN users u ON u.uuid = f.followed_user_uuid AND u.disabled_at IS NULL").Where("f.follower_uuid = ?", uuid).Order("f.id").Pluck("f.followed_user_uuid", &out.UserIDs).Error; err != nil {
		return out, err
	}
	err := r.db.WithContext(ctx).Table("graph_follows AS f").Joins("JOIN graphs g ON g.uuid = f.graph_uuid AND g.deleted_at IS NULL").Where("f.user_uuid = ?", uuid).Order("f.id").Pluck("f.graph_uuid", &out.GraphIDs).Error
	if err != nil {
		return out, err
	}
	// 关注页需要的用户资料随关注集合返回，不额外拉全量目录。
	if len(out.UserIDs) > 0 {
		var users []model.User
		if err := r.db.WithContext(ctx).Where("uuid IN ? AND disabled_at IS NULL", out.UserIDs).Find(&users).Error; err != nil {
			return out, err
		}
		out.Users, err = r.profiles(ctx, users)
	}
	return out, err
}
