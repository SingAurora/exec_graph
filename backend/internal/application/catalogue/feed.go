package catalogue

import (
	"context"
	"sort"
	"strings"

	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// FeedView 是内容流的当前页；Actions 包含本页节点及计算继承/来源所需的祖先节点。
type FeedView struct {
	Actions []ActionView `json:"actions"`
	Graphs  []GraphView  `json:"graphs"`
	Total   int          `json:"total"`
	HasMore bool         `json:"hasMore"`
}

const (
	feedDefaultLimit = 20
	feedMaxLimit     = 50
)

// Feed 读取表达或约定内容流；先选出本页图，再只加载这些图的上下文。
func (s *Service) Feed(ctx context.Context, kind string, page, limit int) (FeedView, error) {
	if kind != "expressions" && kind != "agreements" {
		return FeedView{}, fault.New(fault.Invalid, "内容流类型不合法")
	}
	if page < 1 {
		page = 1
	}
	if limit <= 0 {
		limit = feedDefaultLimit
	}
	if limit > feedMaxLimit {
		limit = feedMaxLimit
	}
	ids, total, err := s.repository.FeedGraphIDs(ctx, kind, (page-1)*limit, limit)
	if err != nil {
		return FeedView{}, err
	}
	out := FeedView{Actions: []ActionView{}, Graphs: []GraphView{}, Total: total, HasMore: page*limit < total}
	for _, id := range ids {
		graph, err := s.repository.Graph(ctx, id)
		if err != nil {
			return FeedView{}, err
		}
		actions, err := s.repository.Actions(ctx, id)
		if err != nil {
			return FeedView{}, err
		}
		out.Graphs = append(out.Graphs, graph)
		out.Actions = append(out.Actions, actions...)
	}
	return out, nil
}

// expressionFeed 找出每张图未被承接的终点，保留有非空有效表达的点，按发布时间倒序。
func expressionFeed(all []ActionView, byGraph map[string][]ActionView) []ActionView {
	referenced := make(map[string]bool)
	for _, action := range all {
		for _, parent := range append([]string{action.ParentID}, action.MergedParentIDs...) {
			if parent != "" {
				referenced[parent] = true
			}
		}
	}
	result := make([]ActionView, 0)
	for _, action := range all {
		if referenced[action.ID] {
			continue
		}
		if action.ExpressionMarkdown == nil || strings.TrimSpace(*action.ExpressionMarkdown) == "" {
			continue
		}
		if !sameGraph(action, byGraph) {
			continue
		}
		result = append(result, action)
	}
	sort.Slice(result, func(i, j int) bool {
		if !result[i].CreatedAt.Equal(result[j].CreatedAt) {
			return result[i].CreatedAt.After(result[j].CreatedAt)
		}
		return result[i].Number > result[j].Number
	})
	return result
}

// sameGraph 只用于兜底；正常数据中节点必定属于图，保留检查避免无图节点混入。
func sameGraph(action ActionView, byGraph map[string][]ActionView) bool {
	_, ok := byGraph[action.GraphID]
	return ok
}

// agreementFeed 选出满足来源约定、非自我回应且约定正文非空的回应行动。
func agreementFeed(all []ActionView) []ActionView {
	byID := make(map[string]ActionView, len(all))
	for _, action := range all {
		byID[action.ID] = action
	}
	selected := make([]ActionView, 0)
	for _, target := range all {
		assessment := make(map[string]*bool)
		for _, review := range target.ReferenceAgreements {
			assessment[review.SourceID] = review.Complies
		}
		for _, sourceID := range append([]string{target.ParentID}, target.MergedParentIDs...) {
			source, ok := byID[sourceID]
			if !ok || source.GraphID != target.GraphID || source.AuthorID == target.AuthorID {
				continue
			}
			if source.AgreementMarkdown == nil || strings.TrimSpace(*source.AgreementMarkdown) == "" {
				continue
			}
			complies := assessment[sourceID]
			if complies == nil || !*complies {
				continue
			}
			selected = append(selected, target)
			break
		}
	}
	sort.Slice(selected, func(i, j int) bool {
		if !selected[i].CreatedAt.Equal(selected[j].CreatedAt) {
			return selected[i].CreatedAt.After(selected[j].CreatedAt)
		}
		return selected[i].Number > selected[j].Number
	})
	return selected
}

// withAncestors 返回本页节点及其所有直接/间接祖先，供前端恢复继承、约定来源和上下文。
func withAncestors(items []ActionView, byID map[string]ActionView) []ActionView {
	seen := make(map[string]bool)
	result := make([]ActionView, 0, len(items))
	var visit func(ActionView)
	visit = func(action ActionView) {
		if seen[action.ID] {
			return
		}
		seen[action.ID] = true
		result = append(result, action)
		for _, parent := range append([]string{action.ParentID}, action.MergedParentIDs...) {
			if parent != "" {
				if next, ok := byID[parent]; ok {
					visit(next)
				}
			}
		}
	}
	for _, item := range items {
		visit(item)
	}
	return result
}

func feedGraphs(actions []ActionView, graphs []GraphView) []GraphView {
	byID := make(map[string]GraphView, len(graphs))
	for _, graph := range graphs {
		byID[graph.ID] = graph
	}
	seen := make(map[string]bool)
	result := make([]GraphView, 0)
	for _, action := range actions {
		if seen[action.GraphID] {
			continue
		}
		seen[action.GraphID] = true
		if graph, ok := byID[action.GraphID]; ok {
			result = append(result, graph)
		}
	}
	return result
}
