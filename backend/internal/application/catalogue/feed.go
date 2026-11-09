package catalogue

import (
	"context"

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

// Feed 读取表达或约定内容流；先选出本页节点，再只返回节点和所需祖先。
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
	nodeIDs, total, err := s.repository.FeedNodeIDs(ctx, kind, (page-1)*limit, limit)
	if err != nil {
		return FeedView{}, err
	}
	if len(nodeIDs) == 0 {
		return FeedView{Actions: []ActionView{}, Graphs: []GraphView{}, Total: total, HasMore: false}, nil
	}
	byGraph := map[string][]ActionView{}
	selectedByID := map[string]ActionView{}
	for _, id := range nodeIDs {
		node, err := s.repository.Action(ctx, id)
		if err != nil {
			return FeedView{}, err
		}
		selectedByID[id] = node
		if _, ok := byGraph[node.GraphID]; !ok {
			actions, err := s.repository.Actions(ctx, node.GraphID)
			if err != nil {
				return FeedView{}, err
			}
			byGraph[node.GraphID] = actions
		}
	}
	allByID := map[string]ActionView{}
	for _, actions := range byGraph {
		for _, action := range actions {
			allByID[action.ID] = action
		}
	}
	selected := make([]ActionView, 0, len(selectedByID))
	for _, id := range nodeIDs {
		selected = append(selected, selectedByID[id])
	}
	actions := withAncestors(selected, allByID)
	out := FeedView{Actions: actions, Graphs: []GraphView{}, Total: total, HasMore: page*limit < total}
	seen := map[string]bool{}
	for _, node := range actions {
		if seen[node.GraphID] {
			continue
		}
		seen[node.GraphID] = true
		graph, err := s.repository.Graph(ctx, node.GraphID)
		if err != nil {
			return FeedView{}, err
		}
		out.Graphs = append(out.Graphs, graph)
	}
	return out, nil
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
