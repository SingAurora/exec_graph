// Package conversation contains GORM persistence for planning and completion conversations.
package conversation

import (
	"context"
	"errors"
	"time"

	applicationconversation "github.com/singaurora/exec-graph/backend/internal/application/conversation"
	"gorm.io/gorm"
)

// ErrNotFound indicates that a requested conversation or context does not exist.
var ErrNotFound = applicationconversation.ErrNotFound

// Repository owns execution-domain SQL and transactions. Callers never receive
// a database connection; they only use this domain persistence boundary.
type Repository struct {
	orm *gorm.DB
}

type NodeConversationMessage struct {
	ID                    uint64    `gorm:"column:id;primaryKey"`
	UUID                  string    `gorm:"column:uuid"`
	ConversationID        uint64    `gorm:"column:conversation_id"`
	Role                  string    `gorm:"column:role"`
	Body                  string    `gorm:"column:body"`
	StructuredPayloadJSON *string   `gorm:"column:structured_payload_json"`
	AIConfigJSON          *string   `gorm:"column:ai_config_json"`
	CreatedAt             time.Time `gorm:"column:created_at"`
}

func (NodeConversationMessage) TableName() string { return "node_conversation_messages" }

type NodeConversation struct {
	ID               uint64    `gorm:"column:id;primaryKey"`
	UUID             string    `gorm:"column:uuid"`
	ProjectID        uint64    `gorm:"column:project_id"`
	NodeID           *uint64   `gorm:"column:node_id"`
	OwnerID          uint64    `gorm:"column:owner_id"`
	Phase            string    `gorm:"column:phase"`
	Status           string    `gorm:"column:status"`
	ContextJSON      string    `gorm:"column:context_json"`
	CurrentDraftJSON *string   `gorm:"column:current_draft_json"`
	LatestReviewJSON *string   `gorm:"column:latest_review_json"`
	AIConfigJSON     *string   `gorm:"column:ai_config_json"`
	CreatedAt        time.Time `gorm:"column:created_at"`
	UpdatedAt        time.Time `gorm:"column:updated_at"`
}

func (NodeConversation) TableName() string { return "node_conversations" }

// ProjectContext is the project context needed to start a planning conversation.
type ProjectContext struct {
	ID                       uint64     `gorm:"column:id"`
	UUID                     string     `gorm:"column:uuid"`
	Title                    string     `gorm:"column:title"`
	Description              string     `gorm:"column:description"`
	Rules                    string     `gorm:"column:rules"`
	ContributionCallID       *uint64    `gorm:"column:contribution_call_id"`
	ArchivedAt               *time.Time `gorm:"column:archived_at"`
	SmartContractID          string     `gorm:"column:smart_contract_id"`
	SmartContractName        string     `gorm:"column:smart_contract_name"`
	SmartContractDescription string     `gorm:"column:smart_contract_description"`
	SmartContractBody        string     `gorm:"column:smart_contract_body"`
}

func (ProjectContext) TableName() string { return "projects" }

// SourceContext is an execution node projection included in planning context.
type SourceContext struct {
	UUID                string  `gorm:"column:uuid"`
	Title               string  `gorm:"column:title"`
	Goal                string  `gorm:"column:verifiable_goal"`
	EvidenceRequirement string  `gorm:"column:evidence_requirement"`
	Stage               string  `gorm:"column:stage"`
	CompletionClaim     *string `gorm:"column:completion_claim"`
	EvidenceText        *string `gorm:"column:evidence_text"`
	ReviewJSON          *string `gorm:"column:ai_review_json"`
}

