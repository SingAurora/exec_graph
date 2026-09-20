package conversation

import (
	"time"

	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
)

// Message 是规划对话中可复制到执行节点的消息视图。
type Message struct {
	ID        string
	Speaker   string
	Body      string
	CreatedAt time.Time
}

// ActionDraft 是规划对话当前形成的行动契约草案。
type ActionDraft struct {
	Title               string   `json:"title"`
	VerifiableGoal      string   `json:"verifiableGoal"`
	AcceptanceCriteria  []string `json:"acceptanceCriteria"`
	EvidenceRequirement string   `json:"evidenceRequirement"`
}

// MessageView 是对外返回的对话消息。
type MessageView struct {
	ID                string                              `json:"uuid"`
	Role              string                              `json:"role"`
	Body              string                              `json:"body"`
	StructuredPayload any                                 `json:"structuredPayload,omitempty"`
	AIConfig          *applicationreview.AIConfigSnapshot `json:"aiConfig,omitempty"`
	CreatedAt         time.Time                           `json:"createdAt"`
}

// View 是规划或完成审查对话的公开视图。
type View struct {
	ID           string                              `json:"uuid"`
	ProjectID    string                              `json:"projectUuid"`
	NodeID       *string                             `json:"nodeUuid,omitempty"`
	Phase        string                              `json:"phase"`
	Status       string                              `json:"status"`
	Context      any                                 `json:"context"`
	CurrentDraft *ActionDraft                        `json:"currentDraft,omitempty"`
	LatestReview any                                 `json:"latestReview,omitempty"`
	AIConfig     *applicationreview.AIConfigSnapshot `json:"aiConfig,omitempty"`
	Messages     []MessageView                       `json:"messages"`
	CreatedAt    time.Time                           `json:"createdAt"`
	UpdatedAt    time.Time                           `json:"updatedAt"`
}

// OpenPlanningInput 描述新规划对话与既有执行节点的关系。
type OpenPlanningInput struct {
	ProjectUUID              string   `json:"projectUuid"`
	ParentContractUUID       string   `json:"parentContractUuid"`
	SourceContractUUIDs      []string `json:"sourceContractUuids"`
	BranchUUID               string   `json:"branchUuid"`
	Fork                     bool     `json:"fork"`
	ClosureSourceUUIDs       []string `json:"closureSourceUuids"`
	SupplementOfContractUUID string   `json:"supplementOfContractUuid"`
	RetryOfContractUUID      string   `json:"retryOfContractUuid"`
}

// OpenCompletionInput 指定需要继续完成审查的项目与节点。
type OpenCompletionInput struct {
	ProjectUUID string `json:"projectUuid"`
	NodeUUID    string `json:"nodeUuid"`
}
