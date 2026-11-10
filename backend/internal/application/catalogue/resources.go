package catalogue

import (
	"context"

	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// ActionPageView 是一个行动类资源页：Items 只含当前页被选中的节点，Actions 含这些节点和祖先。
type ActionPageView struct {
	Items    []string     `json:"items"`
	Actions  []ActionView `json:"actions"`
	Graphs   []GraphView  `json:"graphs"`
	Page     int          `json:"page"`
	PageSize int          `json:"pageSize"`
	Total    int          `json:"total"`
	HasMore  bool         `json:"hasMore"`
}

const resourceDefaultPageSize = 20

func normalizePage(page, size int) (int, int) {
	if page < 1 {
		page = 1
	}
	if size <= 0 {
		size = resourceDefaultPageSize
	}
	if size > 50 {
		size = 50
	}
	return page, size
}

func paginate[T any](items []T, page, size int) ([]T, bool) {
	start := (page - 1) * size
	if start > len(items) {
		start = len(items)
	}
	end := start + size
	if end > len(items) {
		end = len(items)
	}
	return items[start:end], end < len(items)
}

func (s *Service) graphsForActions(ctx context.Context, actions []ActionView) ([]GraphView, error) {
	seen := map[string]bool{}
	out := make([]GraphView, 0)
	for _, action := range actions {
		if seen[action.GraphID] {
			continue
		}
		seen[action.GraphID] = true
		graph, err := s.repository.Graph(ctx, action.GraphID)
		if err != nil {
			return nil, err
		}
		out = append(out, graph)
	}
	return out, nil
}

// ProfileInfo 读取单个用户资料。
func (s *Service) ProfileInfo(ctx context.Context, userUUID string) (ProfileView, error) {
	return s.repository.Profile(ctx, userUUID)
}

// ProfileActionPage 按资源读取用户表达、约定或行动页，只加载种子节点和祖先。
func (s *Service) ProfileActionPage(ctx context.Context, userUUID, resource string, page, size int) (ActionPageView, error) {
	page, size = normalizePage(page, size)
	if resource != "action" && resource != "expression" && resource != "agreement" {
		return ActionPageView{}, fault.New(fault.Invalid, "个人主页资源类型不合法")
	}
	ids, total, err := s.repository.ProfileResourceNodeIDs(ctx, userUUID, resource, (page-1)*size, size)
	if err != nil {
		return ActionPageView{}, err
	}
	actions, err := s.repository.NodeContext(ctx, ids)
	if err != nil {
		return ActionPageView{}, err
	}
	graphs, err := s.graphsForActions(ctx, actions)
	if err != nil {
		return ActionPageView{}, err
	}
	return ActionPageView{Items: ids, Actions: actions, Graphs: graphs, Page: page, PageSize: size, Total: total, HasMore: page*size < total}, nil
}

// ProfileGraphPage 读取用户参与的图。
func (s *Service) ProfileGraphPage(ctx context.Context, userUUID string, page, size int) (GraphPageView, error) {
	page, size = normalizePage(page, size)
	graphs, err := s.repository.GraphsForAuthor(ctx, userUUID)
	if err != nil {
		return GraphPageView{}, err
	}
	items, hasMore := paginate(graphs, page, size)
	return GraphPageView{Items: items, Page: page, PageSize: size, Total: len(graphs), HasMore: hasMore}, nil
}

// ProfileList 是用户资料列表页。
type ProfileListPage struct {
	Items    []ProfileView `json:"items"`
	Page     int           `json:"page"`
	PageSize int           `json:"pageSize"`
	Total    int           `json:"total"`
	HasMore  bool          `json:"hasMore"`
}

// FollowingActionPage 按资源读取关注表达或约定页，只加载种子节点和祖先。
func (s *Service) FollowingActionPage(ctx context.Context, userUUID, resource string, page, size int) (ActionPageView, error) {
	page, size = normalizePage(page, size)
	if resource != "expression" && resource != "agreement" {
		return ActionPageView{}, fault.New(fault.Invalid, "关注资源类型不合法")
	}
	ids, total, err := s.repository.FollowingResourceNodeIDs(ctx, userUUID, resource, (page-1)*size, size)
	if err != nil {
		return ActionPageView{}, err
	}
	actions, err := s.repository.NodeContext(ctx, ids)
	if err != nil {
		return ActionPageView{}, err
	}
	graphs, err := s.graphsForActions(ctx, actions)
	if err != nil {
		return ActionPageView{}, err
	}
	return ActionPageView{Items: ids, Actions: actions, Graphs: graphs, Page: page, PageSize: size, Total: total, HasMore: page*size < total}, nil
}

// FollowingGraphPage 读取关注的图。
func (s *Service) FollowingGraphPage(ctx context.Context, userUUID string, page, size int) (GraphPageView, error) {
	page, size = normalizePage(page, size)
	graphs, err := s.repository.GraphsForFollowing(ctx, userUUID)
	if err != nil {
		return GraphPageView{}, err
	}
	items, hasMore := paginate(graphs, page, size)
	return GraphPageView{Items: items, Page: page, PageSize: size, Total: len(graphs), HasMore: hasMore}, nil
}

// FollowingUserPage 读取关注的用户。
func (s *Service) FollowingUserPage(ctx context.Context, userUUID string, page, size int) (ProfileListPage, error) {
	page, size = normalizePage(page, size)
	sources, err := s.repository.Following(ctx, userUUID)
	if err != nil {
		return ProfileListPage{}, err
	}
	items, hasMore := paginate(sources.Users, page, size)
	return ProfileListPage{Items: items, Page: page, PageSize: size, Total: len(sources.Users), HasMore: hasMore}, nil
}