// CompletionContext is the project and node data for a completion conversation.
type CompletionContext struct {
	NodeTitle                string `gorm:"column:node_title"`
	Goal                     string `gorm:"column:verifiable_goal"`
	EvidenceRequirement      string `gorm:"column:evidence_requirement"`
	AcceptanceCriteriaJSON   string `gorm:"column:acceptance_criteria_json"`
	Stage                    string `gorm:"column:stage"`
	ProjectTitle             string `gorm:"column:project_title"`
	ProjectDescription       string `gorm:"column:project_description"`
	Rules                    string `gorm:"column:rules"`
	SmartContractID          string `gorm:"column:smart_contract_id"`
	SmartContractName        string `gorm:"column:smart_contract_name"`
	SmartContractDescription string `gorm:"column:smart_contract_description"`
	SmartContractBody        string `gorm:"column:smart_contract_body"`
}

// ConversationView is a typed conversation projection.
type ConversationView struct {
	Conversation NodeConversation
	ProjectID    string
	NodeID       *string
	Messages     []NodeConversationMessage
}

type ExecutionContract struct {
	ID                       uint64  `gorm:"column:id;primaryKey"`
	UUID                     string  `gorm:"column:uuid"`
	ProjectID                uint64  `gorm:"column:project_id"`
	BranchID                 *uint64 `gorm:"column:branch_id"`
	Title                    string  `gorm:"column:title"`
	Goal                     string  `gorm:"column:verifiable_goal"`
	CriteriaJSON             string  `gorm:"column:acceptance_criteria_json"`
	EvidenceRequirement      string  `gorm:"column:evidence_requirement"`
	Stage                    string  `gorm:"column:stage"`
	CompletionClaim          *string `gorm:"column:completion_claim"`
	CompletionRecordID       *uint64 `gorm:"column:completion_record_id"`
	CompletionConversationID *uint64 `gorm:"column:completion_conversation_id"`
	ReviewMessagesJSON       string  `gorm:"column:review_messages_json"`
}

func (ExecutionContract) TableName() string { return "execution_contracts" }

func NewRepository(orm *gorm.DB) *Repository { return &Repository{orm: orm} }

func (repository *Repository) ListPlanningMessages(ctx context.Context, conversationID string, ownerID uint64) ([]applicationconversation.PlanningMessage, error) {
	var messages []applicationconversation.PlanningMessage
	err := repository.orm.WithContext(ctx).Table("node_conversation_messages AS m").
		Select("m.uuid, m.role, m.body, m.created_at").
		Joins("JOIN node_conversations AS c ON c.id = m.conversation_id").
		Where("c.uuid = ? AND c.owner_id = ?", conversationID, ownerID).
		Order("m.created_at ASC, m.uuid ASC").Scan(&messages).Error
	return messages, err
}

func (repository *Repository) UpdateReviewMessages(ctx context.Context, nodeID, messagesJSON string) error {
	return repository.orm.WithContext(ctx).Model(&ExecutionContract{}).
		Where("uuid = ?", nodeID).Update("review_messages_json", messagesJSON).Error
}

// FindProjectContext loads an owned project for planning.
func (repository *Repository) FindProjectContext(ctx context.Context, userID uint64, projectID string) (applicationconversation.ProjectContext, error) {
	var value ProjectContext
	result := repository.orm.WithContext(ctx).Table("projects AS p").Select(`p.id, p.uuid, p.title, p.description, COALESCE(p.project_rules, '') AS rules, p.contribution_call_id, p.archived_at,
		COALESCE(sc.uuid, '') AS smart_contract_id,
		COALESCE(r.smart_contract_name, sc.name, '') AS smart_contract_name,
		COALESCE(r.smart_contract_description, sc.description, '') AS smart_contract_description,
		COALESCE(r.smart_contract_body, sc.body, '') AS smart_contract_body`).
		Joins("LEFT JOIN project_contract_revisions AS r ON r.id = p.active_contract_revision_id").
		Joins("LEFT JOIN smart_contracts AS sc ON sc.id = r.smart_contract_id").
		Where("p.uuid = ? AND p.owner_id = ?", projectID, userID).Scan(&value)
	err := result.Error
	if err == nil && result.RowsAffected == 0 {
		return applicationconversation.ProjectContext{}, applicationconversation.ErrNotFound
	}
	if err != nil {
		return applicationconversation.ProjectContext{}, err
	}
	resultValue := applicationconversation.ProjectContext{UUID: value.UUID, Title: value.Title, Description: value.Description, Rules: value.Rules, ArchivedAt: value.ArchivedAt, SmartContractID: value.SmartContractID, SmartContractName: value.SmartContractName, SmartContractDescription: value.SmartContractDescription, SmartContractBody: value.SmartContractBody}
	if value.ContributionCallID != nil {
		var call struct {
			UUID string `gorm:"column:uuid"`
		}
		if err := repository.orm.WithContext(ctx).Table("collaboration_calls").Select("uuid").Where("id = ?", *value.ContributionCallID).First(&call).Error; err != nil {
			return applicationconversation.ProjectContext{}, err
		}
		resultValue.ContributionCallID = &call.UUID
	}
	return resultValue, nil
}

