// Package demo contains explicit, local-only persistence fixtures for exploring the product.
package demo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	infrastructuresecurity "github.com/singaurora/exec-graph/backend/internal/infrastructure/security"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	generalContractUUID = "smart-contract-general"

	generalContractBody = `## 这份规则做什么

把一个较大的目标拆成当前可以推进的一小步，并持续记录实际发生的事情。

## 行动关注点

- 目标要说明想改变什么，以及这一步服务于哪个更大的方向
- 行动要具体到用户今天可以开始做什么
- 列出关键前提、可能阻碍和需要观察的现实变化
- 将计划、已经做过的行动、观察到的结果分开记录
- 说明下一步如何继续，而不是只追求一次性结束

## AI 辅助原则

AI 只能分析用户提供的目标、行动记录和材料，不能知道现实中是否真的发生，也不能替用户证明最终效果。
“做到位清单”用于帮助用户提前想清楚需要关注什么，不是 AI 对现实完成情况的裁判标准。
AI 应指出记录覆盖了什么、哪些仍然未知、哪里存在偏差，以及下一步可以怎么做。
不要把用户的计划改写成已经完成，也不要因为记录不完整就把行动判定为失败。`
)

type userSpec struct {
	handle string
	name   string
	email  string
}

type projectSpec struct {
	uuid, owner, title, description, rules string
}

type nodeSpec struct {
	uuid, project, owner, title, goal, evidence, claim, parent string
	criteria                                                   []string
	complete                                                   bool
}

type callSpec struct {
	uuid, project, target, owner, title, status string
	submissions                                 []submissionSpec
}

type submissionSpec struct {
	uuid, record, contributor, mapping, status string
}

type demoUser struct {
	ID       uint64
	Handle   string
	Username string
}

type demoProject struct {
	ID       uint64
	OwnerID  uint64
	Revision uint64
}

type demoNode struct {
	ID        uint64
	ProjectID uint64
	Revision  uint64
	OwnerID   uint64
}

// Seed writes a repeatable public collaboration graph for test accounts only.
// It never runs as part of API startup and never deletes existing data.
func Seed(ctx context.Context, db *gorm.DB, demoPassword string) error {
	demoPassword = strings.TrimSpace(demoPassword)
	if len([]rune(demoPassword)) < 6 {
		return errors.New("demo password must contain at least 6 characters")
	}
	hasher := infrastructuresecurity.PasswordHasher{}
	passwordHash, err := hasher.Hash(demoPassword)
	if err != nil {
		return fmt.Errorf("hash demo password: %w", err)
	}

	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		contractID, contractVersion, err := ensureGeneralContract(ctx, tx)
		if err != nil {
			return err
		}
		users, err := ensureUsers(ctx, tx, passwordHash)
		if err != nil {
			return err
		}
		projects, err := ensureProjects(ctx, tx, users, contractID, contractVersion)
		if err != nil {
			return err
		}
		nodes, records, err := ensureNodes(ctx, tx, users, projects, contractID, contractVersion)
		if err != nil {
			return err
		}
		if err := ensureCalls(ctx, tx, users, projects, nodes, records); err != nil {
			return err
		}
		return nil
	})
}

