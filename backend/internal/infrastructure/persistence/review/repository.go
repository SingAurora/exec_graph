// Package review contains typed persistence operations for AI execution reviews.
package review

import (
	"context"
	"errors"
	"time"

	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
	"gorm.io/gorm"
)

// Repository owns review-related database operations.
type Repository struct{ orm *gorm.DB }

// ErrNotFound indicates that a review target does not exist.
var ErrNotFound = applicationreview.ErrNotFound

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
func (repository *Repository) LoadNodeReviewContext(ctx context.Context, userID uint64, nodeID string) (applicationreview.NodeReviewContext, error) {
	var value NodeReviewContext
	result := repository.orm.WithContext(ctx).Table("execution_contracts AS n").Select(`p.id AS project_internal_id, n.id AS node_internal_id, p.uuid AS project_id, p.title AS project_title, p.description AS project_description, COALESCE(p.project_rules, '') AS project_rules, p.current_contract_id AS project_current_id, p.archived_at, n.branch_id, n.uuid AS node_id, n.title, n.original_intent, n.verifiable_goal, n.acceptance_criteria_json AS criteria_json, n.evidence_requirement, sc.uuid AS smart_contract_id, n.review_messages_json AS messages_json, n.stage, n.completion_claim, n.evidence_text, n.ai_review_json, n.completion_review_ai_config_json AS review_config_json, n.completion_review_rounds_json AS review_rounds_json, revision.smart_contract_name, revision.smart_contract_description, revision.smart_contract_body`).Joins("JOIN projects AS p ON p.id = n.project_id").Joins("JOIN project_contract_revisions AS revision ON revision.id = n.project_contract_revision_id").Joins("JOIN smart_contracts AS sc ON sc.id = n.smart_contract_id").Where("n.uuid = ? AND p.owner_id = ?", nodeID, userID).Scan(&value)
	if result.Error != nil {
		return applicationreview.NodeReviewContext{}, result.Error
	}
	if result.RowsAffected == 0 {
		return applicationreview.NodeReviewContext{}, applicationreview.ErrNotFound
	}
	isCurrent := false
	if value.BranchID != nil {
		var branchCurrentID *uint64
		if err := repository.loadBranchCurrent(ctx, *value.BranchID, value.ProjectInternalID, &branchCurrentID); err != nil {
			return applicationreview.NodeReviewContext{}, err
		}
		isCurrent = branchCurrentID != nil && *branchCurrentID == value.NodeInternalID
	} else {
		isCurrent = value.ProjectCurrentID != nil && *value.ProjectCurrentID == value.NodeInternalID
	}
	return applicationreview.NodeReviewContext{
		ProjectID: value.ProjectID, ProjectTitle: value.ProjectTitle, ProjectDescription: value.ProjectDescription,
		ProjectRules: value.ProjectRules, ArchivedAt: value.ArchivedAt, IsCurrent: isCurrent,
		NodeID: value.NodeID, Title: value.Title, OriginalIntent: value.OriginalIntent, Goal: value.Goal,
		CriteriaJSON: value.CriteriaJSON, EvidenceRequirement: value.EvidenceRequirement,
		SmartContractID: value.SmartContractID, MessagesJSON: value.MessagesJSON, Stage: value.Stage,
		Claim: value.Claim, Evidence: value.Evidence, ReviewJSON: value.ReviewJSON,
		ReviewConfigJSON: value.ReviewConfigJSON, ReviewRoundsJSON: value.ReviewRoundsJSON,
		SmartContractName: value.SmartContractName, SmartContractDescription: value.SmartContractDescription,
		SmartContractBody: value.SmartContractBody,
	}, nil
}

// ListClosureSourceUUIDs lists immediate closure predecessors without exposing database IDs.
func (repository *Repository) ListClosureSourceUUIDs(ctx context.Context, targetNodeUUID string) ([]string, error) {
	var values []string
	err := repository.orm.WithContext(ctx).Table("execution_edges AS edge").
		Joins("JOIN execution_contracts AS source ON source.id = edge.source_contract_id").
		Joins("JOIN execution_contracts AS target ON target.id = edge.target_contract_id").
		Where("target.uuid = ? AND edge.type = ?", targetNodeUUID, "closure").
		Pluck("source.uuid", &values).Error
	return values, err
}

func (repository *Repository) loadBranchCurrent(ctx context.Context, branchID, projectID uint64, target **uint64) error {
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
func (repository *Repository) LoadClosureSource(ctx context.Context, sourceNodeUUID, projectUUID string) (applicationreview.ClosureSource, error) {
	var value ClosureSource
	err := repository.orm.WithContext(ctx).Table("execution_contracts AS node").
		Select("node.id, node.uuid, node.title, node.verifiable_goal, node.acceptance_criteria_json, node.evidence_requirement").
		Joins("JOIN projects AS project ON project.id = node.project_id").
		Where("node.uuid = ? AND project.uuid = ?", sourceNodeUUID, projectUUID).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return applicationreview.ClosureSource{}, applicationreview.ErrNotFound
	}
	return applicationreview.ClosureSource{ID: value.UUID, Title: value.Title, Goal: value.Goal, Criteria: value.Criteria, Evidence: value.Evidence}, err
}

// SaveInitialReview stores the first submission review if the node is still frozen.
func (repository *Repository) SaveInitialReview(ctx context.Context, input applicationreview.InitialReviewSave) (bool, error) {
	result := repository.orm.WithContext(ctx).Table("execution_contracts").Where("uuid = ? AND stage = ?", input.NodeID, "frozen").Updates(map[string]any{"actor_id": input.UserID, "completion_claim": input.CompletionClaim, "evidence_text": input.EvidenceText, "started_at": input.StartedAt, "ended_at": input.EndedAt, "stage": input.Stage, "ai_review_json": input.ReviewJSON, "completion_review_ai_config_json": input.AIConfigJSON, "completion_review_rounds_json": input.RoundsJSON, "review_messages_json": input.MessagesJSON})
	return result.RowsAffected == 1, result.Error
}

// SaveClarificationReview stores a follow-up review for an active review state.
func (repository *Repository) SaveClarificationReview(ctx context.Context, input applicationreview.ClarificationReviewSave) (bool, error) {
	result := repository.orm.WithContext(ctx).Table("execution_contracts").Where("uuid = ? AND stage IN ?", input.NodeID, []string{"verified", "needs_supplement"}).Updates(map[string]any{"stage": input.Stage, "ai_review_json": input.ReviewJSON, "completion_review_ai_config_json": input.AIConfigJSON, "completion_review_rounds_json": input.RoundsJSON, "review_messages_json": input.MessagesJSON})
	return result.RowsAffected == 1, result.Error
}