// ListSourceContexts loads node facts used by a planning conversation.
func (repository *Repository) ListSourceContexts(ctx context.Context, projectID string, sourceIDs []string) ([]applicationconversation.SourceContext, error) {
	if len(sourceIDs) == 0 {
		return []applicationconversation.SourceContext{}, nil
	}
	var values []SourceContext
	err := repository.orm.WithContext(ctx).Table("execution_contracts AS n").Select("n.uuid, n.title, n.verifiable_goal, n.evidence_requirement, n.stage, n.completion_claim, n.evidence_text, n.ai_review_json").Joins("JOIN projects AS p ON p.id = n.project_id").Where("p.uuid = ? AND n.uuid IN ?", projectID, sourceIDs).Find(&values).Error
	result := make([]applicationconversation.SourceContext, 0, len(values))
	for _, value := range values {
		result = append(result, applicationconversation.SourceContext{UUID: value.UUID, Title: value.Title, Goal: value.Goal, EvidenceRequirement: value.EvidenceRequirement, Stage: value.Stage, CompletionClaim: value.CompletionClaim, EvidenceText: value.EvidenceText, ReviewJSON: value.ReviewJSON})
	}
	return result, err
}

// FindPlanningConversation finds an existing mutable planning conversation.
func (repository *Repository) FindPlanningConversation(ctx context.Context, userID uint64, projectID, contextJSON string) (string, error) {
	var value NodeConversation
	err := repository.orm.WithContext(ctx).Where("project_id IN (SELECT id FROM projects WHERE uuid = ?) AND owner_id = ? AND phase = ? AND status IN ? AND context_json = ?", projectID, userID, "planning", []string{"active", "ready_for_freeze"}, contextJSON).Order("updated_at DESC").First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", applicationconversation.ErrNotFound
	}
	return value.UUID, err
}

// CreatePlanningConversation creates a planning conversation for an owned project.
func (repository *Repository) CreatePlanningConversation(ctx context.Context, id string, userID uint64, projectID, contextJSON string) error {
	var project ProjectContext
	if err := repository.orm.WithContext(ctx).Table("projects").Where("uuid = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return applicationconversation.ErrNotFound
		}
		return err
	}
	return repository.orm.WithContext(ctx).Create(&NodeConversation{UUID: id, ProjectID: project.ID, OwnerID: userID, Phase: "planning", Status: "active", ContextJSON: contextJSON}).Error
}

