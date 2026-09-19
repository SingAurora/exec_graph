// Package identity contains account, verification and session use cases.
// It deliberately does not import net/http or Gin.
package identity

import (
	"time"

	infrastructuremail "github.com/singaurora/exec-graph/backend/internal/infrastructure/mail"
	contractpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/contract"
	identitypersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/identity"
	infrastructureredis "github.com/singaurora/exec-graph/backend/internal/infrastructure/redis"
)

// Dependencies 是身份领域服务启动所需的基础设施依赖。
type Dependencies struct {
	Repository identitypersistence.IdentityRepository
	Contracts  contractpersistence.SmartContractRepository
	Mailer     *infrastructuremail.Mailer
	Sessions   *infrastructureredis.SessionStore
	CodeTTL    time.Duration
	SessionTTL time.Duration
}

// Service 是身份领域的应用服务。
type Service struct {
	repository identitypersistence.IdentityRepository
	contracts  contractpersistence.SmartContractRepository
	mailer     *infrastructuremail.Mailer
	sessions   *infrastructureredis.SessionStore
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
		codeTTL:    dependencies.CodeTTL,
		sessionTTL: dependencies.SessionTTL,
	}
}
