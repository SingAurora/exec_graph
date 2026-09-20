// Package collaboration contains GORM persistence for public collaboration.
package collaboration

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	persistencemysql "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/mysql"
	"gorm.io/gorm"
)

var (
	ErrNotFound      = errors.New("collaboration record not found")
	ErrInvalidState  = errors.New("collaboration record is no longer actionable")
	ErrPartialUpdate = errors.New("collaboration submissions changed during adoption")
	ErrCorruptBatch  = errors.New("collaboration review batch is corrupt")
	ErrUnauthorized  = errors.New("collaboration operation is not authorized")
)

// These models contain database fields only. API/application DTOs stay in
// their own packages and are built from the projection types below.
type CollaborationCall struct {
	ID               uint64    `gorm:"column:id;primaryKey"`
	UUID             string    `gorm:"column:uuid"`
	ProjectID        uint64    `gorm:"column:project_id"`
	TargetContractID uint64    `gorm:"column:target_contract_id"`
	CreatedBy        uint64    `gorm:"column:created_by"`
	Title            string    `gorm:"column:title"`
	Status           string    `gorm:"column:status"`
	MaxSubmissions   int       `gorm:"column:max_submissions"`
	CreatedAt        time.Time `gorm:"column:created_at"`
}

func (CollaborationCall) TableName() string { return "collaboration_calls" }

type CollaborationSubmission struct {
	ID             uint64    `gorm:"column:id;primaryKey"`
	UUID           string    `gorm:"column:uuid"`
	CallID         uint64    `gorm:"column:call_id"`
	SourceRecordID uint64    `gorm:"column:source_record_id"`
	ContributorID  uint64    `gorm:"column:contributor_id"`
	MappingText    string    `gorm:"column:mapping_text"`
	Note           string    `gorm:"column:note"`
	Status         string    `gorm:"column:status"`
	CreatedAt      time.Time `gorm:"column:created_at"`
	UpdatedAt      time.Time `gorm:"column:updated_at"`
}

func (CollaborationSubmission) TableName() string { return "collaboration_submissions" }

type CollaborationReviewBatch struct {
	ID                uint64     `gorm:"column:id;primaryKey"`
	UUID              string     `gorm:"column:uuid"`
	CallID            uint64     `gorm:"column:call_id"`
	ProjectID         uint64     `gorm:"column:project_id"`
	TargetContractID  uint64     `gorm:"column:target_contract_id"`
	CreatedBy         uint64     `gorm:"column:created_by"`
	SubmissionIDsJSON string     `gorm:"column:submission_ids_json"`
	AIReviewJSON      string     `gorm:"column:ai_review_json"`
	Status            string     `gorm:"column:status"`
	CreatedAt         time.Time  `gorm:"column:created_at"`
	AdoptedAt         *time.Time `gorm:"column:adopted_at"`
}

func (CollaborationReviewBatch) TableName() string { return "collaboration_review_batches" }

// Projection types are persistence-owned read models. They keep joins and
// internal numeric IDs out of application services.
type CallView struct {
	InternalID      uint64    `gorm:"column:internal_id"`
	ID              string    `gorm:"column:id"`
	ProjectID       string    `gorm:"column:project_id"`
	ProjectTitle    string    `gorm:"column:project_title"`
	OwnerName       string    `gorm:"column:owner_name"`
	OwnerUserID     string    `gorm:"column:owner_user_id"`
	CreatedBy       uint64    `gorm:"column:created_by"`
	CreatedByUserID string    `gorm:"column:created_by_user_id"`
	Title           string    `gorm:"column:title"`
	Status          string    `gorm:"column:status"`
	MaxSubmissions  int       `gorm:"column:max_submissions"`
	CreatedAt       time.Time `gorm:"column:created_at"`
	TargetID        string    `gorm:"column:target_id"`
	TargetTitle     string    `gorm:"column:target_title"`
	VerifiableGoal  string    `gorm:"column:verifiable_goal"`
	CriteriaJSON    string    `gorm:"column:acceptance_criteria_json"`
	Evidence        string    `gorm:"column:evidence_requirement"`
	Stage           string    `gorm:"column:stage"`
	SubmissionCount int       `gorm:"column:submission_count"`
}