// FindRevisionTarget loads the current mutable node and its existing task requirement.
func (repository *Repository) FindRevisionTarget(ctx context.Context, userID uint64, projectID, nodeID string) (applicationconversation.RevisionTarget, error) {
	var value struct {
		NodeUUID         string     `gorm:"column:node_uuid"`
		Title            string     `gorm:"column:title"`
		Goal             string     `gorm:"column:verifiable_goal"`
		CriteriaJSON     string     `gorm:"column:acceptance_criteria_json"`
		Evidence         string     `gorm:"column:evidence_requirement"`
		Stage            string     `gorm:"column:stage"`
		CompletionClaim  *string    `gorm:"column:completion_claim"`
		CompletionRecord *uint64    `gorm:"column:completion_record_id"`
		ArchivedAt       *time.Time `gorm:"column:archived_at"`
		ProjectCurrentID *uint64    `gorm:"column:project_current_id"`
		BranchCurrentID  *uint64    `gorm:"column:branch_current_id"`
		BranchID         *uint64    `gorm:"column:branch_id"`
		NodeInternalID   uint64     `gorm:"column:node_internal_id"`
	}
	result := repository.orm.WithContext(ctx).Table("execution_contracts AS n").Select(`
		n.id AS node_internal_id, n.uuid AS node_uuid, n.title, n.verifiable_goal,
		n.acceptance_criteria_json, n.evidence_requirement, n.stage, n.completion_claim,
		n.completion_record_id, n.branch_id, p.archived_at, p.current_contract_id AS project_current_id,
		b.current_contract_id AS branch_current_id`).
		Joins("JOIN projects AS p ON p.id = n.project_id AND p.owner_id = ? AND p.uuid = ?", userID, projectID).
		Joins("LEFT JOIN execution_branches AS b ON b.id = n.branch_id").
		Where("n.uuid = ? AND n.project_id = p.id", nodeID).Scan(&value)
	if result.Error != nil {
		return applicationconversation.RevisionTarget{}, result.Error
	}
	if result.RowsAffected == 0 {
		return applicationconversation.RevisionTarget{}, applicationconversation.ErrNotFound
	}
	current := value.ProjectCurrentID != nil && *value.ProjectCurrentID == value.NodeInternalID
	if value.BranchID != nil {
		current = value.BranchCurrentID != nil && *value.BranchCurrentID == value.NodeInternalID
	}
	return applicationconversation.RevisionTarget{
		NodeUUID: value.NodeUUID, Title: value.Title, Goal: value.Goal, CriteriaJSON: value.CriteriaJSON,
		EvidenceRequirement: value.Evidence, Stage: value.Stage, Current: current,
		Archived: value.ArchivedAt != nil, HasCompletionRecord: value.CompletionRecord != nil || value.CompletionClaim != nil,
	}, nil
}

// FindRevisionConversation finds the active task-requirement revision conversation for a node.
func (repository *Repository) FindRevisionConversation(ctx context.Context, userID uint64, nodeID string) (string, error) {
	var value NodeConversation
	err := repository.orm.WithContext(ctx).Table("node_conversations AS c").
		Joins("JOIN execution_contracts AS n ON n.id = c.node_id").
		Where("n.uuid = ? AND c.owner_id = ? AND c.phase = ? AND c.status IN ?", nodeID, userID, "planning", []string{"active", "ready_for_freeze"}).
		Order("c.updated_at DESC").First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", applicationconversation.ErrNotFound
	}
	return value.UUID, err
}

// CreateRevisionConversation creates a planning conversation linked to the current node.
func (repository *Repository) CreateRevisionConversation(ctx context.Context, conversationUUID string, userID uint64, projectID, nodeID, contextJSON string) error {
	return repository.orm.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var project ProjectContext
		if err := tx.Where("uuid = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return applicationconversation.ErrNotFound
			}
			return err
		}
		var node ExecutionContract
		if err := tx.Where("uuid = ? AND project_id = ?", nodeID, project.ID).First(&node).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return applicationconversation.ErrNotFound
			}
			return err
		}
		if node.Stage != "frozen" || node.CompletionRecordID != nil || node.CompletionClaim != nil {
			return applicationconversation.ErrNoLongerMutable
		}
		conversation := NodeConversation{UUID: conversationUUID, ProjectID: project.ID, NodeID: &node.ID, OwnerID: userID, Phase: "planning", Status: "active", ContextJSON: contextJSON}
		return tx.Create(&conversation).Error
	})
}

