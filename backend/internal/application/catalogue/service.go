package catalogue

import "context"

// Repository 只暴露读取能力，不向 application 泄露 ORM。
type Repository interface {
	Profiles(context.Context) ([]ProfileView, error)
	Graphs(context.Context) ([]GraphView, error)
	Graph(context.Context, string) (GraphView, error)
	Actions(context.Context, string) ([]ActionView, error)
	Action(context.Context, string) (ActionView, error)
	Following(context.Context, string) (FollowingView, error)
	Media(context.Context, string) (MediaMetadata, error)
}

// Files 抽象对象存储读取，首批只读取明确导入的演示文件。
type Files interface {
	Read(context.Context, string) ([]byte, error)
}

// Service 是目录读取用例入口。
type Service struct {
	repository Repository
	files      Files
}

// New 注入已创建的仓储和文件客户端。
func New(repository Repository, files Files) *Service {
	return &Service{repository: repository, files: files}
}

// Profiles 读取公开资料目录。
func (s *Service) Profiles(ctx context.Context) ([]ProfileView, error) {
	return s.repository.Profiles(ctx)
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

// Following 读取当前账号关注集合。
func (s *Service) Following(ctx context.Context, uuid string) (FollowingView, error) {
	return s.repository.Following(ctx, uuid)
}

// Media 验证文件状态后读取对象，不接受任意文件路径。
func (s *Service) Media(ctx context.Context, uuid string) ([]byte, string, error) {
	meta, err := s.repository.Media(ctx, uuid)
	if err != nil {
		return nil, "", err
	}
	body, err := s.files.Read(ctx, meta.ObjectKey)
	return body, meta.MIMEType, err
}
