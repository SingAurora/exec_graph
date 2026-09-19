package mysql

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
)

type Project struct {
	ID                             uint64     `gorm:"column:id;primaryKey"`
	UUID                           string     `gorm:"column:uuid"`
	OwnerID                        uint64     `gorm:"column:owner_id"`
	Title                          string     `gorm:"column:title"`
	Description                    string     `gorm:"column:description"`
	ProjectType                    string     `gorm:"column:project_type"`
	ProjectRules                   *string    `gorm:"column:project_rules"`
	IsDefault                      bool       `gorm:"column:is_default"`
	Visibility                     string     `gorm:"column:visibility"`
	DefaultAIKeyID                 *uint64    `gorm:"column:default_ai_key_id"`
	ContributionCallID             *uint64    `gorm:"column:contribution_call_id"`
	ContributionOriginSnapshotJSON *string    `gorm:"column:contribution_origin_snapshot_json"`
	CurrentContractID              *uint64    `gorm:"column:current_contract_id"`
	ActiveContractRevisionID       *uint64    `gorm:"column:active_contract_revision_id"`
	CreatedAt                      time.Time  `gorm:"column:created_at"`
	ArchivedAt                     *time.Time `gorm:"column:archived_at"`
}

func (Project) TableName() string { return "projects" }

type ProjectContractRevision struct {
	ID                       uint64    `gorm:"column:id;primaryKey"`
	UUID                     string    `gorm:"column:uuid"`
	ProjectID                uint64    `gorm:"column:project_id"`
	SmartContractID          uint64    `gorm:"column:smart_contract_id"`
	SmartContractUUID        string    `gorm:"column:smart_contract_uuid"`
	SmartContractVersion     string    `gorm:"column:smart_contract_version"`
	Reason                   string    `gorm:"column:reason"`
	ActivatedAt              time.Time `gorm:"column:activated_at"`
	SmartContractName        string    `gorm:"column:smart_contract_name"`
	SmartContractDescription string    `gorm:"column:smart_contract_description"`
	SmartContractBody        string    `gorm:"column:smart_contract_body"`
	SmartContractSource      string    `gorm:"column:smart_contract_source"`
	SmartContractCreatedAt   time.Time `gorm:"column:smart_contract_created_at"`
}

func (ProjectContractRevision) TableName() string { return "project_contract_revisions" }

type InitialProjectSpec struct {
	ProjectID            string
	RevisionID           string
	OwnerID              uint64
	SmartContractID      string
	SmartContractVersion string
}

type ProjectRepository struct {
	db *gorm.DB
}

func NewProjectRepository(db *gorm.DB) ProjectRepository {
	return ProjectRepository{db: db}
}

func (repository ProjectRepository) EnsureInitialProject(ctx context.Context, spec InitialProjectSpec) error {
	var count int64
	if err := repository.db.WithContext(ctx).Model(&Project{}).
		Where("owner_id = ?", spec.OwnerID).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	projectRules := "每次只推进一个明确行动；所有完成结果必须有可核验的证据。"
	project := Project{UUID: spec.ProjectID, OwnerID: spec.OwnerID, Title: "我的执行", Description: "用于开始和整理你的行动。", ProjectType: "guided", ProjectRules: &projectRules, IsDefault: false, Visibility: "private"}
	if err := repository.db.WithContext(ctx).Create(&project).Error; err != nil {
		return err
	}
	var contract SmartContract
	if err := repository.db.WithContext(ctx).First(&contract, "uuid = ?", spec.SmartContractID).Error; err != nil {
		return err
	}
	revision := ProjectContractRevision{UUID: spec.RevisionID, ProjectID: project.ID, SmartContractID: contract.ID, SmartContractVersion: spec.SmartContractVersion, Reason: "项目创建时的基础审查规则"}
	if err := repository.db.WithContext(ctx).Create(&revision).Error; err != nil {
		return err
	}
	return repository.db.WithContext(ctx).Model(&Project{}).Where("id = ?", project.ID).Update("active_contract_revision_id", revision.ID).Error
}

func (repository ProjectRepository) ListIDsForOwner(ctx context.Context, userID uint64) ([]string, error) {
	var ids []string
	err := repository.db.WithContext(ctx).
		Model(&Project{}).
		Where("owner_id = ?", userID).
		Order("created_at DESC").
		Pluck("uuid", &ids).Error
	return ids, err
}

func (repository ProjectRepository) FindForOwner(ctx context.Context, userID uint64, projectID string) (Project, error) {
	var project Project
	err := repository.db.WithContext(ctx).
		Where("uuid = ? AND owner_id = ?", projectID, userID).
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
		Select(`r.uuid, r.smart_contract_id, c.uuid AS smart_contract_uuid, r.smart_contract_version, r.reason, r.activated_at,
			COALESCE(r.smart_contract_name, c.name, '') AS smart_contract_name,
			COALESCE(r.smart_contract_description, c.description, '') AS smart_contract_description,
			COALESCE(r.smart_contract_body, c.body, '') AS smart_contract_body,
			COALESCE(c.source, 'custom') AS smart_contract_source,
			COALESCE(c.created_at, r.activated_at) AS smart_contract_created_at`).
		Joins("JOIN projects AS p ON p.id = r.project_id").
		Joins("LEFT JOIN smart_contracts AS c ON c.id = r.smart_contract_id").
		Where("p.uuid = ?", projectID).
		Order("r.activated_at DESC").
		Scan(&revisions).Error
	return revisions, err
}
