// Package identity contains account, verification and session use cases.
// It deliberately does not import net/http or Gin.
package identity

import (
	"time"
)

// PasswordHasher protects account passwords without exposing a concrete hash implementation.
type PasswordHasher interface {
	Hash(password string) (string, error)
	Verify(hash, password string) bool
}

// Dependencies 是身份领域服务启动所需的基础设施依赖。
type Dependencies struct {
	Repository Repository
	Contracts  ContractReader
	Mailer     VerificationMailer
	Sessions   SessionStore
	Passwords  PasswordHasher
	Storage    ObjectStorage
	Images     ProfileImageProcessor
	CodeTTL    time.Duration
	SessionTTL time.Duration
}

// Service 是身份领域的应用服务。
type Service struct {
	repository Repository
	contracts  ContractReader
	mailer     VerificationMailer
	sessions   SessionStore
	passwords  PasswordHasher
	storage    ObjectStorage
	images     ProfileImageProcessor
	codeTTL    time.Duration
	sessionTTL time.Duration
}

// New 创建身份应用服务。
func New(dependencies Dependencies) *Service {
	return &Service{
		repository: dependencies.Repository,
		contracts:  dependencies.Contracts,
		mailer:     dependencies.Mailer,
		sessions:   dependencies.Sessions,
		passwords:  dependencies.Passwords,
		storage:    dependencies.Storage,
		images:     dependencies.Images,
		codeTTL:    dependencies.CodeTTL,
		sessionTTL: dependencies.SessionTTL,
	}
}