type ProjectView struct {
	ID            string    `gorm:"column:id"`
	Title         string    `gorm:"column:title"`
	Description   string    `gorm:"column:description"`
	OwnerName     string    `gorm:"column:owner_name"`
	OwnerUserID   string    `gorm:"column:owner_user_id"`
	NodeCount     int       `gorm:"column:node_count"`
	AcceptedCount int       `gorm:"column:accepted_count"`
	OpenCallCount int       `gorm:"column:open_call_count"`
	UpdatedAt     time.Time `gorm:"column:updated_at"`
}

type SubmissionView struct {
	ID                 string    `gorm:"column:id"`
	CallID             string    `gorm:"column:call_id"`
	SourceRecordID     string    `gorm:"column:source_record_id"`
	SourceTitle        string    `gorm:"column:source_title"`
	SourceSummary      string    `gorm:"column:source_summary"`
	SourceProjectTitle string    `gorm:"column:source_project_title"`
	ContributorID      uint64    `gorm:"column:contributor_id"`
	ContributorName    string    `gorm:"column:contributor_name"`
	ContributorUserID  string    `gorm:"column:contributor_user_id"`
	MappingText        string    `gorm:"column:mapping_text"`
	Note               string    `gorm:"column:note"`
	Status             string    `gorm:"column:status"`
	CreatedAt          time.Time `gorm:"column:created_at"`
}

type TargetContext struct {
	ProjectID         uint64
	TargetContractID  uint64
	TargetTitle       string
	TargetStage       string
	ProjectVisibility string
}

type ReviewContext struct {
	ProjectTitle       string `gorm:"column:project_title"`
	ProjectDescription string `gorm:"column:project_description"`
	ProjectRules       string `gorm:"column:project_rules"`
	OriginalIntent     string `gorm:"column:original_intent"`
	SmartContractID    string `gorm:"column:smart_contract_id"`
	SmartContractName  string `gorm:"column:smart_contract_name"`
	SmartContractDesc  string `gorm:"column:smart_contract_description"`
	SmartContractBody  string `gorm:"column:smart_contract_body"`
}

type ContributionSourceView struct {
	ID           string `gorm:"column:id"`
	Title        string `gorm:"column:title"`
	Summary      string `gorm:"column:summary"`
	ProjectTitle string `gorm:"column:project_title"`
}

type ContributionActivityView struct {
	Submission SubmissionView
	Call       CallView
}

type Repository struct{ db *gorm.DB }

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

func (repository *Repository) CreateCall(ctx context.Context, call *CollaborationCall) error {
	return repository.db.WithContext(ctx).Create(call).Error
}

func (repository *Repository) FindCallTarget(ctx context.Context, projectUUID, targetUUID string, ownerID uint64) (TargetContext, error) {
	var target TargetContext
	err := repository.db.WithContext(ctx).Table("execution_contracts AS n").
		Select("p.id AS project_id, n.id AS target_contract_id, n.title AS target_title, n.stage AS target_stage, p.visibility AS project_visibility").
		Joins("JOIN projects AS p ON p.id = n.project_id").
		Where("n.uuid = ? AND p.uuid = ? AND p.owner_id = ? AND p.archived_at IS NULL", targetUUID, projectUUID, ownerID).
		Scan(&target).Error
	if target.TargetContractID == 0 {
		return TargetContext{}, ErrNotFound
	}
	return target, err
}

func (repository *Repository) HasOpenCall(ctx context.Context, projectID, targetContractID uint64) (bool, error) {
	var count int64
	err := repository.db.WithContext(ctx).Model(&CollaborationCall{}).
		Where("project_id = ? AND target_contract_id = ? AND status = ?", projectID, targetContractID, "open").Count(&count).Error
	return count > 0, err
}