// SaveRevision atomically replaces task requirements and removes the old completion conversation.
func (repository *Repository) SaveRevision(ctx context.Context, input applicationconversation.RevisionSave) error {
	return repository.orm.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var revisionConversation NodeConversation
		if err := tx.Where("uuid = ? AND owner_id = ? AND phase = ? AND status = ?", input.ConversationUUID, input.UserID, "planning", "ready_for_freeze").First(&revisionConversation).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return applicationconversation.ErrNoLongerMutable
			}
			return err
		}
		var node ExecutionContract
		if err := tx.Table("execution_contracts AS n").Select("n.*").Joins("JOIN projects AS p ON p.id = n.project_id AND p.owner_id = ?", input.UserID).Where("n.uuid = ? AND n.id = ?", input.NodeUUID, revisionConversation.NodeID).First(&node).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return applicationconversation.ErrNoLongerMutable
			}
			return err
		}
		var project struct {
			ID         uint64     `gorm:"column:id"`
			ArchivedAt *time.Time `gorm:"column:archived_at"`
			CurrentID  *uint64    `gorm:"column:current_contract_id"`
		}
		if err := tx.Table("projects").Select("id, archived_at, current_contract_id").Where("id = ? AND owner_id = ?", node.ProjectID, input.UserID).First(&project).Error; err != nil {
			return err
		}
		current := project.CurrentID != nil && *project.CurrentID == node.ID
		if node.BranchID != nil {
			var branch struct {
				CurrentID *uint64 `gorm:"column:current_contract_id"`
			}
			if err := tx.Table("execution_branches").Select("current_contract_id").Where("id = ? AND project_id = ?", *node.BranchID, project.ID).First(&branch).Error; err != nil {
				return err
			}
			current = branch.CurrentID != nil && *branch.CurrentID == node.ID
		}
		if project.ArchivedAt != nil || !current || node.Stage != "frozen" || node.CompletionRecordID != nil || node.CompletionClaim != nil {
			return applicationconversation.ErrNoLongerMutable
		}
		if node.CompletionConversationID != nil {
			completionConversationID := *node.CompletionConversationID
			if err := tx.Where("conversation_id = ?", *node.CompletionConversationID).Delete(&NodeConversationMessage{}).Error; err != nil {
				return err
			}
			if err := tx.Model(&node).Update("completion_conversation_id", nil).Error; err != nil {
				return err
			}
			if err := tx.Where("id = ?", completionConversationID).Delete(&NodeConversation{}).Error; err != nil {
				return err
			}
		}
		updates := map[string]any{
			"title": input.Title, "original_intent": input.OriginalIntent, "verifiable_goal": input.Goal, "acceptance_criteria_json": input.CriteriaJSON,
			"evidence_requirement": input.EvidenceRequirement, "draft_review_json": input.ReviewJSON,
			"draft_review_ai_config_json": input.AIConfigJSON, "planning_conversation_id": revisionConversation.ID,
			"completion_conversation_id": nil, "completion_claim": nil, "evidence_text": nil,
			"started_at": nil, "ended_at": nil, "ai_review_json": nil,
			"completion_review_ai_config_json": nil, "completion_review_rounds_json": nil,
			"review_messages_json": input.MessagesJSON, "stage": "frozen",
		}
		if err := tx.Model(&node).Updates(updates).Error; err != nil {
			return err
		}
		return tx.Model(&revisionConversation).Updates(map[string]any{
			"node_id": node.ID, "status": "frozen", "current_draft_json": input.DraftJSON,
			"latest_review_json": input.ReviewJSON, "ai_config_json": input.AIConfigJSON,
		}).Error
	})
}

// FindCompletionConversation finds an active completion conversation.
func (repository *Repository) FindCompletionConversation(ctx context.Context, userID uint64, projectID, nodeID string) (string, error) {
	var value NodeConversation
	err := repository.orm.WithContext(ctx).Table("node_conversations AS c").Joins("JOIN projects AS p ON p.id = c.project_id").Joins("JOIN execution_contracts AS n ON n.id = c.node_id").Where("p.uuid = ? AND n.uuid = ? AND c.owner_id = ? AND c.phase = ? AND c.status = ?", projectID, nodeID, userID, "completion", "active").Order("c.updated_at DESC").First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", applicationconversation.ErrNotFound
	}
	return value.UUID, err
}

