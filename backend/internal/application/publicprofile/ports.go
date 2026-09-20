package publicprofile

import (
	"context"
	"errors"
	"time"
)

var (
	// ErrNotFound 表示请求的公开用户不存在。
	ErrNotFound = errors.New("public profile not found")
	// ErrInvalidUserID 表示公开用户 ID 不能用于安全查询。
	ErrInvalidUserID = errors.New("invalid public user ID")
)

// Repository 读取公开个人主页需要的跨表只读投影。
type Repository interface {
	Load(ctx context.Context, userID string) (User, []Project, []Completion, error)
}

// ObjectURLSigner 为受管对象生成短期访问地址。
type ObjectURLSigner interface {
	SignedObjectURL(ctx context.Context, objectKey string, expires time.Duration) (string, error)
	IsManagedObjectKey(objectKey string) bool
}

// Dependencies 是公开个人主页服务需要的端口。
type Dependencies struct {
	Repository Repository
	Storage    ObjectURLSigner
}
