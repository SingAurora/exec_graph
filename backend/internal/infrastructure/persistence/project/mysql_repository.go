package project

import (
	"context"
	"errors"
	"time"

	contractpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/contract"
	"gorm.io/gorm"
)

var ErrNotFound = errors.New("project not found")

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
	var contract contractpersistence.SmartContract
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

// HasAdoptedContributions reports whether a project's published work has been
// adopted by another collaboration. Such a project cannot become private.
func (repository ProjectRepository) HasAdoptedContributions(ctx context.Context, projectID string) (bool, error) {
	var count int64
	err := repository.db.WithContext(ctx).
		Table("collaboration_submissions AS s").
		Joins("JOIN completion_records AS r ON r.id = s.source_record_id").
		Joins("JOIN projects AS p ON p.id = r.project_id").
		Where("p.uuid = ? AND s.status = ?", projectID, "adopted").
		Count(&count).Error
	return count > 0, err
}

// UpdateActive updates editable project metadata. Archived projects remain
// immutable until explicitly restored.
func (repository ProjectRepository) UpdateActive(ctx context.Context, userID uint64, projectID, title, description, visibility string) (bool, error) {
	result := repository.db.WithContext(ctx).
		Model(&Project{}).
		Where("uuid = ? AND owner_id = ? AND archived_at IS NULL", projectID, userID).
		Updates(map[string]any{"title": title, "description": description, "visibility": visibility})
	return result.RowsAffected > 0, result.Error
}

func (repository ProjectRepository) Archive(ctx context.Context, userID uint64, projectID string) (bool, error) {
	result := repository.db.WithContext(ctx).
		Model(&Project{}).
		Where("uuid = ? AND owner_id = ? AND archived_at IS NULL", projectID, userID).
		Update("archived_at", time.Now())
	return result.RowsAffected > 0, result.Error
}

func (repository ProjectRepository) Unarchive(ctx context.Context, userID uint64, projectID string) (bool, error) {
	result := repository.db.WithContext(ctx).
		Model(&Project{}).
		Where("uuid = ? AND owner_id = ? AND archived_at IS NOT NULL", projectID, userID).
		Update("archived_at", nil)
	return result.RowsAffected > 0, result.Error
}

// SetAIKey updates a project only when the selected key belongs to its owner.
func (repository ProjectRepository) SetAIKey(ctx context.Context, userID uint64, projectID, keyID string) (bool, error) {
	result := repository.db.WithContext(ctx).
		Table("projects AS p").
		Joins("JOIN ai_api_keys AS k ON k.uuid = ? AND k.user_id = p.owner_id", keyID).
		Where("p.uuid = ? AND p.owner_id = ? AND p.archived_at IS NULL", projectID, userID).
		Update("p.default_ai_key_id", gorm.Expr("k.id"))
	return result.RowsAffected > 0, result.Error
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