func ensureGeneralContract(ctx context.Context, tx *gorm.DB) (uint64, string, error) {
	var contract struct {
		ID      uint64 `gorm:"column:id"`
		Version string `gorm:"column:version"`
	}
	result := tx.WithContext(ctx).Table("smart_contracts").Where("uuid = ?", generalContractUUID).First(&contract)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		contract = struct {
			ID      uint64 `gorm:"column:id"`
			Version string `gorm:"column:version"`
		}{}
		if err := tx.WithContext(ctx).Table("smart_contracts").Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "uuid"}},
			DoUpdates: clause.AssignmentColumns([]string{"name", "source", "version", "description", "body", "deleted_at", "deleted_by"}),
		}).Create(map[string]any{
			"uuid": generalContractUUID, "name": "长期行动指南", "source": "official", "version": "1.1.0",
			"description": "适合长期目标、复杂工作和多人协作，帮助把想法拆成行动并记录现实反馈。", "body": generalContractBody,
		}).Error; err != nil {
			return 0, "", fmt.Errorf("create general smart contract: %w", err)
		}
		if err := tx.WithContext(ctx).Table("smart_contracts").Where("uuid = ?", generalContractUUID).First(&contract).Error; err != nil {
			return 0, "", fmt.Errorf("load general smart contract: %w", err)
		}
	} else if result.Error != nil {
		return 0, "", fmt.Errorf("load general smart contract: %w", result.Error)
	}
	if err := tx.WithContext(ctx).Table("smart_contracts").Where("id = ?", contract.ID).Updates(map[string]any{
		"name": "长期行动指南", "source": "official", "version": "1.1.0", "description": "适合长期目标、复杂工作和多人协作，帮助把想法拆成行动并记录现实反馈。", "body": generalContractBody,
		"created_by": nil, "deleted_at": nil, "deleted_by": nil,
	}).Error; err != nil {
		return 0, "", fmt.Errorf("refresh general smart contract: %w", err)
	}
	if contract.Version == "" {
		return 0, "", errors.New("general smart contract has no version")
	}
	return contract.ID, contract.Version, nil
}

func ensureUsers(ctx context.Context, tx *gorm.DB, passwordHash string) (map[string]demoUser, error) {
	specs := []userSpec{
		{handle: "demo-lan", name: "林澜", email: "demo.lan@execgraph.local"},
		{handle: "demo-qiao", name: "乔言", email: "demo.qiao@execgraph.local"},
		{handle: "demo-chen", name: "陈默", email: "demo.chen@execgraph.local"},
		{handle: "demo-zhao", name: "赵宁", email: "demo.zhao@execgraph.local"},
		{handle: "demo-sun", name: "孙禾", email: "demo.sun@execgraph.local"},
	}
	users := make(map[string]demoUser, len(specs))
	for _, spec := range specs {
		var row struct {
			ID            uint64 `gorm:"column:id"`
			IsTestAccount bool   `gorm:"column:is_test_account"`
		}
		result := tx.WithContext(ctx).Table("users").Where("user_id = ?", spec.handle).First(&row)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			var emailOwner struct {
				ID uint64 `gorm:"column:id"`
			}
			if err := tx.WithContext(ctx).Table("users").Select("id").Where("email = ?", spec.email).First(&emailOwner).Error; err == nil {
				return nil, fmt.Errorf("demo email already belongs to another account: %s", spec.email)
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, fmt.Errorf("check demo email %s: %w", spec.email, err)
			}
			if err := tx.WithContext(ctx).Table("users").Create(map[string]any{
				"username": spec.name, "user_id": spec.handle, "is_test_account": true,
				"email": spec.email, "password_hash": passwordHash, "email_verified_at": time.Now(),
			}).Error; err != nil {
				return nil, fmt.Errorf("create demo user %s: %w", spec.handle, err)
			}
			if err := tx.WithContext(ctx).Table("users").Select("id, is_test_account").Where("user_id = ?", spec.handle).First(&row).Error; err != nil {
				return nil, fmt.Errorf("load demo user %s: %w", spec.handle, err)
			}
		} else if result.Error != nil {
			return nil, fmt.Errorf("load demo user %s: %w", spec.handle, result.Error)
		} else if !row.IsTestAccount {
			return nil, fmt.Errorf("refusing to overwrite non-test account %s", spec.handle)
		}
		if err := tx.WithContext(ctx).Table("users").Where("id = ?", row.ID).Updates(map[string]any{
			"username": spec.name, "email": spec.email, "is_test_account": true, "password_hash": passwordHash,
		}).Error; err != nil {
			return nil, fmt.Errorf("update demo user %s: %w", spec.handle, err)
		}
		users[spec.handle] = demoUser{ID: row.ID, Handle: spec.handle, Username: spec.name}
	}
	return users, nil
}