func (repository *Repository) ListPublicProjects(ctx context.Context) ([]ProjectView, error) {
	var projects []ProjectView
	err := repository.publicProjectQuery(ctx).
		Where("p.visibility = ? AND p.archived_at IS NULL", "public").
		Order("open_call_count DESC").
		Order("p.updated_at DESC").
		Scan(&projects).Error
	return projects, err
}

func (repository *Repository) FindPublicProject(ctx context.Context, projectUUID string) (ProjectView, error) {
	var projects []ProjectView
	if err := repository.publicProjectQuery(ctx).
		Where("p.uuid = ? AND p.visibility = ? AND p.archived_at IS NULL", projectUUID, "public").
		Scan(&projects).Error; err != nil {
		return ProjectView{}, err
	}
	if len(projects) == 0 {
		return ProjectView{}, ErrNotFound
	}
	return projects[0], nil
}

func (repository *Repository) publicProjectQuery(ctx context.Context) *gorm.DB {
	return repository.db.WithContext(ctx).Table("projects AS p").
		Select(`p.uuid AS id, p.title, p.description, u.username AS owner_name,
			u.user_id AS owner_user_id, p.updated_at,
			(SELECT COUNT(*) FROM execution_contracts AS n WHERE n.project_id = p.id) AS node_count,
			(SELECT COUNT(*) FROM completion_records AS r WHERE r.project_id = p.id AND r.record_kind = 'accepted') AS accepted_count,
			(SELECT COUNT(*) FROM collaboration_calls AS c WHERE c.project_id = p.id AND c.status = 'open') AS open_call_count`).
		Joins("JOIN users AS u ON u.id = p.owner_id")
}

func (repository *Repository) ListSubmissions(ctx context.Context, callUUID string, selected []string) ([]SubmissionView, error) {
	query := repository.submissionQuery(ctx).
		Joins("JOIN collaboration_calls AS c ON c.id = s.call_id").
		Where("c.uuid = ?", callUUID)
	if len(selected) > 0 {
		query = query.Where("s.uuid IN ? AND s.status = ?", selected, "submitted")
	}
	var items []SubmissionView
	err := query.Order("s.created_at DESC").Scan(&items).Error
	return items, err
}

func (repository *Repository) submissionQuery(ctx context.Context) *gorm.DB {
	return repository.db.WithContext(ctx).Table("collaboration_submissions AS s").
		Select("s.uuid AS id, c.uuid AS call_id, r.uuid AS source_record_id, r.title AS source_title, r.summary AS source_summary, source_project.title AS source_project_title, s.contributor_id, u.username AS contributor_name, u.user_id AS contributor_user_id, s.mapping_text, COALESCE(s.note, '') AS note, s.status, s.created_at").
		Joins("JOIN completion_records AS r ON r.id = s.source_record_id").
		Joins("JOIN projects AS source_project ON source_project.id = r.project_id").
		Joins("JOIN users AS u ON u.id = s.contributor_id")
}

func (repository *Repository) FindSourceOwner(ctx context.Context, recordUUID string) (uint64, error) {
	var owner uint64
	err := repository.db.WithContext(ctx).Table("completion_records AS r").Select("n.actor_id").
		Joins("JOIN projects AS p ON p.id = r.project_id").
		Joins("JOIN execution_contracts AS n ON n.id = r.closing_contract_id").
		Where("r.uuid = ? AND r.record_kind = ? AND p.visibility = ?", recordUUID, "accepted", "public").Scan(&owner).Error
	if owner == 0 {
		return 0, ErrNotFound
	}
	return owner, err
}

func (repository *Repository) findID(ctx context.Context, model any, uuid string) (uint64, error) {
	var id uint64
	if err := repository.db.WithContext(ctx).Model(model).Where("uuid = ?", uuid).Pluck("id", &id).Error; err != nil {
		return 0, err
	}
	if id == 0 {
		return 0, ErrNotFound
	}
	return id, nil
}

