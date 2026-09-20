// Package execution contains GORM persistence for execution nodes and their state.
package execution

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
	"gorm.io/gorm"
)

// NodeProjection is the complete public execution-node read projection.
type NodeProjection struct {
	UUID                 string     `gorm:"column:uuid"`
	BranchUUID           *string    `gorm:"column:branch_uuid"`
	RevisionUUID         string     `gorm:"column:revision_uuid"`
	ParentUUID           *string    `gorm:"column:parent_uuid"`
	SourceIDs            *string    `gorm:"column:source_ids"`
	SupplementUUID       *string    `gorm:"column:supplement_uuid"`
	RetryUUID            *string    `gorm:"column:retry_uuid"`
	ActorUserID          *string    `gorm:"column:actor_user_id"`
	Title                string     `gorm:"column:title"`
	Stage                string     `gorm:"column:stage"`
	OriginalIntent       string     `gorm:"column:original_intent"`
	SmartContractUUID    string     `gorm:"column:smart_contract_uuid"`
	SmartContractVersion string     `gorm:"column:smart_contract_version"`
	Goal                 string     `gorm:"column:verifiable_goal"`
	Criteria             string     `gorm:"column:acceptance_criteria_json"`
	EvidenceRequirement  string     `gorm:"column:evidence_requirement"`
	Claim                *string    `gorm:"column:completion_claim"`
	Evidence             *string    `gorm:"column:evidence_text"`
	StartedAt            *time.Time `gorm:"column:started_at"`
	EndedAt              *time.Time `gorm:"column:ended_at"`
	RecordUUID           *string    `gorm:"column:record_uuid"`
	DraftReview          *string    `gorm:"column:draft_review_json"`
	DraftAI              *string    `gorm:"column:draft_ai_json"`
	ReviewMessages       *string    `gorm:"column:review_messages_json"`
	AIReview             *string    `gorm:"column:ai_review_json"`
	CompletionAI         *string    `gorm:"column:completion_ai_json"`
	ReviewRounds         *string    `gorm:"column:review_rounds_json"`
	PlanningUUID         *string    `gorm:"column:planning_uuid"`
	CompletionUUID       *string    `gorm:"column:completion_uuid"`
	Verdict              *string    `gorm:"column:user_verdict_json"`
	NextTitle            *string    `gorm:"column:next_contract_title"`
	CreatedAt            time.Time  `gorm:"column:created_at"`
	UpdatedAt            time.Time  `gorm:"column:updated_at"`
}