// FindCompletionContext loads a node and its owning project.
func (repository *Repository) FindCompletionContext(ctx context.Context, userID uint64, projectID, nodeID string) (applicationconversation.CompletionContext, error) {
	var value CompletionContext
	result := repository.orm.WithContext(ctx).Table("execution_contracts AS n").Select(`n.title AS node_title, n.verifiable_goal, n.evidence_requirement, n.acceptance_criteria_json, n.stage,
		p.title AS project_title, p.description AS project_description, COALESCE(p.project_rules, '') AS rules,
		sc.uuid AS smart_contract_id,
		COALESCE(revision.smart_contract_name, sc.name, '') AS smart_contract_name,
		COALESCE(revision.smart_contract_description, sc.description, '') AS smart_contract_description,
		COALESCE(revision.smart_contract_body, sc.body, '') AS smart_contract_body`).
		Joins("JOIN projects AS p ON p.id = n.project_id").
		Joins("JOIN project_contract_revisions AS revision ON revision.id = n.project_contract_revision_id").
		Joins("JOIN smart_contracts AS sc ON sc.id = n.smart_contract_id").
		Where("n.uuid = ? AND p.uuid = ? AND p.owner_id = ?", nodeID, projectID, userID).Scan(&value)
	err := result.Error
	if err == nil && result.RowsAffected == 0 {
		return applicationconversation.CompletionContext{}, applicationconversation.ErrNotFound
	}
	return applicationconversation.CompletionContext{NodeTitle: value.NodeTitle, Goal: value.Goal, EvidenceRequirement: value.EvidenceRequirement, AcceptanceCriteriaJSON: value.AcceptanceCriteriaJSON, Stage: value.Stage, ProjectTitle: value.ProjectTitle, ProjectDescription: value.ProjectDescription, Rules: value.Rules, SmartContractID: value.SmartContractID, SmartContractName: value.SmartContractName, SmartContractDescription: value.SmartContractDescription, SmartContractBody: value.SmartContractBody}, err
}

// CreateCompletionConversation creates and links a completion conversation atomically.
func (repository *Repository) CreateCompletionConversation(ctx context.Context, id string, userID uint64, projectID, nodeID, contextJSON, configJSON string) error {
	return repository.orm.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var project ProjectContext
		if err := tx.Where("uuid = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return applicationconversation.ErrNotFound
			}
			return err
		}
		var node ExecutionContract
		if err := tx.Where("uuid = ? AND project_id = ?", nodeID, project.ID).First(&node).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return applicationconversation.ErrNotFound
			}
			return err
		}
		conversation := NodeConversation{UUID: id, ProjectID: project.ID, NodeID: &node.ID, OwnerID: userID, Phase: "completion", Status: "active", ContextJSON: contextJSON, AIConfigJSON: &configJSON}
		if err := tx.Create(&conversation).Error; err != nil {
			return err
		}
		return tx.Model(&node).Update("completion_conversation_id", conversation.ID).Error
	})
}