func (repository *Repository) FindCallID(ctx context.Context, uuid string) (uint64, error) {
	return repository.findID(ctx, &CollaborationCall{}, uuid)
}

func (repository *Repository) FindProjectID(ctx context.Context, uuid string) (uint64, error) {
	return repository.findID(ctx, &Project{}, uuid)
}

func (repository *Repository) FindTargetID(ctx context.Context, uuid string) (uint64, error) {
	return repository.findID(ctx, &ExecutionContract{}, uuid)
}

func (repository *Repository) FindRecordID(ctx context.Context, uuid string) (uint64, error) {
	return repository.findID(ctx, &CompletionRecord{}, uuid)
}

func (repository *Repository) CreateSubmission(ctx context.Context, submission *CollaborationSubmission) error {
	return repository.db.WithContext(ctx).Create(submission).Error
}

func (repository *Repository) FindReviewContext(ctx context.Context, projectUUID, targetUUID string) (ReviewContext, error) {
	var review ReviewContext
	err := repository.db.WithContext(ctx).Table("projects AS p").
		Select("p.title AS project_title, p.description AS project_description, COALESCE(p.project_rules, '') AS project_rules, n.original_intent, sc.uuid AS smart_contract_id, COALESCE(sc.name, '') AS smart_contract_name, COALESCE(sc.description, '') AS smart_contract_description, COALESCE(sc.body, '') AS smart_contract_body").
		Joins("JOIN execution_contracts AS n ON n.project_id = p.id AND n.uuid = ?", targetUUID).
		Joins("LEFT JOIN smart_contracts AS sc ON sc.id = n.smart_contract_id").
		Where("p.uuid = ?", projectUUID).Scan(&review).Error
	if review.ProjectTitle == "" {
		return ReviewContext{}, ErrNotFound
	}
	return review, err
}

func (repository *Repository) CreateReviewBatch(ctx context.Context, batch *CollaborationReviewBatch, submissionUUIDs []string) error {
	var ids []uint64
	if err := repository.db.WithContext(ctx).Model(&CollaborationSubmission{}).
		Where("uuid IN ? AND call_id = ? AND status = ?", submissionUUIDs, batch.CallID, "submitted").
		Pluck("id", &ids).Error; err != nil {
		return err
	}
	if len(ids) != len(submissionUUIDs) {
		return ErrNotFound
	}
	encoded, err := json.Marshal(ids)
	if err != nil {
		return err
	}
	batch.SubmissionIDsJSON = string(encoded)
	return repository.db.WithContext(ctx).Create(batch).Error
}

