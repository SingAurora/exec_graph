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
	actions, err := s.repository.NodeContext(ctx, nodeIDs)
	if err != nil {
		return FeedView{}, err
	}
	graphs, err := s.graphsForActions(ctx, actions)
	if err != nil {
		return FeedView{}, err
	}
	return FeedView{Actions: actions, Graphs: graphs, Total: total, HasMore: page*limit < total}, nil
}