// FindConversation loads a conversation owned by a user.
func (repository *Repository) FindConversation(ctx context.Context, userID uint64, id string) (applicationconversation.ConversationRecordView, error) {
	var value ConversationView
	var conversation NodeConversation
	err := repository.orm.WithContext(ctx).Where("uuid = ? AND owner_id = ?", id, userID).First(&conversation).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return applicationconversation.ConversationRecordView{}, applicationconversation.ErrNotFound
		}
		return applicationconversation.ConversationRecordView{}, err
	}
	value.Conversation = conversation
	var project struct {
		UUID string `gorm:"column:uuid"`
	}
	if err := repository.orm.WithContext(ctx).Table("projects").Select("uuid").Where("id = ?", conversation.ProjectID).Scan(&project).Error; err != nil {
		return applicationconversation.ConversationRecordView{}, err
	}
	value.ProjectID = project.UUID
	if conversation.NodeID != nil {
		var node struct {
			UUID string `gorm:"column:uuid"`
		}
		if err := repository.orm.WithContext(ctx).Table("execution_contracts").Select("uuid").Where("id = ?", *conversation.NodeID).Scan(&node).Error; err != nil {
			return applicationconversation.ConversationRecordView{}, err
		}
		value.NodeID = &node.UUID
	}
	if err := repository.orm.WithContext(ctx).Where("conversation_id = ?", conversation.ID).Order("created_at ASC, id ASC").Find(&value.Messages).Error; err != nil {
		return applicationconversation.ConversationRecordView{}, err
	}
	result := applicationconversation.ConversationRecordView{
		Conversation: applicationconversation.ConversationRecord{UUID: conversation.UUID, Phase: conversation.Phase, Status: conversation.Status, ContextJSON: conversation.ContextJSON, CurrentDraftJSON: conversation.CurrentDraftJSON, LatestReviewJSON: conversation.LatestReviewJSON, AIConfigJSON: conversation.AIConfigJSON, CreatedAt: conversation.CreatedAt, UpdatedAt: conversation.UpdatedAt},
		ProjectID:    value.ProjectID, NodeID: value.NodeID, Messages: make([]applicationconversation.MessageRecord, 0, len(value.Messages)),
	}
	for _, message := range value.Messages {
		result.Messages = append(result.Messages, applicationconversation.MessageRecord{UUID: message.UUID, Role: message.Role, Body: message.Body, StructuredPayloadJSON: message.StructuredPayloadJSON, AIConfigJSON: message.AIConfigJSON, CreatedAt: message.CreatedAt})
	}
	return result, nil
}

// ClearConversation deletes an active conversation and recreates an empty one with the same context.
func (repository *Repository) ClearConversation(ctx context.Context, userID uint64, conversationID, replacementID string) error {
	return repository.orm.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var conversation NodeConversation
		if err := tx.Where("uuid = ? AND owner_id = ? AND status NOT IN ?", conversationID, userID, []string{"frozen", "closed"}).First(&conversation).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return applicationconversation.ErrNoLongerMutable
			}
			return err
		}
		if err := tx.Where("conversation_id = ?", conversation.ID).Delete(&NodeConversationMessage{}).Error; err != nil {
			return err
		}
		if conversation.NodeID != nil && conversation.Phase == "completion" {
			if err := tx.Table("execution_contracts").Where("completion_conversation_id = ?", conversation.ID).Update("completion_conversation_id", nil).Error; err != nil {
				return err
			}
		}
		if conversation.NodeID != nil && conversation.Phase == "planning" {
			if err := tx.Table("execution_contracts").Where("planning_conversation_id = ?", conversation.ID).Update("planning_conversation_id", nil).Error; err != nil {
				return err
			}
		}
		if err := tx.Delete(&conversation).Error; err != nil {
			return err
		}
		replacement := NodeConversation{UUID: replacementID, ProjectID: conversation.ProjectID, NodeID: conversation.NodeID, OwnerID: conversation.OwnerID, Phase: conversation.Phase, Status: "active", ContextJSON: conversation.ContextJSON, AIConfigJSON: conversation.AIConfigJSON}
		if err := tx.Create(&replacement).Error; err != nil {
			return err
		}
		if replacement.NodeID != nil && replacement.Phase == "completion" {
			return tx.Table("execution_contracts").Where("id = ?", *replacement.NodeID).Update("completion_conversation_id", replacement.ID).Error
		}
		if replacement.NodeID != nil && replacement.Phase == "planning" {
			return tx.Table("execution_contracts").Where("id = ?", *replacement.NodeID).Update("planning_conversation_id", replacement.ID).Error
		}
		return nil
	})
}