func (repository *Repository) AdoptReview(ctx context.Context, batchUUID string, userID uint64) error {
	return repository.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var batch CollaborationReviewBatch
		if err := tx.Clauses(persistencemysql.ForUpdate).Where("uuid = ?", batchUUID).First(&batch).Error; errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		} else if err != nil {
			return err
		}
		if batch.Status != "reviewed_pass" {
			return ErrInvalidState
		}
		var project Project
		if err := tx.Clauses(persistencemysql.ForUpdate).First(&project, batch.ProjectID).Error; err != nil {
			return err
		}
		if project.OwnerID != userID {
			return ErrUnauthorized
		}
		var call CollaborationCall
		if err := tx.Clauses(persistencemysql.ForUpdate).First(&call, batch.CallID).Error; err != nil {
			return err
		}
		if call.Status != "open" {
			return ErrInvalidState
		}
		var target ExecutionContract
		if err := tx.Clauses(persistencemysql.ForUpdate).First(&target, batch.TargetContractID).Error; err != nil {
			return err
		}
		if target.Stage != "frozen" {
			return ErrInvalidState
		}
		var ids []uint64
		if err := json.Unmarshal([]byte(batch.SubmissionIDsJSON), &ids); err != nil || len(ids) == 0 {
			return ErrCorruptBatch
		}
		result := tx.Model(&CollaborationSubmission{}).
			Where("call_id = ? AND status = ? AND id IN ?", call.ID, "submitted", ids).
			Updates(map[string]any{"status": "adopted"})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != int64(len(ids)) {
			return ErrPartialUpdate
		}
		var publicSubmissionIDs []string
		if err := tx.Model(&CollaborationSubmission{}).Where("id IN ?", ids).Order("id").Pluck("uuid", &publicSubmissionIDs).Error; err != nil {
			return err
		}
		claim := "项目维护者确认采纳 " + strconv.Itoa(len(ids)) + " 份外部已锁定成果，作为当前节点的组合证据。"
		evidence := "已采纳协作来源：" + strings.Join(publicSubmissionIDs, "、")
		if err := tx.Model(&ExecutionContract{}).Where("id = ? AND stage = ?", target.ID, "frozen").
			Updates(map[string]any{"stage": "verified", "completion_claim": claim, "evidence_text": evidence, "ai_review_json": batch.AIReviewJSON}).Error; err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Model(&CollaborationReviewBatch{}).Where("id = ?", batch.ID).
			Updates(map[string]any{"status": "adopted", "adopted_at": now}).Error; err != nil {
			return err
		}
		return tx.Model(&CollaborationCall{}).Where("id = ?", call.ID).Update("status", "adopted").Error
	})
}

func (repository *Repository) ListContributionSources(ctx context.Context, userID uint64) ([]ContributionSourceView, error) {
	var sources []ContributionSourceView
	err := repository.db.WithContext(ctx).Table("completion_records AS r").
		Select("r.uuid AS id, r.title, r.summary, p.title AS project_title").
		Joins("JOIN projects AS p ON p.id = r.project_id").
		Joins("JOIN execution_contracts AS n ON n.id = r.closing_contract_id").
		Where("r.record_kind = ? AND p.visibility = ? AND n.actor_id = ?", "accepted", "public", userID).
		Order("r.created_at DESC").Scan(&sources).Error
	return sources, err
}

func (repository *Repository) ListContributionActivities(ctx context.Context, userID uint64) ([]ContributionActivityView, error) {
	var submissions []SubmissionView
	err := repository.submissionQuery(ctx).
		Joins("JOIN collaboration_calls AS c ON c.id = s.call_id").
		Where("s.contributor_id = ? AND s.status <> ?", userID, "withdrawn").
		Order("s.updated_at DESC").Scan(&submissions).Error
	if err != nil {
		return nil, err
	}
	callUUIDs := make([]string, 0, len(submissions))
	for _, submission := range submissions {
		callUUIDs = append(callUUIDs, submission.CallID)
	}
	calls, err := repository.findCalls(ctx, callUUIDs)
	if err != nil {
		return nil, err
	}
	activities := make([]ContributionActivityView, 0, len(submissions))
	for _, submission := range submissions {
		call, exists := calls[submission.CallID]
		if !exists {
			return nil, ErrNotFound
		}
		activities = append(activities, ContributionActivityView{Submission: submission, Call: call})
	}
	return activities, nil
}

// Minimal related models used by GORM for typed counts and updates.
type Project struct {
	ID      uint64 `gorm:"column:id;primaryKey"`
	UUID    string `gorm:"column:uuid"`
	OwnerID uint64 `gorm:"column:owner_id"`
}

func (Project) TableName() string { return "projects" }

type ExecutionContract struct {
	ID              uint64 `gorm:"column:id;primaryKey"`
	Stage           string `gorm:"column:stage"`
	CompletionClaim string `gorm:"column:completion_claim"`
	EvidenceText    string `gorm:"column:evidence_text"`
	AIReviewJSON    string `gorm:"column:ai_review_json"`
}

func (ExecutionContract) TableName() string { return "execution_contracts" }

type CompletionRecord struct {
	ID uint64 `gorm:"column:id;primaryKey"`
}

func (CompletionRecord) TableName() string { return "completion_records" }
