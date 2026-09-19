package endpoint

import (
	"database/sql"
	"time"

	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationcollaboration "github.com/singaurora/exec-graph/backend/internal/application/collaboration"
	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	infrastructuremail "github.com/singaurora/exec-graph/backend/internal/infrastructure/mail"
	infrastructureredis "github.com/singaurora/exec-graph/backend/internal/infrastructure/redis"
	infrastructurestorage "github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	"gorm.io/gorm"
)

// Dependencies are the infrastructure implementations used by the HTTP API.
// Bootstrap owns their construction; handlers only receive this assembled set.
type Dependencies struct {
	DB      *sql.DB
	ORM     *gorm.DB
	Mailer  *infrastructuremail.Mailer
	Storage infrastructurestorage.ObjectStorage
	Redis   *infrastructureredis.SessionStore
	Config  bootstrapconfig.Config
}

type Server struct {
	db            *sql.DB
	orm           *gorm.DB
	mailer        *infrastructuremail.Mailer
	storage       infrastructurestorage.ObjectStorage
	redis         *infrastructureredis.SessionStore
	config        bootstrapconfig.Config
	identity      *applicationidentity.Service
	project       *applicationproject.Service
	aiKey         *applicationaikey.Service
	collaboration *applicationcollaboration.Service
}

func NewServer(dependencies Dependencies) *Server {
	server := &Server{
		db:      dependencies.DB,
		orm:     dependencies.ORM,
		mailer:  dependencies.Mailer,
		storage: dependencies.Storage,
		redis:   dependencies.Redis,
		config:  dependencies.Config,
	}
	server.identity = applicationidentity.New(applicationidentity.Dependencies{
		ORM: dependencies.ORM, Mailer: dependencies.Mailer, Sessions: dependencies.Redis,
		CodeTTL:    time.Duration(dependencies.Config.Mail.CodeTTLMinutes) * time.Minute,
		SessionTTL: time.Duration(dependencies.Config.App.SessionTTLHours) * time.Hour,
	})
	server.project = applicationproject.New(dependencies.DB, dependencies.ORM)
	server.aiKey = applicationaikey.New(dependencies.ORM)
	server.collaboration = applicationcollaboration.New(dependencies.DB)
	return server
}
