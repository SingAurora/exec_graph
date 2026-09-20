package project

import (
	"context"
	"errors"
	"time"

	contractpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/contract"
	"gorm.io/gorm"
)

var (
	ErrNotFound = errors.New("project not found")
	ErrInvalid  = errors.New("invalid project contract")
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

// CreateProjectInput describes the immutable facts needed to create a project.
type CreateProjectInput struct {
	UUID, RevisionUUID, Title, Description, ProjectType, ProjectRules, Visibility, SmartContractUUID, AIKeyUUID, ContributionCallUUID, OriginSnapshot string
	OwnerID                                                                                                                                           uint64
}

// SetContractInput describes a project contract revision change.
type SetContractInput struct {
	ProjectID, ContractID, RevisionUUID string
	OwnerID                             uint64
}

// ContributionOriginProjection is the handoff context for an open contribution call.
type ContributionOriginProjection struct{ CallID, ProjectID, ProjectTitle, CallTitle, Status, TargetTitle, Goal, CriteriaJSON, EvidenceRequirement string }

// ContributionSourceProjection is an existing contribution source.
type ContributionSourceProjection struct{ Title, ProjectTitle, MappingText, Status string }

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

// UUIDByInternalID resolves a public UUID for a supported project-owned table.
func (repository ProjectRepository) UUIDByInternalID(ctx context.Context, table string, id uint64) (string, error) {
	var value struct {
		UUID string `gorm:"column:uuid"`
	}
	if err := repository.db.WithContext(ctx).Table(table).Select("uuid").Where("id = ?", id).First(&value).Error; err != nil {
		return "", err
	}
	return value.UUID, nil
}

// FindContributionOrigin loads a call and its available non-withdrawn sources.
func (repository ProjectRepository) FindContributionOrigin(ctx context.Context, callID string) (ContributionOriginProjection, []ContributionSourceProjection, error) {
	var origin ContributionOriginProjection
	result := repository.db.WithContext(ctx).Table("collaboration_calls AS c").Select("c.uuid AS call_id, p.uuid AS project_id, p.title AS project_title, c.title AS call_title, c.status, n.title AS target_title, n.verifiable_goal AS goal, n.acceptance_criteria_json AS criteria_json, n.evidence_requirement").Joins("JOIN projects AS p ON p.id = c.project_id").Joins("JOIN execution_contracts AS n ON n.id = c.target_contract_id").Where("c.uuid = ?", callID).Scan(&origin)
	err := result.Error
	if err == nil && result.RowsAffected == 0 {
		return origin, nil, ErrNotFound
	}
	if err != nil {
		return origin, nil, err
	}
	var sources []ContributionSourceProjection
	err = repository.db.WithContext(ctx).Table("collaboration_submissions AS s").Select("r.title, p.title AS project_title, s.mapping_text, s.status").Joins("JOIN completion_records AS r ON r.id = s.source_record_id").Joins("JOIN projects AS p ON p.id = r.project_id").Joins("JOIN collaboration_calls AS c ON c.id = s.call_id").Where("c.uuid = ? AND s.status <> ?", callID, "withdrawn").Order("s.created_at ASC").Scan(&sources).Error
	return origin, sources, err
}

// CreateProject creates a project and its initial contract revision atomically.
func (repository ProjectRepository) CreateProject(ctx context.Context, input CreateProjectInput) error {
	return repository.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var contract contractpersistence.SmartContract
		if err := tx.Where("uuid = ? AND deleted_at IS NULL AND (source = ? OR created_by = ?)", input.SmartContractUUID, "official", input.OwnerID).First(&contract).Error; err != nil {
			return err
		}
		var key struct {
			ID uint64 `gorm:"column:id"`
		}
		if err := tx.Table("ai_api_keys").Select("id").Where("uuid = ? AND user_id = ?", input.AIKeyUUID, input.OwnerID).First(&key).Error; err != nil {
			return err
		}
		var callID *uint64
		if input.ContributionCallUUID != "" {
			var call struct {
				ID, OwnerID uint64
				Status      string
				Stage       string
			}
			if err := tx.Table("collaboration_calls AS c").Select("c.id, p.owner_id, c.status, n.stage").Joins("JOIN projects AS p ON p.id = c.project_id").Joins("JOIN execution_contracts AS n ON n.id = c.target_contract_id").Where("c.uuid = ?", input.ContributionCallUUID).First(&call).Error; err != nil {
				return err
			}
			if call.OwnerID == input.OwnerID || call.Status != "open" || call.Stage != "frozen" {
				return gorm.ErrInvalidData
			}
			callID = &call.ID
		}
		project := Project{UUID: input.UUID, OwnerID: input.OwnerID, Title: input.Title, Description: input.Description, ProjectType: input.ProjectType, ProjectRules: &input.ProjectRules, Visibility: input.Visibility, IsDefault: false, DefaultAIKeyID: &key.ID, ContributionOriginSnapshotJSON: nil}
		if input.OriginSnapshot != "" {
			project.ContributionOriginSnapshotJSON = &input.OriginSnapshot
		}
		project.ContributionCallID = callID
		if err := tx.Create(&project).Error; err != nil {
			return err
		}
		revision := ProjectContractRevision{UUID: input.RevisionUUID, ProjectID: project.ID, SmartContractID: contract.ID, SmartContractUUID: contract.UUID, SmartContractVersion: contract.Version, Reason: "项目创建时的基础审查规则", SmartContractName: contract.Name, SmartContractDescription: contract.Description, SmartContractBody: contract.Body}
		if err := tx.Create(&revision).Error; err != nil {
			return err
		}
		return tx.Model(&project).Update("active_contract_revision_id", revision.ID).Error
	})
}

