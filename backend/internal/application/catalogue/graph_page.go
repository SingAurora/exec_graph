package catalogue

import (
	"context"
	"sort"
	"strings"
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
	graphs, err := s.repository.Graphs(ctx)
	if err != nil {
		return GraphPageView{}, err
	}
	query := strings.ToLower(strings.TrimSpace(keyword))
	filtered := make([]GraphView, 0, len(graphs))
	for _, graph := range graphs {
		if filter == "owned" && graph.OwnerID != userUUID {
			continue
		}
		if filter == "joined" {
			joined := false
			for _, id := range graph.ParticipantIDs {
				if id == userUUID {
					joined = true
					break
				}
			}
			if !joined {
				continue
			}
		}
		if query != "" && !strings.Contains(strings.ToLower(graph.Title+" "+graph.Description), query) {
			continue
		}
		filtered = append(filtered, graph)
	}
	switch order {
	case "created":
		sort.SliceStable(filtered, func(i, j int) bool { return filtered[i].CreatedAt.After(filtered[j].CreatedAt) })
	case "name":
		sort.SliceStable(filtered, func(i, j int) bool { return strings.Compare(filtered[i].Title, filtered[j].Title) < 0 })
	default:
		sort.SliceStable(filtered, func(i, j int) bool {
			left, right := filtered[i].CreatedAt, filtered[j].CreatedAt
			if filtered[i].LastActionAt != nil {
				left = *filtered[i].LastActionAt
			}
			if filtered[j].LastActionAt != nil {
				right = *filtered[j].LastActionAt
			}
			return left.After(right)
		})
	}
	total := len(filtered)
	startPage := (page - 1) * pageSize
	if startPage > total {
		startPage = total
	}
	endPage := startPage + pageSize
	if endPage > total {
		endPage = total
	}
	return GraphPageView{Items: filtered[startPage:endPage], Page: page, PageSize: pageSize, Total: total, HasMore: endPage < total}, nil
}