func ensureProjects(ctx context.Context, tx *gorm.DB, users map[string]demoUser, contractID uint64, version string) (map[string]demoProject, error) {
	specs := []projectSpec{
		{"demo-project-elder-appointments", "demo-lan", "让社区老人能独立预约活动", "把老人预约活动时遇到的字号、步骤和线下协助问题，整理为可测试、可复用的预约流程。", "每次推进只解决一个实际障碍；只有真实使用证据齐备时才能收束。"},
		{"demo-project-elder-interviews", "demo-qiao", "社区预约障碍访谈摘要", "访谈社区老人和志愿者，整理预约活动中最容易卡住的真实步骤。", "记录原话与观察，结论必须能回到具体访谈材料。"},
		{"demo-project-large-print-card", "demo-chen", "大字号预约辅助卡", "为线下活动预约设计一张能独立阅读、勾选和交给志愿者确认的辅助卡。", "每个版式决策都要说明它解决的阅读或操作障碍。"},
		{"demo-project-campus-route", "demo-zhao", "校园无障碍路线图", "把从南门到图书馆的无障碍路线做成可验证、能被新同学使用的指引。", "路线与门禁信息必须来自实地走访或可追溯的现场材料。"},
		{"demo-project-food-share", "demo-sun", "社区剩余食物共享试点", "验证一套让附近店铺、志愿者和领取者都能理解的当日食物领取流程。", "安全、时间窗口和交接责任必须写清。"},
		{"demo-project-community-handoff", "demo-chen", "社区服务交接清单", "把预约和食物领取中的有效交接方法收束成可被社区工作人员复用的清单。", "每项内容都要标明实际服务场景及适用边界。"},
	}
	projects := make(map[string]demoProject, len(specs))
	for _, spec := range specs {
		owner := users[spec.owner]
		var project struct {
			ID      uint64 `gorm:"column:id"`
			OwnerID uint64 `gorm:"column:owner_id"`
		}
		result := tx.WithContext(ctx).Table("projects").Where("uuid = ?", spec.uuid).First(&project)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			if err := tx.WithContext(ctx).Table("projects").Create(map[string]any{
				"uuid": spec.uuid, "owner_id": owner.ID, "title": spec.title, "description": spec.description,
				"project_type": "guided", "project_rules": spec.rules, "is_default": false, "visibility": "public",
			}).Error; err != nil {
				return nil, fmt.Errorf("create demo project %s: %w", spec.uuid, err)
			}
			if err := tx.WithContext(ctx).Table("projects").Select("id, owner_id").Where("uuid = ?", spec.uuid).First(&project).Error; err != nil {
				return nil, fmt.Errorf("load demo project %s: %w", spec.uuid, err)
			}
		} else if result.Error != nil {
			return nil, fmt.Errorf("load demo project %s: %w", spec.uuid, result.Error)
		} else if project.OwnerID != owner.ID {
			return nil, fmt.Errorf("demo project %s belongs to another account", spec.uuid)
		}
		if err := tx.WithContext(ctx).Table("projects").Where("id = ?", project.ID).Updates(map[string]any{
			"owner_id": owner.ID, "title": spec.title, "description": spec.description, "project_type": "guided",
			"project_rules": spec.rules, "is_default": false, "visibility": "public", "archived_at": nil,
		}).Error; err != nil {
			return nil, fmt.Errorf("update demo project %s: %w", spec.uuid, err)
		}
		var revision struct {
			ID uint64 `gorm:"column:id"`
		}
		revisionUUID := "demo-revision-" + spec.uuid
		result = tx.WithContext(ctx).Table("project_contract_revisions").Where("uuid = ?", revisionUUID).First(&revision)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			if err := tx.WithContext(ctx).Table("project_contract_revisions").Create(map[string]any{
				"uuid": revisionUUID, "project_id": project.ID, "smart_contract_id": contractID, "smart_contract_version": version,
				"reason": "演示项目基础规则", "smart_contract_name": "正式项目规则", "smart_contract_description": "演示项目使用的基础审查规则。", "smart_contract_body": generalContractBody,
			}).Error; err != nil {
				return nil, fmt.Errorf("create demo revision %s: %w", spec.uuid, err)
			}
			if err := tx.WithContext(ctx).Table("project_contract_revisions").Select("id").Where("uuid = ?", revisionUUID).First(&revision).Error; err != nil {
				return nil, fmt.Errorf("load demo revision %s: %w", spec.uuid, err)
			}
		} else if result.Error != nil {
			return nil, fmt.Errorf("load demo revision %s: %w", spec.uuid, result.Error)
		}
		if err := tx.WithContext(ctx).Table("projects").Where("id = ?", project.ID).Update("active_contract_revision_id", revision.ID).Error; err != nil {
			return nil, fmt.Errorf("activate demo revision %s: %w", spec.uuid, err)
		}
		projects[spec.uuid] = demoProject{ID: project.ID, OwnerID: owner.ID, Revision: revision.ID}
	}
	return projects, nil
}

