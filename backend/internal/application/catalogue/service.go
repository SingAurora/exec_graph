package catalogue

import "context"

// Repository 只暴露读取能力，不向 application 泄露 ORM。
type Repository interface {
	Graphs(context.Context) ([]GraphView, error)
	GraphsPage(context.Context, string, string, string, string, int, int) ([]GraphView, int, error)
	GraphsForAuthor(context.Context, string) ([]GraphView, error)
	GraphsForFollowing(context.Context, string) ([]GraphView, error)
	Graph(context.Context, string) (GraphView, error)
	Profile(context.Context, string) (ProfileView, error)
	Actions(context.Context, string) ([]ActionView, error)
	Action(context.Context, string) (ActionView, error)
	Following(context.Context, string) (FollowingView, error)
	ProfileStats(context.Context, string) (ProfileStatsView, error)
	FeedNodeIDs(context.Context, string, int, int) ([]string, int, error)
}

// Service 是目录读取用例入口。
type Service struct {
	repository Repository
}

// New 注入已创建的仓储和文件客户端。
func New(repository Repository) *Service {
	return &Service{repository: repository}
}

// Graphs 读取可见行动图目录。
func (s *Service) Graphs(ctx context.Context) ([]GraphView, error) { return s.repository.Graphs(ctx) }

// Graph 读取图资料，允许显式演示 alias 映射。
func (s *Service) Graph(ctx context.Context, uuid string) (GraphView, error) {
	return s.repository.Graph(ctx, uuid)
}

// Actions 读取一个图的完整确认上下文。
func (s *Service) Actions(ctx context.Context, uuid string) ([]ActionView, error) {
	return s.repository.Actions(ctx, uuid)
}

// Action 读取单个行动。
func (s *Service) Action(ctx context.Context, uuid string) (ActionView, error) {
	return s.repository.Action(ctx, uuid)
}

// ProfileStats 读取当前账号侧栏统计。
func (s *Service) ProfileStats(ctx context.Context, uuid string) (ProfileStatsView, error) {
	return s.repository.ProfileStats(ctx, uuid)
}

// Following 读取当前账号关注集合。
func (s *Service) Following(ctx context.Context, uuid string) (FollowingView, error) {
	return s.repository.Following(ctx, uuid)
}
