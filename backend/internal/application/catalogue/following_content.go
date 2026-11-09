package catalogue

import "context"

// FollowingContentView 是关注页所需的关注集合、图和行动子图。
type FollowingContentView struct {
	Sources FollowingView `json:"sources"`
	Graphs  []GraphView   `json:"graphs"`
	Actions []ActionView  `json:"actions"`
}

// FollowingContent 只读取关注图/关注用户涉及的图，避免关注页加载全量行动。
func (s *Service) FollowingContent(ctx context.Context, userUUID string) (FollowingContentView, error) {
	sources, err := s.repository.Following(ctx, userUUID)
	if err != nil {
		return FollowingContentView{}, err
	}
	followedGraphs := make(map[string]bool, len(sources.GraphIDs))
	for _, uuid := range sources.GraphIDs {
		followedGraphs[uuid] = true
	}
	followedUsers := make(map[string]bool, len(sources.UserIDs))
	for _, uuid := range sources.UserIDs {
		followedUsers[uuid] = true
	}
	graphs, err := s.repository.GraphsForFollowing(ctx, userUUID)
	if err != nil {
		return FollowingContentView{}, err
	}
	out := FollowingContentView{Sources: sources, Graphs: []GraphView{}, Actions: []ActionView{}}
	for _, graph := range graphs {
		actions, err := s.repository.Actions(ctx, graph.ID)
		if err != nil {
			return FollowingContentView{}, err
		}
		if followedGraphs[graph.ID] {
			out.Graphs = append(out.Graphs, graph)
			out.Actions = append(out.Actions, actions...)
			continue
		}
		seeds := make([]ActionView, 0)
		byID := make(map[string]ActionView, len(actions))
		for _, action := range actions {
			byID[action.ID] = action
			if followedUsers[action.AuthorID] {
				seeds = append(seeds, action)
			}
		}
		if len(seeds) == 0 {
			continue
		}
		out.Graphs = append(out.Graphs, graph)
		out.Actions = append(out.Actions, withAncestors(seeds, byID)...)
	}
	return out, nil
}