func ensureNodes(ctx context.Context, tx *gorm.DB, users map[string]demoUser, projects map[string]demoProject, contractID uint64, version string) (map[string]demoNode, map[string]uint64, error) {
	specs := []nodeSpec{
		{"demo-node-elder-research", "demo-project-elder-appointments", "demo-lan", "整理预约障碍与既有支持方式", "形成一份能说明老人预约活动时主要障碍和现有支持方式的访谈摘要。", "提交访谈摘要、匿名原话和步骤对照表。", "整理了 6 份访谈记录，确认字号、入口位置和确认方式是最常见的三类障碍。", "", []string{"归纳至少三种不同的预约障碍，并保留对应原话或观察。", "区分老人自主完成、志愿者协助和完全无法完成的步骤。"}, true},
		{"demo-node-elder-card-test", "demo-project-elder-appointments", "demo-lan", "验证大字号预约辅助卡能否独立使用", "用真实老人试用大字号预约辅助卡，确认它是否能减少预约过程中的求助步骤。", "提交试用观察记录、辅助卡版本与修改说明。", "", "demo-node-elder-research", []string{"至少三位老人能在不解释流程的情况下完成填写。", "记录每位试用者卡住的位置与完成耗时。", "根据试用结果明确下一轮必须修改的一项内容。"}, false},
		{"demo-node-interview-summary", "demo-project-elder-interviews", "demo-qiao", "完成五位老人预约障碍访谈摘要", "提供可被其他社区项目引用的预约障碍原始材料与模式归纳。", "提交匿名访谈摘录、观察表和主题归纳。", "完成五位老人和两位志愿者的访谈摘要，定位到字号、入口和确认方式三类共性障碍。", "", []string{"包含五位不同受访者的匿名原话或观察。", "每个结论都能定位到具体访谈材料。"}, true},
		{"demo-node-card-design", "demo-project-large-print-card", "demo-chen", "完成大字号预约辅助卡初稿", "产出可打印的预约辅助卡初稿，并说明每个版块解决的操作障碍。", "提交可打印初稿、版式说明和可读性检查记录。", "完成 A5 双面辅助卡初稿，保留了大字号填写区、确认电话和志愿者求助入口。", "", []string{"卡片包含活动选择、联系方式、确认方式和求助入口。", "正文与关键操作区采用可读的大字号层级。"}, true},
		{"demo-node-campus-walk", "demo-project-campus-route", "demo-zhao", "完成南门至图书馆的无障碍实地走访", "确认一条从南门到图书馆的连续无障碍路线，并记录实际阻碍。", "提交路线照片、位置说明和实走时间记录。", "实走并记录了南门到图书馆的路线，标注两处坡道和一处需要志愿者协助的门禁。", "", []string{"记录路线中的坡道、门禁、电梯与临时障碍。", "给出可被首次到访者理解的连续指引。"}, true},
		{"demo-node-campus-map", "demo-project-campus-route", "demo-zhao", "发布可核对的无障碍路线图", "将实地路线与新生可读指引汇合成可复用的路线图。", "提交路线图、走读记录和反馈。", "发布路线图并完成首次到访者走读，已修正门禁描述。", "demo-node-campus-walk", []string{"路线图中的关键点可回到实地记录核对。", "至少一位首次到访者能按图完成路线。"}, true},
		{"demo-node-food-observe", "demo-project-food-share", "demo-sun", "梳理店铺交接的时间与责任边界", "明确剩余食物从店铺交出到领取者拿到之间需要被记录的时间、责任和安全信息。", "提交流程草图和一次店铺访谈记录。", "完成两家店铺访谈，整理了交接时间、食物状态和未领取处理的共同要求。", "", []string{"列出店铺、志愿者和领取者各自确认的事项。", "明确食物状态、领取时间窗口与未领取处理方式。"}, true},
		{"demo-node-food-handoff", "demo-project-food-share", "demo-sun", "验证当日食物领取交接流程", "用一次真实试点验证店铺、志愿者和领取者能否按同一张交接单完成当日食物领取。", "提交交接单、时间记录和参与者反馈。", "", "demo-node-food-observe", []string{"交接单包含食物状态、领取截止时间和责任确认。", "至少一次真实交接可完整追溯。"}, false},
	}
	nodes := make(map[string]demoNode, len(specs))
	records := make(map[string]uint64)
	for _, spec := range specs {
		project := projects[spec.project]
		owner := users[spec.owner]
		var parentID *uint64
		var sourceIDs []uint64
		if spec.parent != "" {
			parent := nodes[spec.parent]
			parentID = &parent.ID
			sourceIDs = []uint64{parent.ID}
		}
		criteria, _ := json.Marshal(criteriaJSON(spec.criteria))
		sources, _ := json.Marshal(sourceIDs)
		draftReview, _ := json.Marshal(map[string]any{"verdict": "pass", "summary": "演示节点草案已通过审核。"})
		values := map[string]any{
			"uuid": spec.uuid, "project_id": project.ID, "project_contract_revision_id": project.Revision, "parent_contract_id": parentID,
			"source_contract_ids_json": sources, "actor_id": owner.ID, "title": spec.title, "stage": map[bool]string{true: "completed", false: "frozen"}[spec.complete],
			"original_intent": "演示协作项目中的行动记录。", "smart_contract_id": contractID, "smart_contract_version": version, "verifiable_goal": spec.goal,
			"acceptance_criteria_json": criteria, "evidence_requirement": spec.evidence, "completion_claim": nullableString(spec.claim),
			"evidence_text": nullableString(spec.claim), "draft_review_json": draftReview, "review_messages_json": "[]",
		}
		var row struct {
			ID uint64 `gorm:"column:id"`
		}
		result := tx.WithContext(ctx).Table("execution_contracts").Where("uuid = ?", spec.uuid).First(&row)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			if err := tx.WithContext(ctx).Table("execution_contracts").Create(values).Error; err != nil {
				return nil, nil, fmt.Errorf("create demo node %s: %w", spec.uuid, err)
			}
			if err := tx.WithContext(ctx).Table("execution_contracts").Select("id").Where("uuid = ?", spec.uuid).First(&row).Error; err != nil {
				return nil, nil, fmt.Errorf("load demo node %s: %w", spec.uuid, err)
			}
		} else if result.Error != nil {
			return nil, nil, fmt.Errorf("load demo node %s: %w", spec.uuid, result.Error)
		} else if err := tx.WithContext(ctx).Table("execution_contracts").Where("id = ?", row.ID).Updates(values).Error; err != nil {
			return nil, nil, fmt.Errorf("update demo node %s: %w", spec.uuid, err)
		}
		nodes[spec.uuid] = demoNode{ID: row.ID, ProjectID: project.ID, Revision: project.Revision, OwnerID: owner.ID}
		if spec.complete {
			recordUUID := "demo-record-" + spec.uuid
			verdict, _ := json.Marshal(map[string]any{"result": "confirmed_complete", "note": "演示数据：维护者确认该成果可被继续使用。"})
			covered, _ := json.Marshal([]uint64{row.ID})
			if err := tx.WithContext(ctx).Table("completion_records").Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "uuid"}}, DoUpdates: clause.AssignmentColumns([]string{"title", "summary", "user_verdict_json"})}).Create(map[string]any{
				"uuid": recordUUID, "project_id": project.ID, "closing_contract_id": row.ID, "covered_contract_ids_json": covered, "title": spec.title,
				"summary": "演示数据：这项成果已通过 AI 审查并由创建者确认，可作为其他行动的来源。", "smart_contract_id": contractID, "smart_contract_version": version,
				"review_id": "demo-review-" + spec.uuid, "ai_review_verdict": "pass", "record_kind": "accepted", "user_verdict_json": verdict,
			}).Error; err != nil {
				return nil, nil, fmt.Errorf("create demo record %s: %w", recordUUID, err)
			}
			var record struct {
				ID uint64 `gorm:"column:id"`
			}
			if err := tx.WithContext(ctx).Table("completion_records").Select("id").Where("uuid = ?", recordUUID).First(&record).Error; err != nil {
				return nil, nil, fmt.Errorf("load demo record %s: %w", recordUUID, err)
			}
			if err := tx.WithContext(ctx).Table("execution_contracts").Where("id = ?", row.ID).Updates(map[string]any{"completion_record_id": record.ID, "completion_claim": spec.claim, "evidence_text": spec.claim}).Error; err != nil {
				return nil, nil, fmt.Errorf("link demo record %s: %w", recordUUID, err)
			}
			records[spec.uuid] = record.ID
		}
		if spec.parent != "" {
			edgeUUID := "demo-edge-" + spec.uuid
			if err := tx.WithContext(ctx).Table("execution_edges").Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "uuid"}}, DoUpdates: clause.AssignmentColumns([]string{"source_contract_id", "target_contract_id", "type"})}).Create(map[string]any{"uuid": edgeUUID, "source_contract_id": parentID, "target_contract_id": row.ID, "type": "lineage"}).Error; err != nil {
				return nil, nil, fmt.Errorf("create demo edge %s: %w", edgeUUID, err)
			}
		}
		if err := tx.WithContext(ctx).Table("projects").Where("id = ?", project.ID).Update("current_contract_id", row.ID).Error; err != nil {
			return nil, nil, fmt.Errorf("update demo project head %s: %w", spec.project, err)
		}
	}
	return nodes, records, nil
}

