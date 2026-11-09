package catalogue

import (
	"context"
	"sort"
	"strings"

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

func actionPage(selected []ActionView, contexts []ActionView, graphs []GraphView, page, size int) ActionPageView {
	pageItems, hasMore := paginate(selected, page, size)
	ids := make([]string, 0, len(pageItems))
	byID := make(map[string]ActionView, len(contexts))
	for _, action := range contexts {
		byID[action.ID] = action
	}
	for _, item := range pageItems {
		ids = append(ids, item.ID)
	}
	actions := withAncestors(pageItems, byID)
	seen := map[string]bool{}
	related := make([]GraphView, 0)
	graphByID := make(map[string]GraphView, len(graphs))
	for _, graph := range graphs {
		graphByID[graph.ID] = graph
	}
	for _, action := range actions {
		if seen[action.GraphID] {
			continue
		}
		seen[action.GraphID] = true
		if graph, ok := graphByID[action.GraphID]; ok {
			related = append(related, graph)
		}
	}
	return ActionPageView{Items: ids, Actions: actions, Graphs: related, Page: page, PageSize: size, Total: len(selected), HasMore: hasMore}
}

// ProfileInfo 读取单个用户资料。
func (s *Service) ProfileInfo(ctx context.Context, userUUID string) (ProfileView, error) {
	return s.repository.Profile(ctx, userUUID)
}

// ProfileActionPage 读取用户行动和祖先上下文。
func (s *Service) ProfileActionPage(ctx context.Context, userUUID, resource string, page, size int) (ActionPageView, error) {
	page, size = normalizePage(page, size)
	content, err := s.ProfileContent(ctx, userUUID)
	if err != nil {
		return ActionPageView{}, err
	}
	selected := make([]ActionView, 0)
	contexts := content.Actions
	switch resource {
	case "action":
		for _, action := range contexts {
			if action.AuthorID == userUUID {
				selected = append(selected, action)
			}
		}
		sort.Slice(selected, func(i, j int) bool { return selected[i].CreatedAt.After(selected[j].CreatedAt) })
	case "expression":
		referenced := map[string]bool{}
		for _, action := range contexts {
			for _, parent := range append([]string{action.ParentID}, action.MergedParentIDs...) {
				if parent != "" {
					referenced[parent] = true
				}
			}
		}
		for _, action := range contexts {
			if referenced[action.ID] || action.AuthorID != userUUID {
				continue
			}
			if action.ExpressionMarkdown == nil || strings.TrimSpace(*action.ExpressionMarkdown) == "" {
				continue
			}
			selected = append(selected, action)
		}
		sort.Slice(selected, func(i, j int) bool { return selected[i].CreatedAt.After(selected[j].CreatedAt) })
	case "agreement":
		for _, target := range contexts {
			assessment := map[string]*bool{}
			for _, review := range target.ReferenceAgreements {
				assessment[review.SourceID] = review.Complies
			}
			for _, sourceID := range append([]string{target.ParentID}, target.MergedParentIDs...) {
				source, ok := findAction(contexts, sourceID)
				if !ok || source.AuthorID == target.AuthorID {
					continue
				}
				if source.AgreementMarkdown == nil || strings.TrimSpace(*source.AgreementMarkdown) == "" {
					continue
				}
				if complies := assessment[sourceID]; complies != nil && *complies && (target.AuthorID == userUUID || source.AuthorID == userUUID) {
					selected = append(selected, target)
					break
				}
			}
		}
		sort.Slice(selected, func(i, j int) bool { return selected[i].CreatedAt.After(selected[j].CreatedAt) })
	default:
		return ActionPageView{}, fault.New(fault.Invalid, "个人主页资源类型不合法")
	}
	return actionPage(selected, contexts, content.Graphs, page, size), nil
}

func findAction(actions []ActionView, id string) (ActionView, bool) {
	for _, action := range actions {
		if action.ID == id {
			return action, true
		}
	}
	return ActionView{}, false
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

// FollowingActionPage 读取关注表达或约定页。
func (s *Service) FollowingActionPage(ctx context.Context, userUUID, resource string, page, size int) (ActionPageView, error) {
	page, size = normalizePage(page, size)
	content, err := s.FollowingContent(ctx, userUUID)
	if err != nil {
		return ActionPageView{}, err
	}
	selected := make([]ActionView, 0)
	contexts := content.Actions
	switch resource {
	case "expression":
		referenced := map[string]bool{}
		for _, action := range contexts {
			for _, parent := range append([]string{action.ParentID}, action.MergedParentIDs...) {
				if parent != "" {
					referenced[parent] = true
				}
			}
		}
		for _, action := range contexts {
			if referenced[action.ID] || action.ExpressionMarkdown == nil || strings.TrimSpace(*action.ExpressionMarkdown) == "" {
				continue
			}
			selected = append(selected, action)
		}
		sort.Slice(selected, func(i, j int) bool { return selected[i].CreatedAt.After(selected[j].CreatedAt) })
	case "agreement":
		for _, target := range contexts {
			assessment := map[string]*bool{}
			for _, review := range target.ReferenceAgreements {
				assessment[review.SourceID] = review.Complies
			}
			for _, sourceID := range append([]string{target.ParentID}, target.MergedParentIDs...) {
				source, ok := findAction(contexts, sourceID)
				if !ok || source.AuthorID == target.AuthorID {
					continue
				}
				if source.AgreementMarkdown == nil || strings.TrimSpace(*source.AgreementMarkdown) == "" {
					continue
				}
				if complies := assessment[sourceID]; complies != nil && *complies {
					selected = append(selected, target)
					break
				}
			}
		}
		sort.Slice(selected, func(i, j int) bool { return selected[i].CreatedAt.After(selected[j].CreatedAt) })
	default:
		return ActionPageView{}, fault.New(fault.Invalid, "关注资源类型不合法")
	}
	return actionPage(selected, contexts, content.Graphs, page, size), nil
}

// FollowingGraphPage 读取关注的图。
func (s *Service) FollowingGraphPage(ctx context.Context, userUUID string, page, size int) (GraphPageView, error) {
	page, size = normalizePage(page, size)
	content, err := s.FollowingContent(ctx, userUUID)
	if err != nil {
		return GraphPageView{}, err
	}
	items, hasMore := paginate(content.Graphs, page, size)
	return GraphPageView{Items: items, Page: page, PageSize: size, Total: len(content.Graphs), HasMore: hasMore}, nil
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
