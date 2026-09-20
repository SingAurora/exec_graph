// Package endpoint adapts application use cases to HTTP handlers.
package endpoint

import (
	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationcollaboration "github.com/singaurora/exec-graph/backend/internal/application/collaboration"
	applicationconversation "github.com/singaurora/exec-graph/backend/internal/application/conversation"
	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	applicationnetwork "github.com/singaurora/exec-graph/backend/internal/application/network"
	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	applicationpublicprofile "github.com/singaurora/exec-graph/backend/internal/application/publicprofile"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
	applicationworkoverview "github.com/singaurora/exec-graph/backend/internal/application/workoverview"
	aikeyendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/aikey"
	executionendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/execution"
	identityendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/identity"
	networkendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/network"
	profileendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/profile"
	projectendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/project"
	workflowendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/workflow"
)

// WorkflowDependencies 是 workflow endpoint 使用的应用服务。
type WorkflowDependencies struct {
	Reviewer *applicationreview.Service
}

// Dependencies 是已经完成组装的 HTTP 依赖。具体仓储、服务和外部客户端只在
// bootstrap 层创建；endpoint 不持有 GORM 连接，也不决定使用哪种基础设施实现。
type Dependencies struct {
	Workflow     WorkflowDependencies
	Conversation *applicationconversation.Service
	WorkOverview *applicationworkoverview.Service

	Identity      *applicationidentity.Service
	Project       *applicationproject.Service
	Network       *applicationnetwork.Service
	PublicProfile *applicationpublicprofile.Service
	AIKey         *applicationaikey.Service
	Collaboration *applicationcollaboration.Service
}

// Server 聚合各领域 HTTP handler，并提供认证上下文等 HTTP 交叉能力。
// 它不创建仓储或 application service，保持 HTTP 层不依赖具体数据库连接。
type Server struct {
	identity *applicationidentity.Service

	projectEndpoints   *projectendpoint.Handler
	networkEndpoints   *networkendpoint.Handler
	aiKeyEndpoints     *aikeyendpoint.Handler
	identityEndpoints  *identityendpoint.Handler
	profileEndpoints   *profileendpoint.Handler
	executionEndpoints *executionendpoint.Handler
	workflowEndpoints  *workflowendpoint.Handler
}

func NewServer(dependencies Dependencies) *Server {
	server := &Server{identity: dependencies.Identity}
	server.projectEndpoints = projectendpoint.New(dependencies.Project)
	server.networkEndpoints = networkendpoint.New(dependencies.Network)
	server.aiKeyEndpoints = aikeyendpoint.New(dependencies.AIKey)
	server.identityEndpoints = identityendpoint.New(dependencies.Identity, server.requireUserError)
	server.profileEndpoints = profileendpoint.New(profileendpoint.Dependencies{
		Identity:      dependencies.Identity,
		PublicProfile: dependencies.PublicProfile,
		CacheSession:  server.cacheSession,
	})
	server.executionEndpoints = executionendpoint.New(executionendpoint.Dependencies{
		Project:      dependencies.Project,
		Conversation: dependencies.Conversation,
	})
	server.workflowEndpoints = workflowendpoint.New(workflowendpoint.Dependencies{
		Collaboration: dependencies.Collaboration,
		Conversation:  dependencies.Conversation,
		WorkOverview:  dependencies.WorkOverview,
		Reviewer:      dependencies.Workflow.Reviewer,
	})
	return server
}
