package identity

import (
	"context"
	"errors"
	"time"
)

// ErrRecordNotFound 表示身份仓储中不存在目标记录。
var ErrRecordNotFound = errors.New("identity record not found")

// UserRecord 是身份用例需要的账户持久化数据。
type UserRecord struct {
	ID                    uint64
	Username              string
	UserID                string
	IsTestAccount         bool
	Email                 string
	PasswordHash          string
	EmailVerifiedAt       *time.Time
	Bio                   *string
	Gender                *string
	AvatarObjectKey       *string
	ProfileBackgroundKey  *string
	CustomProfileEnabled  bool
	CustomProfileMarkdown *string
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

// VerificationCodeRecord 是邮箱验证码的持久化数据。
type VerificationCodeRecord struct {
	ID        uint64
	Email     string
	Purpose   string
	CodeHash  string
	ExpiresAt time.Time
	UsedAt    *time.Time
	SendIP    *string
	CreatedAt time.Time
}

// InitialProjectInput 描述注册事务内创建的初始项目。
type InitialProjectInput struct {
	ProjectUUID, RevisionUUID, SmartContractUUID, SmartContractVersion string
	OwnerID                                                            uint64
}

// ProfileUpdateRecord 是个人资料的明确更新字段。
type ProfileUpdateRecord struct {
	Username, UserID, Bio, Gender, CustomProfileMarkdown string
	CustomProfileEnabled                                 bool
}

// Repository 定义身份用例需要的数据库能力。
type Repository interface {
	Transaction(ctx context.Context, fn func(Repository) error) error
	FindUserByEmail(ctx context.Context, email string, lock bool) (UserRecord, error)
	FindUserByID(ctx context.Context, userID uint64) (UserRecord, error)
	EmailExists(ctx context.Context, email string) (bool, error)
	CreateUser(ctx context.Context, user *UserRecord) error
	UpdateEmail(ctx context.Context, userID uint64, email string, verifiedAt time.Time) error
	UpdatePassword(ctx context.Context, userID uint64, passwordHash string) error
	UpdateProfile(ctx context.Context, userID uint64, input ProfileUpdateRecord) error
	SetAvatarObjectKey(ctx context.Context, userID uint64, objectKey string) error
	SetProfileBackgroundObjectKey(ctx context.Context, userID uint64, objectKey string) error
	InvalidateCodes(ctx context.Context, email, purpose string) error
	CreateCode(ctx context.Context, code *VerificationCodeRecord) error
	LatestActiveCode(ctx context.Context, email, purpose string, lock bool) (VerificationCodeRecord, error)
	MarkCodeUsed(ctx context.Context, codeID uint64) (bool, error)
	EnsureInitialProject(ctx context.Context, input InitialProjectInput) error
}

// ContractReader reads the frozen system contract version used at registration.
type ContractReader interface {
	FindVersionByID(ctx context.Context, contractUUID string) (string, error)
}

// VerificationMailer sends one-time verification codes.
type VerificationMailer interface {
	SendVerificationCode(ctx context.Context, email, code string) error
}

// SessionStore stores mandatory Redis-backed login sessions.
type SessionStore interface {
	Store(ctx context.Context, token string, userID uint64, contents []byte, ttl time.Duration) error
	Load(ctx context.Context, token string) ([]byte, bool, error)
	Delete(ctx context.Context, token string, userID uint64) error
	DeleteUserSessions(ctx context.Context, userID uint64) error
}

// ObjectStorage 提供个人资料媒体所需的通用对象存储能力。
type ObjectStorage interface {
	NewObjectKey(parts ...string) (string, error)
	PutObject(ctx context.Context, objectKey, contentType string, contents []byte, cacheControl string) error
	SignedObjectURL(ctx context.Context, objectKey string, expires time.Duration) (string, error)
	DeleteObject(ctx context.Context, objectKey string) error
	IsManagedObjectKey(objectKey string) bool
}

// ProfileImageProcessor 校验、缩放并压缩个人资料图片。
type ProfileImageProcessor interface {
	ProcessAvatar(contents []byte) ([]byte, error)
	ProcessBackground(contents []byte) ([]byte, error)
}