func ensureCalls(ctx context.Context, tx *gorm.DB, users map[string]demoUser, projects map[string]demoProject, nodes map[string]demoNode, records map[string]uint64) error {
	calls := []callSpec{
		{"demo-call-elder-card", "demo-project-elder-appointments", "demo-node-elder-card-test", "demo-lan", "补齐预约辅助卡的真实障碍与版式证据", "open", []submissionSpec{{"demo-submission-elder-interviews", "demo-node-interview-summary", "demo-qiao", "访谈摘要提供真实障碍来源，可用于核对老人实际卡住的步骤。", "submitted"}, {"demo-submission-elder-card", "demo-node-card-design", "demo-chen", "辅助卡初稿可作为试用版本和改版依据。", "submitted"}}},
		{"demo-call-campus-map", "demo-project-campus-route", "demo-node-campus-map", "demo-zhao", "汇合入口核查与志愿者引导反馈", "adopted", []submissionSpec{{"demo-submission-campus-audit", "demo-node-campus-walk", "demo-chen", "路线实地记录为门禁和通行条件提供现场依据。", "adopted"}, {"demo-submission-campus-brief", "demo-node-interview-summary", "demo-lan", "访谈中的求助信息补足首次到访者的协助说明。", "adopted"}}},
		{"demo-call-food-handoff", "demo-project-food-share", "demo-node-food-handoff", "demo-sun", "补齐当日领取的交接单和时间窗口证据", "open", []submissionSpec{{"demo-submission-food-labels", "demo-node-card-design", "demo-zhao", "已有成果提供可核对的字段设计基础。", "submitted"}}},
	}
	for _, spec := range calls {
		project := projects[spec.project]
		target := nodes[spec.target]
		owner := users[spec.owner]
		var call struct {
			ID uint64 `gorm:"column:id"`
		}
		if err := tx.WithContext(ctx).Table("collaboration_calls").Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "uuid"}}, DoUpdates: clause.AssignmentColumns([]string{"title", "status", "max_submissions"})}).Create(map[string]any{
			"uuid": spec.uuid, "project_id": project.ID, "target_contract_id": target.ID, "created_by": owner.ID, "title": spec.title, "status": spec.status, "max_submissions": 8,
		}).Error; err != nil {
			return fmt.Errorf("upsert demo call %s: %w", spec.uuid, err)
		}
		if err := tx.WithContext(ctx).Table("collaboration_calls").Select("id").Where("uuid = ?", spec.uuid).First(&call).Error; err != nil {
			return fmt.Errorf("load demo call %s: %w", spec.uuid, err)
		}
		var submissionIDs []uint64
		for _, submission := range spec.submissions {
			recordID := records[submission.record]
			contributor := users[submission.contributor]
			var row struct {
				ID uint64 `gorm:"column:id"`
			}
			if err := tx.WithContext(ctx).Table("collaboration_submissions").Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "uuid"}}, DoUpdates: clause.AssignmentColumns([]string{"mapping_text", "status", "contributor_id", "call_id", "source_record_id"})}).Create(map[string]any{
				"uuid": submission.uuid, "call_id": call.ID, "source_record_id": recordID, "contributor_id": contributor.ID, "mapping_text": submission.mapping, "note": "演示数据：来源成果等待目标项目组合审查。", "status": submission.status,
			}).Error; err != nil {
				return fmt.Errorf("upsert demo submission %s: %w", submission.uuid, err)
			}
			if err := tx.WithContext(ctx).Table("collaboration_submissions").Select("id").Where("uuid = ?", submission.uuid).First(&row).Error; err != nil {
				return fmt.Errorf("load demo submission %s: %w", submission.uuid, err)
			}
			submissionIDs = append(submissionIDs, row.ID)
		}
		if spec.status == "adopted" {
			encoded, _ := json.Marshal(submissionIDs)
			review, _ := json.Marshal(map[string]any{"verdict": "pass", "summary": "演示数据：来源成果共同满足目标节点的冻结标准。"})
			if err := tx.WithContext(ctx).Table("collaboration_review_batches").Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "uuid"}}, DoUpdates: clause.AssignmentColumns([]string{"submission_ids_json", "ai_review_json", "status", "adopted_at"})}).Create(map[string]any{
				"uuid": "demo-batch-" + spec.uuid, "call_id": call.ID, "project_id": project.ID, "target_contract_id": target.ID, "created_by": owner.ID,
				"submission_ids_json": encoded, "ai_review_json": review, "status": "adopted", "adopted_at": time.Now(),
			}).Error; err != nil {
				return fmt.Errorf("upsert demo review batch %s: %w", spec.uuid, err)
			}
		}
	}
	// A separate public project is shown as a contribution workspace for the open call.
	workspace := projects["demo-project-elder-interviews"]
	var call struct {
		ID uint64 `gorm:"column:id"`
	}
	if err := tx.WithContext(ctx).Table("collaboration_calls").Select("id").Where("uuid = ?", "demo-call-elder-card").First(&call).Error; err != nil {
		return fmt.Errorf("load demo workspace call: %w", err)
	}
	if err := tx.WithContext(ctx).Table("projects").Where("id = ?", workspace.ID).Update("contribution_call_id", call.ID).Error; err != nil {
		return fmt.Errorf("link demo contribution workspace: %w", err)
	}
	return nil
}

func criteriaJSON(items []string) []map[string]string {
	result := make([]map[string]string, 0, len(items))
	for index, item := range items {
		result = append(result, map[string]string{"id": fmt.Sprintf("c%d", index+1), "text": item, "requiredEvidence": fmt.Sprintf("C%d：提交可直接核对这项标准的材料或观察记录。", index+1)})
	}
	return result
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}
