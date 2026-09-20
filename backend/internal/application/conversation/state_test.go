package conversation

import (
	"context"
	"errors"
	"testing"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

type lateResponseRepository struct {
	persistCalled bool
}

func (repository *lateResponseRepository) FindConversation(context.Context, uint64, string) (ConversationRecordView, error) {
	contextJSON := `{"project":{"uuid":"project-1","title":"项目"},"node":{"title":"节点","verifiableGoal":"完成目标","acceptanceCriteria":[{"id":"C1","text":"完成一项","requiredEvidence":"说明"}],"evidenceRequirement":"提供说明"}}`
	nodeID := "node-1"
	return ConversationRecordView{
		Conversation: ConversationRecord{UUID: "conversation-1", Phase: "completion", Status: "active", ContextJSON: contextJSON},
		ProjectID:    "project-1",
		NodeID:       &nodeID,
		Messages:     []MessageRecord{},
	}, nil
}

func (repository *lateResponseRepository) AddUserMessage(context.Context, string, uint64, string, string) error {
	return nil
}

func (repository *lateResponseRepository) PersistCompletionReview(context.Context, uint64, string, string, string, string, string, string, string, string, string, string) error {
	repository.persistCalled = true
	return ErrNoLongerMutable
}

func (*lateResponseRepository) ListPlanningMessages(context.Context, string, uint64) ([]PlanningMessage, error) {
	return nil, nil
}
func (*lateResponseRepository) UpdateReviewMessages(context.Context, string, string) error {
	return nil
}
func (*lateResponseRepository) FindProjectContext(context.Context, uint64, string) (ProjectContext, error) {
	return ProjectContext{}, ErrNotFound
}
func (*lateResponseRepository) ListSourceContexts(context.Context, string, []string) ([]SourceContext, error) {
	return nil, nil
}
func (*lateResponseRepository) FindPlanningConversation(context.Context, uint64, string, string) (string, error) {
	return "", ErrNotFound
}
func (*lateResponseRepository) CreatePlanningConversation(context.Context, string, uint64, string, string) error {
	return nil
}
func (*lateResponseRepository) FindCompletionConversation(context.Context, uint64, string, string) (string, error) {
	return "", ErrNotFound
}
func (*lateResponseRepository) FindCompletionContext(context.Context, uint64, string, string) (CompletionContext, error) {
	return CompletionContext{}, ErrNotFound
}
func (*lateResponseRepository) CreateCompletionConversation(context.Context, string, uint64, string, string, string, string) error {
	return nil
}
func (*lateResponseRepository) UpdatePlanningConversation(context.Context, uint64, string, string, string, string, string, string, string) error {
	return nil
}

type conversationCredentialStub struct{}

func (conversationCredentialStub) FindProjectReviewKey(context.Context, uint64, string) (applicationaikey.Credential, error) {
	return applicationaikey.Credential{ID: "key-1", Provider: "openai", Secret: "secret", BaseURL: "https://example.com", Model: "model"}, nil
}
func (conversationCredentialStub) MarkAIKeyUsed(context.Context, uint64, string) error { return nil }

type conversationModelStub struct{}

func (conversationModelStub) GenerateContent(context.Context, applicationaigateway.GenerateInput) (string, error) {
	return `{"reply":"审查完成","review":{"verdict":"pass","summary":"通过","criterionReviews":[{"criterionId":"C1","result":"met","reason":"已说明"}],"suggestedSupplementTitle":""},"requiresSupplement":false}`, nil
}

func TestLateCompletionResponseDoesNotOverwriteLockedNode(t *testing.T) {
	repository := &lateResponseRepository{}
	service := New(Dependencies{
		Repository:  repository,
		Credentials: conversationCredentialStub{},
		ModelClient: conversationModelStub{},
		Reviewer:    applicationreview.New(applicationreview.Dependencies{}),
	})
	_, err := service.SendMessage(context.Background(), 7, "conversation-1", "已完成", false)
	if err == nil {
		t.Fatal("SendMessage returned nil error")
	}
	var businessError *fault.Error
	if !errors.As(err, &businessError) || businessError.Kind != fault.Conflict {
		t.Fatalf("error = %v, want conflict", err)
	}
	if !repository.persistCalled {
		t.Fatal("expected persistence recheck to run")
	}
}
