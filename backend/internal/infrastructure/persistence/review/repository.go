// Package review contains typed persistence operations for AI execution reviews.
package review

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
)

// Repository owns review-related database operations.
type Repository struct{ orm *gorm.DB }

// ErrNotFound indicates that a review target does not exist.
var ErrNotFound = gorm.ErrRecordNotFound

// NodeReviewContext is the complete node/project projection required by a review.
type NodeReviewContext struct {
	ProjectInternalID        uint64     `gorm:"column:project_internal_id"`
	NodeInternalID           uint64     `gorm:"column:node_internal_id"`
	ProjectID                string     `gorm:"column:project_id"`
	ProjectTitle             string     `gorm:"column:project_title"`
	ProjectDescription       string     `gorm:"column:project_description"`
	ProjectRules             string     `gorm:"column:project_rules"`
	ProjectCurrentID         *uint64    `gorm:"column:project_current_id"`
	ArchivedAt               *time.Time `gorm:"column:archived_at"`
	BranchID                 *uint64    `gorm:"column:branch_id"`
	NodeID                   string     `gorm:"column:node_id"`
	Title                    string     `gorm:"column:title"`
	OriginalIntent           string     `gorm:"column:original_intent"`
	Goal                     string     `gorm:"column:verifiable_goal"`
	CriteriaJSON             string     `gorm:"column:criteria_json"`
	EvidenceRequirement      string     `gorm:"column:evidence_requirement"`
	SmartContractID          string     `gorm:"column:smart_contract_id"`
	MessagesJSON             string     `gorm:"column:messages_json"`
	Stage                    string     `gorm:"column:stage"`
	Claim                    *string    `gorm:"column:completion_claim"`
	Evidence                 *string    `gorm:"column:evidence_text"`
	ReviewJSON               *string    `gorm:"column:ai_review_json"`
	ReviewConfigJSON         *string    `gorm:"column:review_config_json"`
	ReviewRoundsJSON         *string    `gorm:"column:review_rounds_json"`
	SmartContractName        string     `gorm:"column:smart_contract_name"`
	SmartContractDescription string     `gorm:"column:smart_contract_description"`
	SmartContractBody        string     `gorm:"column:smart_contract_body"`
}

// ReviewSaveInput contains the immutable submission and AI result fields.
type ReviewSaveInput struct {
	UserID                                                    uint64
	NodeID, CompletionClaim, EvidenceText                     string
	StartedAt, EndedAt                                        *time.Time
	Stage, ReviewJSON, AIConfigJSON, RoundsJSON, MessagesJSON string
}

// ClarificationSaveInput contains a follow-up review result.
type ClarificationSaveInput struct{ NodeID, Stage, ReviewJSON, AIConfigJSON, RoundsJSON, MessagesJSON string }

// ClosureSource is a closure predecessor projection.
type ClosureSource struct {
	ID       uint64 `gorm:"column:id"`
	UUID     string `gorm:"column:uuid"`
	Title    string `gorm:"column:title"`
	Goal     string `gorm:"column:verifiable_goal"`
	Criteria string `gorm:"column:acceptance_criteria_json"`
	Evidence string `gorm:"column:evidence_requirement"`
}

// NewRepository creates a review repository.
func NewRepository(orm *gorm.DB) *Repository { return &Repository{orm: orm} }

// LoadNodeReviewContext returns the node and project facts needed before AI review.
func (repository *Repository) LoadNodeReviewContext(ctx context.Context, userID uint64, nodeID string) (NodeReviewContext, error) {
	var value NodeReviewContext
	result := repository.orm.WithContext(ctx).Table("execution_contracts AS n").Select(`p.id AS project_internal_id, n.id AS node_internal_id, p.uuid AS project_id, p.title AS project_title, p.description AS project_description, COALESCE(p.project_rules, '') AS project_rules, p.current_contract_id AS project_current_id, p.archived_at, n.branch_id, n.uuid AS node_id, n.title, n.original_intent, n.verifiable_goal, n.acceptance_criteria_json AS criteria_json, n.evidence_requirement, sc.uuid AS smart_contract_id, n.review_messages_json AS messages_json, n.stage, n.completion_claim, n.evidence_text, n.ai_review_json, n.completion_review_ai_config_json AS review_config_json, n.completion_review_rounds_json AS review_rounds_json, sc.name AS smart_contract_name, sc.description AS smart_contract_description, sc.body AS smart_contract_body`).Joins("JOIN projects AS p ON p.id = n.project_id").Joins("JOIN smart_contracts AS sc ON sc.id = n.smart_contract_id").Where("n.uuid = ? AND p.owner_id = ?", nodeID, userID).Scan(&value)
	if result.Error != nil {
		return value, result.Error
	}
	if result.RowsAffected == 0 {
		return value, gorm.ErrRecordNotFound
	}
	return value, nil
}