// SetContract changes an autonomous project's active contract revision atomically.
func (repository ProjectRepository) SetContract(ctx context.Context, input SetContractInput) error {
	return repository.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var project Project
		if err := tx.Where("uuid = ? AND owner_id = ? AND archived_at IS NULL", input.ProjectID, input.OwnerID).First(&project).Error; err != nil {
			return err
		}
		if project.ProjectType != "autonomous" || project.ContributionCallID != nil {
			return ErrInvalid
		}
		var contract contractpersistence.SmartContract
		if err := tx.Where("uuid = ? AND deleted_at IS NULL AND (source = ? OR (source = ? AND created_by = ?))", input.ContractID, "official", "custom", input.OwnerID).First(&contract).Error; err != nil {
			return err
		}
		revision := ProjectContractRevision{UUID: input.RevisionUUID, ProjectID: project.ID, SmartContractID: contract.ID, SmartContractUUID: contract.UUID, SmartContractVersion: contract.Version, Reason: "项目设置更换智能合约", SmartContractName: contract.Name, SmartContractDescription: contract.Description, SmartContractBody: contract.Body}
		if err := tx.Create(&revision).Error; err != nil {
			return err
		}
		return tx.Model(&project).Update("active_contract_revision_id", revision.ID).Error
	})
}

// DeleteProject permanently removes a project and its execution data when no adopted contribution exists.
func (repository ProjectRepository) DeleteProject(ctx context.Context, userID uint64, projectID string) (bool, error) {
	returnValue := false
	err := repository.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var project Project
		if err := tx.Where("uuid = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
			return err
		}
		var adopted int64
		if err := tx.Table("collaboration_submissions AS s").Joins("JOIN completion_records AS r ON r.id = s.source_record_id").Where("r.project_id = ? AND s.status = ?", project.ID, "adopted").Count(&adopted).Error; err != nil {
			return err
		}
		if adopted > 0 {
			return ErrAdopted
		}
		var nodeIDs []uint64
		if err := tx.Table("execution_contracts").Where("project_id = ?", project.ID).Pluck("id", &nodeIDs).Error; err != nil {
			return err
		}
		if len(nodeIDs) > 0 {
			if err := tx.Exec("DELETE FROM execution_edges WHERE source_contract_id IN ? OR target_contract_id IN ?", nodeIDs, nodeIDs).Error; err != nil {
				return err
			}
		}
		if err := tx.Exec("DELETE m FROM node_conversation_messages m JOIN node_conversations c ON c.id = m.conversation_id WHERE c.project_id = ?", project.ID).Error; err != nil {
			return err
		}
		for _, table := range []string{"node_conversations", "completion_records", "execution_branches", "execution_contracts", "project_contract_revisions"} {
			if err := tx.Exec("DELETE FROM "+table+" WHERE project_id = ?", project.ID).Error; err != nil {
				return err
			}
		}
		if err := tx.Delete(&project).Error; err != nil {
			return err
		}
		returnValue = true
		return nil
	})
	return returnValue, err
}

var ErrAdopted = errors.New("project contains adopted content")
