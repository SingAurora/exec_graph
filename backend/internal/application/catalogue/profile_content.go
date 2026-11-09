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
	graphs, err := s.repository.Graphs(ctx)
	if err != nil {
		return ProfileContentView{}, err
	}
	out := ProfileContentView{Profile: profile, Graphs: []GraphView{}, Actions: []ActionView{}}
	for _, graph := range graphs {
		actions, err := s.repository.Actions(ctx, graph.ID)
		if err != nil {
			return ProfileContentView{}, err
		}
		participates := false
		for _, action := range actions {
			if action.AuthorID == userUUID {
				participates = true
				break
			}
		}
		if !participates {
			continue
		}
		out.Graphs = append(out.Graphs, graph)
		out.Actions = append(out.Actions, actions...)
	}
	return out, nil
}
