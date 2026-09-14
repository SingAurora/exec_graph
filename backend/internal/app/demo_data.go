package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// SeedDemoData creates deterministic, clearly marked collaboration fixtures.
// It is intentionally a separate command so normal service startup never adds
// demo users or public projects to a real workspace.
func SeedDemoData() error {
	configPath := os.Getenv("EXEC_GRAPH_CONFIG")
	if configPath == "" {
		configPath = "config.local.yaml"
	}
	config, err := loadConfig(configPath)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}
	db, err := openDatabase(config.Database)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := migrateDatabase(ctx, db); err != nil {
		return err
	}
	if err := seedSystemData(ctx, db); err != nil {
		return err
	}
	return seedDemoCollaborationData(ctx, db)
}

type demoUser struct {
	Handle   string
	Name     string
	Email    string
	Password string
}

type demoProject struct {
	ID                 string
	OwnerHandle        string
	Title              string
	Description        string
	Rules              string
	ProjectType        string
	CurrentNode        string
	ContributionCallID string
}

type demoNode struct {
	ID          string
	ProjectID   string
	OwnerHandle string
	Title       string
	Goal        string
	Criteria    []string
	Evidence    string
	Claim       string
	Stage       string
	RecordID    string
	ParentID    string
}

func seedDemoCollaborationData(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	users := []demoUser{
		{Handle: "demo-lan", Name: "林澜", Email: "demo.lan@execgraph.local", Password: "execgraph-demo"},
		{Handle: "demo-qiao", Name: "乔言", Email: "demo.qiao@execgraph.local", Password: "execgraph-demo"},
		{Handle: "demo-chen", Name: "陈默", Email: "demo.chen@execgraph.local", Password: "execgraph-demo"},
		{Handle: "demo-zhao", Name: "赵宁", Email: "demo.zhao@execgraph.local", Password: "execgraph-demo"},
		{Handle: "demo-sun", Name: "孙禾", Email: "demo.sun@execgraph.local", Password: "execgraph-demo"},
	}
	userIDs := make(map[string]uint64, len(users))
	for _, user := range users {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO users (username, user_id, is_test_account, email, password_hash, email_verified_at)
			VALUES (?, ?, 1, ?, ?, NOW())
			ON DUPLICATE KEY UPDATE username = VALUES(username), is_test_account = 1, password_hash = VALUES(password_hash), email_verified_at = COALESCE(email_verified_at, VALUES(email_verified_at))`,
			user.Name, user.Handle, user.Email, user.Password); err != nil {
			return fmt.Errorf("upsert demo user %s: %w", user.Handle, err)
		}
		var userID uint64
		if err := tx.QueryRowContext(ctx, `SELECT id FROM users WHERE user_id = ?`, user.Handle).Scan(&userID); err != nil {
			return fmt.Errorf("load demo user %s: %w", user.Handle, err)
		}
		userIDs[user.Handle] = userID
	}

	var version string
	if err := tx.QueryRowContext(ctx, `SELECT version FROM smart_contracts WHERE id = ?`, generalSmartContractID).Scan(&version); err != nil {
		return fmt.Errorf("load system contract: %w", err)
	}
	ruleHash := hashValue(generalSmartContractBody)
	projects := []demoProject{
		{
			ID: "demo-project-elder-appointments", OwnerHandle: "demo-lan", Title: "让社区老人能独立预约活动",
			Description: "把老人预约活动时遇到的字号、步骤和线下协助问题，整理为可测试、可复用的预约流程。",
			Rules:       "每次推进只解决一个实际障碍；访谈、界面与现场验证可以并行；只有真实使用证据齐备时才能收束。",
			CurrentNode: "demo-node-elder-card-test",
		},
		{
			ID: "demo-project-elder-interviews", OwnerHandle: "demo-qiao", Title: "社区预约障碍访谈摘要",
			Description:        "访谈社区老人和志愿者，整理预约活动中最容易卡住的真实步骤。",
			Rules:              "记录原话与观察，结论必须能回到具体访谈材料。",
			ContributionCallID: "demo-call-elder-card",
		},
		{
			ID: "demo-project-large-print-card", OwnerHandle: "demo-chen", Title: "大字号预约辅助卡",
			Description: "为线下活动预约设计一张能独立阅读、勾选和交给志愿者确认的辅助卡。",
			Rules:       "每个版式决策都要说明它解决的阅读或操作障碍。",
		},
		{
			ID: "demo-project-campus-route", OwnerHandle: "demo-zhao", Title: "校园无障碍路线图",
			Description: "把从南门到图书馆的无障碍路线做成可验证、能被新同学使用的指引。",
			Rules:       "路线、坡道与门禁信息必须来自实地走访或可追溯的现场材料。",
		},
		{
			ID: "demo-project-food-share", OwnerHandle: "demo-sun", Title: "社区剩余食物共享试点",
			Description: "验证一套让附近店铺、志愿者和领取者都能理解的当日食物领取流程。",
			Rules:       "安全、时间窗口和交接责任必须写清；每次试点只验证一个关键不确定性。",
			CurrentNode: "demo-node-food-handoff",
		},
		{
			ID: "demo-project-elder-reminder", OwnerHandle: "demo-qiao", Title: "社区活动提醒纸条",
			Description: "把预约后的时间、地点和取消方式写成老人能独立核对的纸质提醒。",
			Rules:       "每条提醒信息都必须来自实际预约流程或已采纳的障碍材料。",
			CurrentNode: "demo-node-elder-reminder-test",
		},
		{
			ID: "demo-project-elder-activity-script", OwnerHandle: "demo-sun", Title: "活动日志愿者提示语",
			Description: "整理志愿者在老人预约和到场时使用的简短提示语，减少临场解释差异。",
			Rules:       "提示语必须保留来源场景，不把假设写成老人已经理解的结论。",
		},
		{
			ID: "demo-project-campus-access-audit", OwnerHandle: "demo-chen", Title: "校园无障碍入口核查",
			Description: "核对南门、图书馆入口和门禁处的实际通行条件，给路线图提供现场证据。",
			Rules:       "每项入口信息必须有实地观察时间和可复核的位置描述。",
		},
		{
			ID: "demo-project-campus-volunteer-brief", OwnerHandle: "demo-lan", Title: "校园无障碍引导志愿者简报",
			Description: "把首次到访者在门禁与坡道处需要的协助方式整理为交接简报。",
			Rules:       "区分路线事实与志愿者建议，并写清适用位置。",
		},
		{
			ID: "demo-project-food-labels", OwnerHandle: "demo-zhao", Title: "剩余食物领取标签",
			Description: "设计店铺交接时使用的食物状态、领取时限和过敏原提示标签。",
			Rules:       "标签字段必须能被店铺和领取者在同一次交接中共同核对。",
		},
		{
			ID: "demo-project-food-volunteer-shift", OwnerHandle: "demo-qiao", Title: "食物共享志愿者交接班",
			Description: "记录志愿者换班时需要保留的领取进度、异常和责任信息。",
			Rules:       "交接记录必须能说明谁在何时接手了哪一项未完成事项。",
		},
		{
			ID: "demo-project-community-handoff", OwnerHandle: "demo-chen", Title: "社区服务交接清单",
			Description: "把预约和食物领取中的有效交接方法收束成可被社区工作人员复用的清单。",
			Rules:       "每一项清单内容必须标明它来自哪个实际服务场景及其适用边界。",
			CurrentNode: "demo-node-community-handoff",
		},
	}
	for _, project := range projects {
		ownerID := userIDs[project.OwnerHandle]
		revisionID := "demo-revision-" + project.ID
		projectType := project.ProjectType
		if projectType == "" {
			projectType = "guided"
		}
		if project.ContributionCallID != "" {
			projectType = "autonomous"
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO projects (id, owner_id, title, description, project_type, project_rules, is_default, visibility, contribution_call_id, current_contract_id, active_contract_revision_id)
			VALUES (?, ?, ?, ?, ?, ?, 0, 'public', NULLIF(?, ''), NULLIF(?, ''), ?)
			ON DUPLICATE KEY UPDATE owner_id = VALUES(owner_id), title = VALUES(title), description = VALUES(description), project_type = VALUES(project_type), project_rules = VALUES(project_rules), visibility = 'public', contribution_call_id = VALUES(contribution_call_id), current_contract_id = VALUES(current_contract_id), active_contract_revision_id = VALUES(active_contract_revision_id)`,
			project.ID, ownerID, project.Title, project.Description, projectType, project.Rules, project.ContributionCallID, project.CurrentNode, revisionID); err != nil {
			return fmt.Errorf("upsert demo project %s: %w", project.ID, err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO project_contract_revisions (id, project_id, smart_contract_id, smart_contract_version, rule_hash, reason, smart_contract_name, smart_contract_description, smart_contract_body)
			VALUES (?, ?, ?, ?, ?, '演示项目基础规则', '通用执行智能合约', '演示项目使用的基础审查规则。', ?)
			ON DUPLICATE KEY UPDATE smart_contract_version = VALUES(smart_contract_version), rule_hash = VALUES(rule_hash), smart_contract_body = VALUES(smart_contract_body)`,
			revisionID, project.ID, generalSmartContractID, version, ruleHash, generalSmartContractBody); err != nil {
			return fmt.Errorf("upsert demo revision %s: %w", project.ID, err)
		}
	}

	nodes := []demoNode{
		{ID: "demo-node-elder-research", ProjectID: "demo-project-elder-appointments", OwnerHandle: "demo-lan", Title: "整理预约障碍与既有支持方式", Goal: "形成一份能说明老人预约活动时主要障碍和现有支持方式的访谈摘要。", Criteria: []string{"归纳至少三种不同的预约障碍，并保留对应原话或观察。", "区分老人自主完成、志愿者协助和完全无法完成的步骤。"}, Evidence: "提交访谈摘要、匿名原话和步骤对照表。", Claim: "整理了 6 份访谈记录，确认字号、入口位置和确认方式是最常见的三类障碍。", Stage: "completed", RecordID: "demo-record-elder-research"},
		{ID: "demo-node-elder-card-test", ProjectID: "demo-project-elder-appointments", OwnerHandle: "demo-lan", Title: "验证大字号预约辅助卡能否独立使用", Goal: "用真实老人试用大字号预约辅助卡，确认它是否能减少预约过程中的求助步骤。", Criteria: []string{"至少三位老人能在不解释流程的情况下完成填写。", "记录每位试用者卡住的位置与完成耗时。", "根据试用结果明确下一轮必须修改的一项内容。"}, Evidence: "提交试用观察记录、辅助卡版本与修改说明。", Stage: "frozen", ParentID: "demo-node-elder-research"},
		{ID: "demo-node-interview-summary", ProjectID: "demo-project-elder-interviews", OwnerHandle: "demo-qiao", Title: "完成五位老人预约障碍访谈摘要", Goal: "提供可被其他社区项目引用的预约障碍原始材料与模式归纳。", Criteria: []string{"包含五位不同受访者的匿名原话或观察。", "每个结论都能定位到具体访谈材料。"}, Evidence: "提交匿名访谈摘录、观察表和主题归纳。", Claim: "完成五位老人和两位志愿者的访谈摘要，定位到字号、入口和确认方式三类共性障碍。", Stage: "completed", RecordID: "demo-record-interview-summary"},
		{ID: "demo-node-card-design", ProjectID: "demo-project-large-print-card", OwnerHandle: "demo-chen", Title: "完成大字号预约辅助卡初稿", Goal: "产出可打印的预约辅助卡初稿，并说明每个版块解决的操作障碍。", Criteria: []string{"卡片包含活动选择、联系方式、确认方式和求助入口。", "正文与关键操作区采用可读的大字号层级。", "每个版块都说明对应的用户障碍。"}, Evidence: "提交可打印初稿、版式说明和可读性检查记录。", Claim: "完成 A5 双面辅助卡初稿，保留了大字号填写区、确认电话和志愿者求助入口。", Stage: "completed", RecordID: "demo-record-card-design"},
		{ID: "demo-node-campus-walk", ProjectID: "demo-project-campus-route", OwnerHandle: "demo-zhao", Title: "完成南门至图书馆的无障碍实地走访", Goal: "确认一条从南门到图书馆的连续无障碍路线，并记录实际阻碍。", Criteria: []string{"记录路线中的坡道、门禁、电梯与临时障碍。", "给出可被首次到访者理解的连续指引。"}, Evidence: "提交路线照片、位置说明和实走时间记录。", Claim: "实走并记录了南门到图书馆的路线，标注两处坡道和一处需要志愿者协助的门禁。", Stage: "completed", RecordID: "demo-record-campus-walk"},
		{ID: "demo-node-campus-map", ProjectID: "demo-project-campus-route", OwnerHandle: "demo-zhao", Title: "发布可核对的无障碍路线图", Goal: "将实地路线与新生可读指引汇合成可复用的路线图。", Criteria: []string{"路线图中的关键点可回到实地记录核对。", "至少一位首次到访者能按图完成路线。"}, Evidence: "提交路线图、走读记录和反馈。", Claim: "发布路线图并完成首次到访者走读，已修正门禁描述。", Stage: "completed", RecordID: "demo-record-campus-map", ParentID: "demo-node-campus-walk"},
		{ID: "demo-node-food-observe", ProjectID: "demo-project-food-share", OwnerHandle: "demo-sun", Title: "梳理店铺交接的时间与责任边界", Goal: "明确剩余食物从店铺交出到领取者拿到之间需要被记录的时间、责任和安全信息。", Criteria: []string{"列出店铺、志愿者和领取者各自确认的事项。", "明确食物状态、领取时间窗口与未领取处理方式。"}, Evidence: "提交流程草图和一次店铺访谈记录。", Claim: "完成两家店铺访谈，整理了交接时间、食物状态和未领取处理的共同要求。", Stage: "completed", RecordID: "demo-record-food-observe"},
		{ID: "demo-node-food-handoff", ProjectID: "demo-project-food-share", OwnerHandle: "demo-sun", Title: "验证当日食物领取交接流程", Goal: "用一次真实试点验证店铺、志愿者和领取者能否按同一张交接单完成当日食物领取。", Criteria: []string{"交接单包含食物状态、领取截止时间和责任确认。", "至少一次真实交接可完整追溯。", "记录试点中出现的等待或信息遗漏。"}, Evidence: "提交交接单、时间记录和参与者反馈。", Stage: "frozen", ParentID: "demo-node-food-observe"},
		{ID: "demo-node-elder-reminder-draft", ProjectID: "demo-project-elder-reminder", OwnerHandle: "demo-qiao", Title: "完成活动提醒纸条初稿", Goal: "产出一份带日期、地点、预约确认与取消方式的活动提醒纸条初稿。", Criteria: []string{"关键时间、地点和联系信息有明确层级。", "每个字段能回到实际预约流程或障碍材料。"}, Evidence: "提交纸条初稿、字段来源和一次可读性检查记录。", Claim: "完成活动提醒纸条初稿，保留日期地点、确认电话和取消方式的独立填写区。", Stage: "completed", RecordID: "demo-record-elder-reminder-draft"},
		{ID: "demo-node-elder-reminder-test", ProjectID: "demo-project-elder-reminder", OwnerHandle: "demo-qiao", Title: "验证提醒纸条能否帮助老人准时到场", Goal: "让至少三位老人根据提醒纸条复述活动信息并说明遇到变化时如何处理。", Criteria: []string{"记录每位试用者对时间、地点和取消方式的理解。", "明确一处必须修改的表达或版式。"}, Evidence: "提交试用观察记录、纸条版本和改版说明。", Stage: "frozen", ParentID: "demo-node-elder-reminder-draft"},
		{ID: "demo-node-elder-activity-script", ProjectID: "demo-project-elder-activity-script", OwnerHandle: "demo-sun", Title: "整理活动日的志愿者提示语", Goal: "形成一组覆盖确认、改期和现场求助的志愿者提示语，并保留适用场景。", Criteria: []string{"至少覆盖确认、改期和现场求助三种场景。", "每条提示语标明来自的观察或访谈依据。"}, Evidence: "提交提示语清单、场景说明和来源摘录。", Claim: "完成九条志愿者提示语，覆盖预约确认、活动改期和现场求助，并标注对应服务场景。", Stage: "completed", RecordID: "demo-record-elder-activity-script"},
		{ID: "demo-node-campus-access-audit", ProjectID: "demo-project-campus-access-audit", OwnerHandle: "demo-chen", Title: "核查三个校园无障碍入口", Goal: "实地核查南门、图书馆主入口和门禁侧门的通行条件与协助需求。", Criteria: []string{"三个入口均记录位置、通行条件和观察时间。", "区分可独立通行与需要协助的情况。"}, Evidence: "提交入口照片、位置记录和核查表。", Claim: "完成三个入口核查，确认图书馆侧门在工作日午后需要志愿者协助开启。", Stage: "completed", RecordID: "demo-record-campus-access-audit"},
		{ID: "demo-node-campus-volunteer-brief", ProjectID: "demo-project-campus-volunteer-brief", OwnerHandle: "demo-lan", Title: "完成校园引导志愿者简报", Goal: "为首次到访者在门禁、坡道和电梯处提供可执行的志愿者协助交接说明。", Criteria: []string{"覆盖门禁、坡道和电梯三个关键位置。", "明确志愿者何时介入、何时只提供信息。"}, Evidence: "提交简报、场景对照表和一次志愿者走读反馈。", Claim: "完成一页志愿者简报，明确了门禁协助触发条件与坡道、电梯的说明方式。", Stage: "completed", RecordID: "demo-record-campus-volunteer-brief"},
		{ID: "demo-node-food-labels", ProjectID: "demo-project-food-labels", OwnerHandle: "demo-zhao", Title: "完成剩余食物领取标签初稿", Goal: "产出让店铺、志愿者和领取者都能核对的领取标签初稿。", Criteria: []string{"标签包含食物状态、领取时限、过敏原和交接确认。", "字段可在一次模拟交接中被三方理解。"}, Evidence: "提交标签初稿、模拟交接记录和字段说明。", Claim: "完成领取标签初稿，包含食物状态、领取截止时间、过敏原提示和三方确认栏。", Stage: "completed", RecordID: "demo-record-food-labels"},
		{ID: "demo-node-food-volunteer-shift", ProjectID: "demo-project-food-volunteer-shift", OwnerHandle: "demo-qiao", Title: "整理志愿者换班交接记录", Goal: "形成一份能保留领取进度、异常情况和责任人的换班交接记录。", Criteria: []string{"记录当前领取进度、待处理异常和接手人。", "至少一次模拟换班能追溯未完成事项。"}, Evidence: "提交交接记录模板和模拟换班记录。", Claim: "完成志愿者换班记录模板，并用一次模拟换班验证了未领取食物的责任交接。", Stage: "completed", RecordID: "demo-record-food-volunteer-shift"},
		{ID: "demo-node-community-handoff", ProjectID: "demo-project-community-handoff", OwnerHandle: "demo-chen", Title: "收束社区服务交接清单", Goal: "组合预约与食物领取的来源成果，形成包含交接责任、时间窗口和求助入口的社区服务清单。", Criteria: []string{"每一项清单都链接到一个已验收来源成果。", "区分预约服务与食物领取场景的适用边界。", "说明工作人员如何核对交接是否完成。"}, Evidence: "提交清单、来源映射与一次工作人员走读记录。", Stage: "frozen"},
	}
	for _, node := range nodes {
		if err := seedDemoNode(ctx, tx, node, userIDs[node.OwnerHandle], version, ruleHash); err != nil {
			return err
		}
	}
	for _, node := range nodes {
		if node.ParentID == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO execution_edges (id, source_contract_id, target_contract_id, type) VALUES (?, ?, ?, 'lineage') ON DUPLICATE KEY UPDATE type = VALUES(type)`, "demo-edge-"+node.ID, node.ParentID, node.ID); err != nil {
			return fmt.Errorf("upsert demo edge %s: %w", node.ID, err)
		}
	}

	if err := seedDemoCalls(ctx, tx, userIDs); err != nil {
		return err
	}
	return tx.Commit()
}

