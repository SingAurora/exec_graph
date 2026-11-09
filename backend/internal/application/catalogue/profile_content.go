package catalogue

import "context"

// ProfileContentView 是单个用户主页需要的图与行动子图。
type ProfileContentView struct {
	Profile ProfileView  `json:"profile"`
	Graphs  []GraphView  `json:"graphs"`
	Actions []ActionView `json:"actions"`
}

// ProfileContent 读取单个用户参与过的图及其行动上下文；主页按用户独立加载。
func (s *Service) ProfileContent(ctx context.Context, userUUID string) (ProfileContentView, error) {
	profile, err := s.repository.Profile(ctx, userUUID)
	if err != nil {
		return ProfileContentView{}, err
	}
	graphs, err := s.repository.GraphsForAuthor(ctx, userUUID)
	if err != nil {
		return ProfileContentView{}, err
	}
	out := ProfileContentView{Profile: profile, Graphs: []GraphView{}, Actions: []ActionView{}}
	for _, graph := range graphs {
		actions, err := s.repository.Actions(ctx, graph.ID)
		if err != nil {
			return ProfileContentView{}, err
		}
		seeds := make([]ActionView, 0)
		byID := make(map[string]ActionView, len(actions))
		for _, action := range actions {
			byID[action.ID] = action
			if action.AuthorID == userUUID {
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
