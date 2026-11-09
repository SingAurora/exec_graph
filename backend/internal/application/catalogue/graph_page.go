package catalogue

import (
	"context"
)

// GraphPageView 是图目录的服务端分页结果。
type GraphPageView struct {
	Items    []GraphView `json:"items"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
	Total    int         `json:"total"`
	HasMore  bool        `json:"hasMore"`
}

// GraphsPage 按筛选、搜索和排序返回图目录的一页。
func (s *Service) GraphsPage(ctx context.Context, page, pageSize int, filter, keyword, order, userUUID string) (GraphPageView, error) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 50 {
		pageSize = 50
	}
	items, total, err := s.repository.GraphsPage(ctx, filter, keyword, order, userUUID, (page-1)*pageSize, pageSize)
	if err != nil {
		return GraphPageView{}, err
	}
	return GraphPageView{Items: items, Page: page, PageSize: pageSize, Total: total, HasMore: page*pageSize < total}, nil
}
