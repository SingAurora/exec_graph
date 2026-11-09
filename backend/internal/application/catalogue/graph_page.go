package catalogue

import "context"

// GraphPageView 是图目录的服务端分页结果。
type GraphPageView struct {
	Items    []GraphView `json:"items"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
	Total    int         `json:"total"`
	HasMore  bool        `json:"hasMore"`
}

// GraphsPage 先复用现有图目录并按页返回；下一步再下推数据库分页和筛选。
func (s *Service) GraphsPage(ctx context.Context, page, pageSize int) (GraphPageView, error) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 50 {
		pageSize = 50
	}
	graphs, err := s.repository.Graphs(ctx)
	if err != nil {
		return GraphPageView{}, err
	}
	start := (page - 1) * pageSize
	if start > len(graphs) {
		start = len(graphs)
	}
	end := start + pageSize
	if end > len(graphs) {
		end = len(graphs)
	}
	return GraphPageView{Items: graphs[start:end], Page: page, PageSize: pageSize, Total: len(graphs), HasMore: end < len(graphs)}, nil
}