// CreateNode creates the frozen node and its graph relations in one transaction.
func (repository *Repository) CreateNode(ctx context.Context, input CreateNodeParams) error {
	return repository.orm.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var project struct {
			ID         uint64 `gorm:"column:id"`
			RevisionID uint64 `gorm:"column:revision_id"`
			Visibility string
			CurrentID  *uint64 `gorm:"column:current_contract_id"`
			ArchivedAt *time.Time
		}
		if err := tx.Table("projects").Select("id, visibility, active_contract_revision_id AS revision_id, current_contract_id, archived_at").Where("uuid = ? AND owner_id = ?", input.ProjectID, input.OwnerID).First(&project).Error; err != nil {
			return err
		}
		if project.ArchivedAt != nil {
			return fmt.Errorf("项目已归档，不能创建推进节点")
		}
		var key struct {
			UUID     string
			Label    string
			Provider string
			Model    string
			BaseURL  string
		}
		if err := tx.Table("projects AS p").Select("k.uuid, k.label, k.provider, k.model, k.base_url").Joins("JOIN ai_api_keys AS k ON k.id = p.default_ai_key_id").Where("p.uuid = ? AND p.owner_id = ?", input.ProjectID, input.OwnerID).First(&key).Error; err != nil {
			return fmt.Errorf("请先为项目选择审查 AI")
		}
		if input.DraftReviewKeyID != "" && input.DraftReviewKeyID != key.UUID {
			return fmt.Errorf("项目审查 AI 已变更，请重新审核节点草案")
		}
		var revision struct {
			ID         uint64
			ContractID uint64 `gorm:"column:contract_id"`
			Version    string `gorm:"column:smart_contract_version"`
		}
		if err := tx.Table("project_contract_revisions").Select("id, smart_contract_id AS contract_id, smart_contract_version").Where("id = ? AND project_id = ?", project.RevisionID, project.ID).First(&revision).Error; err != nil {
			return err
		}
		sourceIDs := append([]string{}, input.SourceIDs...)
		if len(sourceIDs) == 0 && input.ParentID != "" {
			sourceIDs = []string{input.ParentID}
		}
		var parentInternal any
		sourceInternal := make([]uint64, 0, len(sourceIDs))
		var sourceBranch *uint64
		for _, sourceID := range sourceIDs {
			var source struct {
				ID           uint64
				Stage        string
				CompletionID *uint64 `gorm:"column:completion_record_id"`
				BranchID     *uint64 `gorm:"column:branch_id"`
			}
			if err := tx.Table("execution_contracts").Where("uuid = ? AND project_id = ?", sourceID, project.ID).First(&source).Error; err != nil {
				return fmt.Errorf("节点来源不存在")
			}
			allowed := source.Stage == "completed" && source.CompletionID != nil
			if input.Supplement && source.Stage == "needs_supplement" {
				allowed = true
			}
			if input.Closure && source.Stage == "frozen" {
				allowed = true
			}
			if !allowed {
				return fmt.Errorf("节点只能从已锁定成果或补足节点继续")
			}
			sourceInternal = append(sourceInternal, source.ID)
			sourceBranch = source.BranchID
		}
		if len(sourceInternal) == 1 {
			parentInternal = sourceInternal[0]
		}
		var supplementInternal, retryInternal any
		if input.SupplementID != "" {
			var id uint64
			if err := tx.Table("execution_contracts").Select("id").Where("uuid = ? AND project_id = ?", input.SupplementID, project.ID).First(&id).Error; err != nil {
				return fmt.Errorf("补足节点不存在")
			}
			supplementInternal = id
		}
		if input.RetryID != "" {
			var id uint64
			if err := tx.Table("execution_contracts").Select("id").Where("uuid = ? AND project_id = ?", input.RetryID, project.ID).First(&id).Error; err != nil {
				return fmt.Errorf("重试节点不存在")
			}
			retryInternal = id
		}
		branchID := input.BranchID
		var branchInternal any
		createBranch := input.CreateBranch || (len(sourceInternal) == 0 && input.Visibility == "public")
		if branchID == "" && sourceBranch != nil {
			branchInternal = *sourceBranch
			_ = tx.Table("execution_branches").Select("uuid").Where("id = ?", *sourceBranch).Scan(&branchID)
		}
		if branchID != "" && branchInternal == nil {
			var branch struct {
				ID     uint64
				HeadID *uint64 `gorm:"column:head_contract_id"`
			}
			if err := tx.Table("execution_branches").Select("id, head_contract_id").Where("uuid = ? AND project_id = ?", branchID, project.ID).First(&branch).Error; err != nil {
				return fmt.Errorf("节点路径不存在")
			}
			if parentInternal == nil || branch.HeadID == nil || *branch.HeadID != parentInternal.(uint64) {
				return fmt.Errorf("这条节点路径已经不是可继续的末端")
			}
			branchInternal = branch.ID
		}
		if createBranch {
			var err error
			branchID, err = sharedid.UUID()
			if err != nil {
				return err
			}
			if err := tx.Table("execution_branches").Create(map[string]any{"uuid": branchID, "project_id": project.ID, "title": input.Title, "created_by": input.OwnerID}).Error; err != nil {
				return err
			}
			var id uint64
			if err := tx.Table("execution_branches").Select("id").Where("uuid = ?", branchID).First(&id).Error; err != nil {
				return err
			}
			branchInternal = id
		}
		internalSourceJSON, _ := json.Marshal(sourceInternal)
		if err := tx.Table("execution_contracts").Create(map[string]any{"uuid": input.NodeID, "project_id": project.ID, "branch_id": branchInternal, "project_contract_revision_id": revision.ID, "parent_contract_id": parentInternal, "source_contract_ids_json": internalSourceJSON, "supplement_of_contract_id": supplementInternal, "retry_of_contract_id": retryInternal, "actor_id": input.OwnerID, "title": input.Title, "stage": "frozen", "original_intent": input.Draft, "smart_contract_id": revision.ContractID, "smart_contract_version": revision.Version, "verifiable_goal": input.Goal, "acceptance_criteria_json": input.CriteriaJSON, "evidence_requirement": input.EvidenceRequirement, "draft_review_json": input.DraftReviewJSON, "draft_review_ai_config_json": input.DraftAIConfigJSON, "review_messages_json": input.MessagesJSON}).Error; err != nil {
			return err
		}
		var nodeID uint64
		if err := tx.Table("execution_contracts").Select("id").Where("uuid = ?", input.NodeID).First(&nodeID).Error; err != nil {
			return err
		}
		for _, sourceID := range sourceInternal {
			edgeID, _ := sharedid.UUID()
			edgeType := input.EdgeType
			if edgeType == "" {
				edgeType = "lineage"
			}
			if err := tx.Table("execution_edges").Create(map[string]any{"uuid": edgeID, "source_contract_id": sourceID, "target_contract_id": nodeID, "type": edgeType}).Error; err != nil {
				return err
			}
		}
		if branchInternal != nil {
			if err := tx.Table("execution_branches").Where("id = ?", branchInternal).Updates(map[string]any{"head_contract_id": nodeID, "current_contract_id": nodeID}).Error; err != nil {
				return err
			}
		} else if err := tx.Table("projects").Where("id = ?", project.ID).Update("current_contract_id", nodeID).Error; err != nil {
			return err
		}
		if input.PlanningConversationID != "" {
			if err := tx.Table("node_conversations").Where("uuid = ? AND project_id = ? AND owner_id = ?", input.PlanningConversationID, project.ID, input.OwnerID).Updates(map[string]any{"node_id": nodeID, "status": "frozen"}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// EdgeProjection is a public execution edge projection.
type EdgeProjection struct {
	UUID, SourceUUID, TargetUUID, Type string
	CreatedAt                          time.Time
}

// BranchProjection is a public branch projection.
type BranchProjection struct {
	UUID, ProjectUUID, Title                    string
	RootUUID, ForkedUUID, HeadUUID, CurrentUUID *string
	CreatedByUserID                             string
	CreatedAt                                   time.Time
}

// CompletionProjection is a public completion-record projection.
type CompletionProjection struct {
	UUID, ProjectUUID, ClosingUUID                                                                                        string
	CoveredIDs, Title, Summary, SmartContractUUID, SmartContractVersion, ReviewID, ReviewVerdict, RecordKind, UserVerdict string
	CreatedAt                                                                                                             time.Time
}

// LockNodeParams contains the facts needed to atomically lock an AI-reviewed node.
type LockNodeParams struct {
	UserID                                                                                                                                           uint64
	ProjectID, NodeID, RecordID, ReviewID, ReviewVerdict, Title, Summary, SmartContractVersion, RecordKind, TerminalStage, VerdictJSON, MessagesJSON string
	CoveredIDsJSON                                                                                                                                   []byte
}

// CreateNodeParams contains the already validated node contract and relation data.
type CreateNodeParams struct {
	OwnerID                                                                                                                                                                                                                uint64
	ProjectID, NodeID, Title, Draft, Goal, CriteriaJSON, EvidenceRequirement, DraftReviewJSON, DraftAIConfigJSON, MessagesJSON, SourceIDsJSON, ParentID, SupplementID, RetryID, PlanningConversationID, BranchID, EdgeType string
	SmartContractID, SmartContractVersion, ProjectContractRevisionID, DraftReviewKeyID                                                                                                                                     string
	SourceIDs                                                                                                                                                                                                              []string
	Visibility                                                                                                                                                                                                             string
	Fork, Closure, Supplement, CreateBranch                                                                                                                                                                                bool
}

// LockNode performs the completion-record and execution-state transaction.
func (repository *Repository) LockNode(ctx context.Context, input LockNodeParams) error {
	return repository.orm.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var project struct {
			ID         uint64
			ArchivedAt *time.Time `gorm:"column:archived_at"`
			CurrentID  *uint64    `gorm:"column:current_contract_id"`
		}
		if err := tx.Table("projects").Select("id, archived_at, current_contract_id").Where("uuid = ? AND owner_id = ?", input.ProjectID, input.UserID).First(&project).Error; err != nil {
			return err
		}
		if project.ArchivedAt != nil {
			return fmt.Errorf("项目已归档，不能锁定节点")
		}
		var node struct {
			ID                                                           uint64
			Stage, Title, SmartContractVersion, ReviewJSON, MessagesJSON string
			BranchID                                                     *uint64 `gorm:"column:branch_id"`
			SmartContractID                                              uint64  `gorm:"column:smart_contract_id"`
		}
		if err := tx.Table("execution_contracts AS n").Select("n.id, n.stage, n.title, n.branch_id, n.smart_contract_id, n.smart_contract_version, n.ai_review_json AS review_json, n.review_messages_json AS messages_json").Where("n.uuid = ? AND n.project_id = ?", input.NodeID, project.ID).First(&node).Error; err != nil {
			return fmt.Errorf("节点不存在")
		}
		if node.Stage != "verified" && node.Stage != "needs_supplement" {
			return fmt.Errorf("节点尚未获得 AI 审查结果")
		}
		if node.BranchID == nil && (project.CurrentID == nil || *project.CurrentID != node.ID) {
			return fmt.Errorf("该节点不是项目当前待确认节点")
		}
		if node.BranchID != nil {
			var branch struct {
				CurrentID *uint64 `gorm:"column:current_contract_id"`
			}
			if err := tx.Table("execution_branches").Select("current_contract_id").Where("id = ? AND project_id = ?", *node.BranchID, project.ID).First(&branch).Error; err != nil || branch.CurrentID == nil || *branch.CurrentID != node.ID {
				return fmt.Errorf("该节点不是路径当前待确认节点")
			}
		}
		coveredJSON := input.CoveredIDsJSON
		if len(coveredJSON) == 0 {
			coveredJSON, _ = json.Marshal([]uint64{node.ID})
		}
		var record struct {
			ID uint64 `gorm:"column:id"`
		}
		if err := tx.Table("completion_records").Create(map[string]any{"uuid": input.RecordID, "project_id": project.ID, "closing_contract_id": node.ID, "covered_contract_ids_json": coveredJSON, "title": input.Title, "summary": input.Summary, "smart_contract_id": node.SmartContractID, "smart_contract_version": input.SmartContractVersion, "review_id": input.ReviewID, "ai_review_verdict": input.ReviewVerdict, "record_kind": input.RecordKind, "user_verdict_json": input.VerdictJSON}).Error; err != nil {
			return err
		}
		if err := tx.Table("completion_records").Select("id").Where("uuid = ?", input.RecordID).First(&record).Error; err != nil {
			return err
		}
		if err := tx.Model(&struct{}{}).Table("execution_contracts").Where("id = ? AND project_id = ?", node.ID, project.ID).Updates(map[string]any{"stage": input.TerminalStage, "completion_record_id": record.ID, "user_verdict_json": input.VerdictJSON, "review_messages_json": input.MessagesJSON}).Error; err != nil {
			return err
		}
		if err := tx.Table("node_conversations").Where("project_id = ? AND node_id = ? AND owner_id = ? AND phase = ? AND status = ?", project.ID, node.ID, input.UserID, "completion", "active").Update("status", "closed").Error; err != nil {
			return err
		}
		if node.BranchID != nil {
			return tx.Table("execution_branches").Where("id = ?", *node.BranchID).Updates(map[string]any{"head_contract_id": node.ID, "current_contract_id": nil}).Error
		}
		return tx.Table("projects").Where("id = ? AND current_contract_id = ?", project.ID, node.ID).Update("current_contract_id", nil).Error
	})
}

// Repository owns execution-domain SQL and transactions. Callers never receive
// a database connection; they only use this domain persistence boundary.
type Repository struct {
	orm *gorm.DB
}

func NewRepository(orm *gorm.DB) *Repository { return &Repository{orm: orm} }

// ListNodeProjections loads nodes belonging to one public project.
func (repository *Repository) ListNodeProjections(ctx context.Context, projectID string) ([]NodeProjection, error) {
	var values []NodeProjection
	err := repository.orm.WithContext(ctx).Table("execution_contracts AS n").Select(`n.uuid, branch.uuid AS branch_uuid, revision.uuid AS revision_uuid, parent.uuid AS parent_uuid, n.source_contract_ids_json AS source_ids, supplement_node.uuid AS supplement_uuid, retry_node.uuid AS retry_uuid, actor.user_id AS actor_user_id, n.title, n.stage, n.original_intent, contract.uuid AS smart_contract_uuid, n.smart_contract_version, n.verifiable_goal, n.acceptance_criteria_json, n.evidence_requirement, n.completion_claim, n.evidence_text, n.started_at, n.ended_at, record.uuid AS record_uuid, n.draft_review_json, n.draft_review_ai_config_json AS draft_ai_json, n.review_messages_json, n.ai_review_json, n.completion_review_ai_config_json AS completion_ai_json, n.completion_review_rounds_json AS review_rounds_json, planning.uuid AS planning_uuid, completion.uuid AS completion_uuid, n.user_verdict_json, n.next_contract_title, n.created_at, n.updated_at`).Joins("JOIN projects AS p ON p.id = n.project_id").Joins("LEFT JOIN users AS actor ON actor.id = n.actor_id").Joins("LEFT JOIN execution_branches AS branch ON branch.id = n.branch_id").Joins("JOIN project_contract_revisions AS revision ON revision.id = n.project_contract_revision_id").Joins("LEFT JOIN execution_contracts AS parent ON parent.id = n.parent_contract_id").Joins("LEFT JOIN execution_contracts AS supplement_node ON supplement_node.id = n.supplement_of_contract_id").Joins("LEFT JOIN execution_contracts AS retry_node ON retry_node.id = n.retry_of_contract_id").Joins("LEFT JOIN smart_contracts AS contract ON contract.id = n.smart_contract_id").Joins("LEFT JOIN completion_records AS record ON record.id = n.completion_record_id").Joins("LEFT JOIN node_conversations AS planning ON planning.id = n.planning_conversation_id").Joins("LEFT JOIN node_conversations AS completion ON completion.id = n.completion_conversation_id").Where("p.uuid = ?", projectID).Order("n.created_at ASC").Scan(&values).Error
	return values, err
}

// ListEdgeProjections loads all graph edges; callers scope them to known nodes.
func (repository *Repository) ListEdgeProjections(ctx context.Context) ([]EdgeProjection, error) {
	var values []EdgeProjection
	err := repository.orm.WithContext(ctx).Table("execution_edges AS e").Select("e.uuid, source_node.uuid AS source_uuid, target_node.uuid AS target_uuid, e.type, e.created_at").Joins("JOIN execution_contracts AS source_node ON source_node.id = e.source_contract_id").Joins("JOIN execution_contracts AS target_node ON target_node.id = e.target_contract_id").Order("e.created_at ASC").Scan(&values).Error
	return values, err
}

// ListBranchProjections loads branches belonging to one public project.
func (repository *Repository) ListBranchProjections(ctx context.Context, projectID string) ([]BranchProjection, error) {
	var values []BranchProjection
	err := repository.orm.WithContext(ctx).Table("execution_branches AS b").Select("b.uuid, p.uuid AS project_uuid, b.title, root_node.uuid AS root_uuid, forked_node.uuid AS forked_uuid, head_node.uuid AS head_uuid, current_node.uuid AS current_uuid, creator.user_id AS created_by_user_id, b.created_at").Joins("JOIN projects AS p ON p.id = b.project_id").Joins("LEFT JOIN users AS creator ON creator.id = b.created_by").Joins("LEFT JOIN execution_contracts AS root_node ON root_node.id = b.root_contract_id").Joins("LEFT JOIN execution_contracts AS forked_node ON forked_node.id = b.forked_from_contract_id").Joins("LEFT JOIN execution_contracts AS head_node ON head_node.id = b.head_contract_id").Joins("LEFT JOIN execution_contracts AS current_node ON current_node.id = b.current_contract_id").Where("p.uuid = ?", projectID).Order("b.created_at ASC").Scan(&values).Error
	return values, err
}

// ListCompletionProjections loads completion records belonging to one project.
func (repository *Repository) ListCompletionProjections(ctx context.Context, projectID string) ([]CompletionProjection, error) {
	var values []CompletionProjection
	err := repository.orm.WithContext(ctx).Table("completion_records AS r").Select("r.uuid, p.uuid AS project_uuid, closing_node.uuid AS closing_uuid, r.covered_contract_ids_json AS covered_ids, r.title, r.summary, contract.uuid AS smart_contract_uuid, r.smart_contract_version, r.review_id, r.ai_review_verdict AS review_verdict, r.record_kind, r.user_verdict_json AS user_verdict, r.created_at").Joins("JOIN projects AS p ON p.id = r.project_id").Joins("JOIN execution_contracts AS closing_node ON closing_node.id = r.closing_contract_id").Joins("JOIN smart_contracts AS contract ON contract.id = r.smart_contract_id").Where("p.uuid = ?", projectID).Order("r.created_at DESC").Scan(&values).Error
	return values, err
}

// UUIDByInternalIDs resolves opaque execution IDs for stored JSON references.
func (repository *Repository) UUIDByInternalIDs(ctx context.Context, ids []uint64) (map[uint64]string, error) {
	result := make(map[uint64]string, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	var values []struct {
		ID   uint64 `gorm:"column:id"`
		UUID string `gorm:"column:uuid"`
	}
	if err := repository.orm.WithContext(ctx).Table("execution_contracts").Select("id, uuid").Where("id IN ?", ids).Find(&values).Error; err != nil {
		return nil, err
	}
	for _, value := range values {
		result[value.ID] = value.UUID
	}
	return result, nil
}