func seedDemoNode(ctx context.Context, tx *sql.Tx, node demoNode, ownerID uint64, version, ruleHash string) error {
	criteria, _ := json.Marshal(demoCriteria(node.Criteria))
	draftReview, _ := json.Marshal(map[string]any{"id": "demo-draft-review-" + node.ID, "verdict": "pass", "summary": "演示节点草案已通过审核。", "missingRequirements": []string{}, "createdAt": time.Now()})
	messages, _ := json.Marshal([]map[string]any{{"id": "demo-message-" + node.ID, "speaker": "ai", "body": "演示数据：节点目标、验收标准和证据要求已冻结。", "createdAt": time.Now()}})
	var completionID any
	var reviewJSON any
	if node.RecordID != "" {
		completionID = node.RecordID
		reviewJSON, _ = json.Marshal(map[string]any{"id": "demo-review-" + node.ID, "verdict": "pass", "summary": "演示数据：提交证据满足全部冻结标准。", "criterionReviews": []map[string]string{}, "createdAt": time.Now()})
	}
	sourceIDs, _ := json.Marshal([]string{})
	if node.ParentID != "" {
		sourceIDs, _ = json.Marshal([]string{node.ParentID})
	}
	revisionID := "demo-revision-" + node.ProjectID
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO execution_contracts (id, project_id, project_contract_revision_id, parent_contract_id, source_contract_ids_json, actor_id, title, stage, original_intent, smart_contract_id, smart_contract_version, rule_hash, verifiable_goal, acceptance_criteria_json, evidence_requirement, completion_claim, evidence_text, completion_record_id, draft_review_json, review_messages_json, ai_review_json)
		VALUES (?, ?, ?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE title = VALUES(title), stage = VALUES(stage), verifiable_goal = VALUES(verifiable_goal), acceptance_criteria_json = VALUES(acceptance_criteria_json), evidence_requirement = VALUES(evidence_requirement), completion_claim = VALUES(completion_claim), evidence_text = VALUES(evidence_text), completion_record_id = VALUES(completion_record_id), ai_review_json = VALUES(ai_review_json)`,
		node.ID, node.ProjectID, revisionID, node.ParentID, string(sourceIDs), ownerID, node.Title, node.Stage, "演示协作项目中的行动记录。", generalSmartContractID, version, ruleHash, node.Goal, string(criteria), node.Evidence, node.Claim, node.Evidence, completionID, string(draftReview), string(messages), reviewJSON); err != nil {
		return fmt.Errorf("upsert demo node %s: %w", node.ID, err)
	}
	if node.RecordID == "" {
		return nil
	}
	verdict, _ := json.Marshal(map[string]any{"result": "confirmed_complete", "note": "演示数据：维护者确认该成果可被继续使用。", "createdAt": time.Now()})
	covered, _ := json.Marshal([]string{node.ID})
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO completion_records (id, project_id, closing_contract_id, covered_contract_ids_json, title, summary, smart_contract_id, smart_contract_version, rule_hash, review_id, ai_review_verdict, record_kind, user_verdict_json)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pass', 'accepted', ?)
		ON DUPLICATE KEY UPDATE title = VALUES(title), summary = VALUES(summary), user_verdict_json = VALUES(user_verdict_json)`,
		node.RecordID, node.ProjectID, node.ID, string(covered), node.Title, "演示数据：这项成果已通过 AI 审查并由创建者确认，可作为其他行动的来源。", generalSmartContractID, version, ruleHash, "demo-review-"+node.ID, string(verdict)); err != nil {
		return fmt.Errorf("upsert demo record %s: %w", node.RecordID, err)
	}
	return nil
}

