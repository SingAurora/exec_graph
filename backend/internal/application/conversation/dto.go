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

// CompletionProgressItem 描述当前对话对一条行动重点的临时判断。
// confirmed 只表示用户的当前说明已经覆盖该重点，不代表 AI 证明了现实结果。
type CompletionProgressItem struct {
	CriterionID string `json:"criterionId"`
	Status      string `json:"status"`
	Reason      string `json:"reason"`
}

// CompletionProgress 是完成说明对话每一轮的结构化覆盖状态。
type CompletionProgress struct {
	Confirmed    []CompletionProgressItem `json:"confirmed"`
	Unclear      []CompletionProgressItem `json:"unclear"`
	NotMentioned []CompletionProgressItem `json:"notMentioned"`
	NotCompleted []CompletionProgressItem `json:"notCompleted"`
}

// PlanningReview 是 AI 对当前行动草案是否可以保存的临时审查结论。
type PlanningReview struct {
	Verdict             string   `json:"verdict"`
	Summary             string   `json:"summary"`
	MissingRequirements []string `json:"missingRequirements"`
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
	ID                 string                              `json:"uuid"`
	ProjectID          string                              `json:"projectUuid"`
	NodeID             *string                             `json:"nodeUuid,omitempty"`
	Phase              string                              `json:"phase"`
	Status             string                              `json:"status"`
	Context            any                                 `json:"context"`
	CurrentDraft       *ActionDraft                        `json:"currentDraft,omitempty"`
	CurrentDraftReview *PlanningReview                     `json:"currentDraftReview,omitempty"`
	CurrentProgress    *CompletionProgress                 `json:"currentProgress,omitempty"`
	LatestReview       any                                 `json:"latestReview,omitempty"`
	AIConfig           *applicationreview.AIConfigSnapshot `json:"aiConfig,omitempty"`
	Messages           []MessageView                       `json:"messages"`
	CreatedAt          time.Time                           `json:"createdAt"`
	UpdatedAt          time.Time                           `json:"updatedAt"`
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

// OpenRevisionInput 指定要通过对话修改要求的当前节点。
type OpenRevisionInput struct {
	ProjectUUID string `json:"projectUuid"`
	NodeUUID    string `json:"nodeUuid"`
}

// FinalizeRevisionInput 指定已准备好保存的新任务要求对话。
type FinalizeRevisionInput struct {
	ConversationUUID string `json:"conversationUuid"`
}

// FinalizeCompletionInput 指定要结束的完成审查对话及可选的行动时间。
type FinalizeCompletionInput struct {
	ConversationUUID string     `json:"conversationUuid"`
	StartedAt        *time.Time `json:"startedAt,omitempty"`
	EndedAt          *time.Time `json:"endedAt,omitempty"`
}
