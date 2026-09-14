package mysql

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
)

type Project struct {
	ID                             string     `gorm:"column:id"`
	OwnerID                        uint64     `gorm:"column:owner_id"`
	Title                          string     `gorm:"column:title"`
	Description                    string     `gorm:"column:description"`
	ProjectType                    string     `gorm:"column:project_type"`
	ProjectRules                   *string    `gorm:"column:project_rules"`
	IsDefault                      bool       `gorm:"column:is_default"`
	Visibility                     string     `gorm:"column:visibility"`
	DefaultAIKeyID                 *string    `gorm:"column:default_ai_key_id"`
	ContributionCallID             *string    `gorm:"column:contribution_call_id"`
	ContributionOriginSnapshotJSON *string    `gorm:"column:contribution_origin_snapshot_json"`
	CurrentContractID              *string    `gorm:"column:current_contract_id"`
	ActiveContractRevisionID       *string    `gorm:"column:active_contract_revision_id"`
	CreatedAt                      time.Time  `gorm:"column:created_at"`
	ArchivedAt                     *time.Time `gorm:"column:archived_at"`
}

func (Project) TableName() string { return "projects" }

type ProjectContractRevision struct {
	ID                       string    `gorm:"column:id"`
	SmartContractID          string    `gorm:"column:smart_contract_id"`
	SmartContractVersion     string    `gorm:"column:smart_contract_version"`
	RuleHash                 string    `gorm:"column:rule_hash"`
	Reason                   string    `gorm:"column:reason"`
	ActivatedAt              time.Time `gorm:"column:activated_at"`
	SmartContractName        string    `gorm:"column:smart_contract_name"`
	SmartContractDescription string    `gorm:"column:smart_contract_description"`
	SmartContractBody        string    `gorm:"column:smart_contract_body"`
	SmartContractSource      string    `gorm:"column:smart_contract_source"`
	SmartContractCreatedAt   time.Time `gorm:"column:smart_contract_created_at"`
}

type ProjectRepository struct {
	db *gorm.DB
}

func NewProjectRepository(db *gorm.DB) ProjectRepository {
	return ProjectRepository{db: db}
}

func (repository ProjectRepository) ListIDsForOwner(ctx context.Context, userID uint64) ([]string, error) {
	var ids []string
	err := repository.db.WithContext(ctx).
		Model(&Project{}).
		Where("owner_id = ?", userID).
		Order("is_default DESC, created_at DESC").
		Pluck("id", &ids).Error
	return ids, err
}

func (repository ProjectRepository) FindForOwner(ctx context.Context, userID uint64, projectID string) (Project, error) {
	var project Project
	err := repository.db.WithContext(ctx).
		Where("id = ? AND owner_id = ?", projectID, userID).
		First(&project).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Project{}, ErrNotFound
	}
	return project, err
}

func (repository ProjectRepository) ListContractRevisions(ctx context.Context, projectID string) ([]ProjectContractRevision, error) {
	var revisions []ProjectContractRevision
	err := repository.db.WithContext(ctx).
		Table("project_contract_revisions AS r").
		Select(`r.id, r.smart_contract_id, r.smart_contract_version, r.rule_hash, r.reason, r.activated_at,
			COALESCE(r.smart_contract_name, c.name, '') AS smart_contract_name,
			COALESCE(r.smart_contract_description, c.description, '') AS smart_contract_description,
			COALESCE(r.smart_contract_body, c.body, '') AS smart_contract_body,
			COALESCE(c.source, 'custom') AS smart_contract_source,
			COALESCE(c.created_at, r.activated_at) AS smart_contract_created_at`).
		Joins("LEFT JOIN smart_contracts AS c ON c.id = r.smart_contract_id").
		Where("r.project_id = ?", projectID).
		Order("r.activated_at DESC").
		Scan(&revisions).Error
	return revisions, err
}