// AddUserMessage stores a user message in an owned conversation.
func (repository *Repository) AddUserMessage(ctx context.Context, id string, userID uint64, conversationID, body string) error {
	var conversation NodeConversation
	if err := repository.orm.WithContext(ctx).Where("uuid = ? AND owner_id = ?", conversationID, userID).First(&conversation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return applicationconversation.ErrNotFound
		}
		return err
	}
	return repository.orm.WithContext(ctx).Create(&NodeConversationMessage{UUID: id, ConversationID: conversation.ID, Role: "user", Body: body}).Error
}

// AddAssistantMessage stores an assistant message in an owned conversation.
func (repository *Repository) AddAssistantMessage(ctx context.Context, id string, userID uint64, conversationID, body, payloadJSON, configJSON string) error {
	var conversation NodeConversation
	if err := repository.orm.WithContext(ctx).Where("uuid = ? AND owner_id = ?", conversationID, userID).First(&conversation).Error; err != nil {
		return err
	}
	return repository.orm.WithContext(ctx).Create(&NodeConversationMessage{UUID: id, ConversationID: conversation.ID, Role: "assistant", Body: body, StructuredPayloadJSON: &payloadJSON, AIConfigJSON: &configJSON}).Error
}

// UpdatePlanningConversation stores a planning draft and its assistant message.
func (repository *Repository) UpdatePlanningConversation(ctx context.Context, userID uint64, conversationID, status, draftJSON, messageID, body, payloadJSON, configJSON string) error {
	return repository.orm.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var conversation NodeConversation
		if err := tx.Where("uuid = ? AND owner_id = ? AND phase = ? AND status NOT IN ?", conversationID, userID, "planning", []string{"frozen", "closed"}).First(&conversation).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return applicationconversation.ErrNoLongerMutable
			}
			return err
		}
		if err := tx.Create(&NodeConversationMessage{UUID: messageID, ConversationID: conversation.ID, Role: "assistant", Body: body, StructuredPayloadJSON: &payloadJSON, AIConfigJSON: &configJSON}).Error; err != nil {
			return err
		}
		return tx.Model(&conversation).Updates(map[string]any{"status": status, "current_draft_json": draftJSON, "ai_config_json": configJSON}).Error
	})
}

// PersistCompletionReview atomically stores the final assistant review and updates the node.
func (repository *Repository) PersistCompletionReview(ctx context.Context, input applicationconversation.CompletionReviewSave) error {
	return repository.orm.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var conversation NodeConversation
		if err := tx.Where("uuid = ? AND owner_id = ? AND status = ?", input.ConversationID, input.UserID, "active").First(&conversation).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return applicationconversation.ErrNoLongerMutable
			}
			return err
		}
		var node ExecutionContract
		if err := tx.Where("uuid = ?", input.NodeID).First(&node).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return applicationconversation.ErrNoLongerMutable
			}
			return err
		}
		if node.Stage != "frozen" && node.Stage != "verified" && node.Stage != "needs_supplement" || node.CompletionConversationID == nil || *node.CompletionConversationID != conversation.ID {
			return applicationconversation.ErrNoLongerMutable
		}
		if err := tx.Create(&NodeConversationMessage{UUID: input.MessageID, ConversationID: conversation.ID, Role: "assistant", Body: input.Reply, StructuredPayloadJSON: &input.PayloadJSON, AIConfigJSON: &input.ConfigJSON}).Error; err != nil {
			return err
		}
		if err := tx.Model(&conversation).Updates(map[string]any{"status": "closed", "latest_review_json": input.ReviewJSON, "ai_config_json": input.ConfigJSON}).Error; err != nil {
			return err
		}
		return tx.Model(&node).Updates(map[string]any{"stage": input.Stage, "completion_claim": input.Claim, "evidence_text": input.Evidence, "started_at": input.StartedAt, "ended_at": input.EndedAt, "ai_review_json": input.ReviewJSON, "completion_review_ai_config_json": input.ConfigJSON, "completion_review_rounds_json": input.RoundsJSON, "review_messages_json": input.MessagesJSON}).Error
	})
}