func demoCriteria(items []string) []map[string]string {
	criteria := make([]map[string]string, 0, len(items))
	for index, item := range items {
		criteria = append(criteria, map[string]string{"id": fmt.Sprintf("c%d", index+1), "text": item, "requiredEvidence": fmt.Sprintf("C%d：提交可直接核对这项标准的材料或观察记录。", index+1)})
	}
	return criteria
}

func seedDemoCalls(ctx context.Context, tx *sql.Tx, userIDs map[string]uint64) error {
	type callSpec struct {
		id, projectID, targetID, owner string
		title, status                  string
		submissions                    []struct{ id, recordID, contributor, mapping, status string }
	}
	calls := []callSpec{
		{id: "demo-call-elder-card", projectID: "demo-project-elder-appointments", targetID: "demo-node-elder-card-test", owner: "demo-lan", title: "补齐预约辅助卡的真实障碍与版式证据", status: "open", submissions: []struct{ id, recordID, contributor, mapping, status string }{
			{id: "demo-submission-elder-interviews", recordID: "demo-record-interview-summary", contributor: "demo-qiao", mapping: "访谈摘要对应 C1 的真实障碍来源，可用于核对老人实际卡住的步骤。", status: "submitted"},
			{id: "demo-submission-elder-card", recordID: "demo-record-card-design", contributor: "demo-chen", mapping: "辅助卡初稿对应 C1、C3，可作为试用版本和改版依据。", status: "submitted"},
		}},
		{id: "demo-call-campus-map", projectID: "demo-project-campus-route", targetID: "demo-node-campus-map", owner: "demo-zhao", title: "汇合入口核查与志愿者引导反馈", status: "adopted", submissions: []struct{ id, recordID, contributor, mapping, status string }{
			{id: "demo-submission-campus-audit", recordID: "demo-record-campus-access-audit", contributor: "demo-chen", mapping: "入口核查记录为路线图的门禁和通行条件提供现场依据。", status: "adopted"},
			{id: "demo-submission-campus-brief", recordID: "demo-record-campus-volunteer-brief", contributor: "demo-lan", mapping: "志愿者简报补足首次到访者在门禁与坡道处的实际协助信息。", status: "adopted"},
		}},
		{id: "demo-call-food-handoff", projectID: "demo-project-food-share", targetID: "demo-node-food-handoff", owner: "demo-sun", title: "补齐当日领取的交接单和时间窗口证据", status: "open", submissions: []struct{ id, recordID, contributor, mapping, status string }{
			{id: "demo-submission-food-labels", recordID: "demo-record-food-labels", contributor: "demo-zhao", mapping: "领取标签提供食物状态、时限和过敏原字段，可直接作为交接单的核对基础。", status: "submitted"},
			{id: "demo-submission-food-shift", recordID: "demo-record-food-volunteer-shift", contributor: "demo-qiao", mapping: "换班记录补足领取进度、异常和责任人交接，可用于追溯未领取事项。", status: "submitted"},
		}},
		{id: "demo-call-elder-reminder", projectID: "demo-project-elder-reminder", targetID: "demo-node-elder-reminder-test", owner: "demo-qiao", title: "补齐提醒纸条的真实服务语言", status: "open", submissions: []struct{ id, recordID, contributor, mapping, status string }{
			{id: "demo-submission-elder-script", recordID: "demo-record-elder-activity-script", contributor: "demo-sun", mapping: "活动日提示语提供确认、改期和求助的真实服务措辞，可核对提醒纸条的表达。", status: "submitted"},
		}},
		{id: "demo-call-community-handoff", projectID: "demo-project-community-handoff", targetID: "demo-node-community-handoff", owner: "demo-chen", title: "收集可复用的社区服务交接成果", status: "open", submissions: []struct{ id, recordID, contributor, mapping, status string }{
			{id: "demo-submission-community-interviews", recordID: "demo-record-interview-summary", contributor: "demo-qiao", mapping: "访谈摘要说明老人在哪些步骤需要明确的确认与求助入口。", status: "submitted"},
			{id: "demo-submission-community-food", recordID: "demo-record-food-observe", contributor: "demo-sun", mapping: "食物交接观察提供时间窗口、责任确认和异常处理的实际服务边界。", status: "submitted"},
		}},
	}
	// This was an early self-reference fixture. Remove it so the graph only shows
	// cross-project relationships that users could actually follow.
	if _, err := tx.ExecContext(ctx, `DELETE FROM collaboration_submissions WHERE id = 'demo-submission-campus-walk'`); err != nil {
		return fmt.Errorf("remove obsolete demo submission: %w", err)
	}
	for _, call := range calls {
		if _, err := tx.ExecContext(ctx, `INSERT INTO collaboration_calls (id, project_id, target_contract_id, created_by, title, status, max_submissions) VALUES (?, ?, ?, ?, ?, ?, 8) ON DUPLICATE KEY UPDATE title = VALUES(title), status = VALUES(status), max_submissions = VALUES(max_submissions)`, call.id, call.projectID, call.targetID, userIDs[call.owner], call.title, call.status); err != nil {
			return fmt.Errorf("upsert demo call %s: %w", call.id, err)
		}
		ids := make([]string, 0, len(call.submissions))
		for _, submission := range call.submissions {
			ids = append(ids, submission.id)
			if _, err := tx.ExecContext(ctx, `INSERT INTO collaboration_submissions (id, call_id, source_record_id, contributor_id, mapping_text, note, status) VALUES (?, ?, ?, ?, ?, '演示数据：来源成果由原作者保留，等待目标项目组合审查。', ?) ON DUPLICATE KEY UPDATE mapping_text = VALUES(mapping_text), status = VALUES(status)`, submission.id, call.id, submission.recordID, userIDs[submission.contributor], submission.mapping, submission.status); err != nil {
				return fmt.Errorf("upsert demo submission %s: %w", submission.id, err)
			}
		}
		if call.status != "adopted" {
			continue
		}
		batchIDs, _ := json.Marshal(ids)
		review, _ := json.Marshal(map[string]any{"id": "demo-batch-review-" + call.id, "verdict": "pass", "summary": "演示数据：来源成果共同满足目标节点的冻结标准。", "criterionReviews": []map[string]string{}, "createdAt": time.Now()})
		if _, err := tx.ExecContext(ctx, `INSERT INTO collaboration_review_batches (id, call_id, project_id, target_contract_id, created_by, submission_ids_json, ai_review_json, status, adopted_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'adopted', NOW()) ON DUPLICATE KEY UPDATE ai_review_json = VALUES(ai_review_json), status = 'adopted', adopted_at = NOW()`, "demo-batch-"+call.id, call.id, call.projectID, call.targetID, userIDs[call.owner], string(batchIDs), string(review)); err != nil {
			return fmt.Errorf("upsert demo review batch %s: %w", call.id, err)
		}
	}
	// Contribution workspaces keep an origin snapshot. It lets an in-progress
	// contribution remain readable even when its original public call is closed.
	snapshot, _ := json.Marshal(contributionOriginResponse{
		CallID: "demo-call-elder-card", ProjectID: "demo-project-elder-appointments", ProjectTitle: "让社区老人能独立预约活动", CallTitle: "补齐预约辅助卡的真实障碍与版式证据", Status: "open", TargetTitle: "验证大字号预约辅助卡能否独立使用",
		VerifiableGoal: "用真实老人试用大字号预约辅助卡，确认它是否能减少预约过程中的求助步骤。",
		AcceptanceCriteria: []reviewCriterionRequest{
			{ID: "c1", Text: "至少三位老人能在不解释流程的情况下完成填写。", RequiredEvidence: "C1：提交每位试用者的填写观察记录。"},
			{ID: "c2", Text: "记录每位试用者卡住的位置与完成耗时。", RequiredEvidence: "C2：提交步骤与耗时对照表。"},
			{ID: "c3", Text: "根据试用结果明确下一轮必须修改的一项内容。", RequiredEvidence: "C3：提交辅助卡版本与修改说明。"},
		},
		EvidenceRequirement: "提交试用观察记录、辅助卡版本与修改说明。",
		AvailableSources:    []contributionOriginSource{{Title: "完成大字号预约辅助卡初稿", ProjectTitle: "大字号预约辅助卡", MappingText: "辅助卡初稿对应 C1、C3，可作为试用版本和改版依据。", Status: "submitted"}},
	})
	if _, err := tx.ExecContext(ctx, `UPDATE projects SET contribution_origin_snapshot_json = ? WHERE id = 'demo-project-elder-interviews'`, string(snapshot)); err != nil {
		return fmt.Errorf("save demo contribution snapshot: %w", err)
	}
	return nil
}