// FindInternalID resolves an internal ID for a whitelisted review table.
func (repository *Repository) FindInternalID(ctx context.Context, table, uuid string) (uint64, error) {
	allowed := map[string]bool{"projects": true, "execution_contracts": true}
	if !allowed[table] {
		return 0, errors.New("unsupported review entity")
	}
	var value struct {
		ID uint64 `gorm:"column:id"`
	}
	err := repository.orm.WithContext(ctx).Table(table).Select("id").Where("uuid = ?", uuid).First(&value).Error
	return value.ID, err
}

// ListClosureSourceIDs lists immediate closure predecessors.
func (repository *Repository) ListClosureSourceIDs(ctx context.Context, targetID uint64) ([]uint64, error) {
	var values []uint64
	err := repository.orm.WithContext(ctx).Table("execution_edges").Where("target_contract_id = ? AND type = ?", targetID, "closure").Pluck("source_contract_id", &values).Error
	return values, err
}

// LoadBranchCurrent loads the current node of a branch while keeping IDs internal.
func (repository *Repository) LoadBranchCurrent(ctx context.Context, branchID, projectID uint64, target **uint64) error {
	var value struct {
		CurrentID *uint64 `gorm:"column:current_contract_id"`
	}
	err := repository.orm.WithContext(ctx).Table("execution_branches").Select("current_contract_id").Where("id = ? AND project_id = ?", branchID, projectID).First(&value).Error
	if err != nil {
		return err
	}
	*target = value.CurrentID
	return nil
}

// LoadClosureSource loads one closure predecessor in a project.
func (repository *Repository) LoadClosureSource(ctx context.Context, sourceID, projectID uint64) (ClosureSource, error) {
	var value ClosureSource
	err := repository.orm.WithContext(ctx).Table("execution_contracts").Select("id, uuid, title, verifiable_goal, acceptance_criteria_json, evidence_requirement").Where("id = ? AND project_id = ?", sourceID, projectID).First(&value).Error
	return value, err
}

// FindSmartContract returns a visible contract body by UUID.
func (repository *Repository) FindSmartContract(ctx context.Context, id string) (struct{ Name, Description, Body string }, error) {
	var value struct{ Name, Description, Body string }
	err := repository.orm.WithContext(ctx).Table("smart_contracts").Select("name, description, body").Where("uuid = ? AND deleted_at IS NULL", id).First(&value).Error
	return value, err
}

// SaveInitialReview stores the first submission review if the node is still frozen.
func (repository *Repository) SaveInitialReview(ctx context.Context, input ReviewSaveInput) (bool, error) {
	result := repository.orm.WithContext(ctx).Table("execution_contracts").Where("uuid = ? AND stage = ?", input.NodeID, "frozen").Updates(map[string]any{"actor_id": input.UserID, "completion_claim": input.CompletionClaim, "evidence_text": input.EvidenceText, "started_at": input.StartedAt, "ended_at": input.EndedAt, "stage": input.Stage, "ai_review_json": input.ReviewJSON, "completion_review_ai_config_json": input.AIConfigJSON, "completion_review_rounds_json": input.RoundsJSON, "review_messages_json": input.MessagesJSON})
	return result.RowsAffected == 1, result.Error
}

// SaveClarificationReview stores a follow-up review for an active review state.
func (repository *Repository) SaveClarificationReview(ctx context.Context, input ClarificationSaveInput) (bool, error) {
	result := repository.orm.WithContext(ctx).Table("execution_contracts").Where("uuid = ? AND stage IN ?", input.NodeID, []string{"verified", "needs_supplement"}).Updates(map[string]any{"stage": input.Stage, "ai_review_json": input.ReviewJSON, "completion_review_ai_config_json": input.AIConfigJSON, "completion_review_rounds_json": input.RoundsJSON, "review_messages_json": input.MessagesJSON})
	return result.RowsAffected == 1, result.Error
}
