package app

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

const generalSmartContractID = "smart-contract-general"
const quickActionSmartContractID = "smart-contract-quick-action"
const dailyRoutineSmartContractID = "smart-contract-daily-routine"

const generalSmartContractBody = `## 部署规则

- 必须写明可验证目标
- 必须至少列出两条验收标准
- 必须说明每条标准所需的证据

## AI 审查原则

只判断用户提交的完成说明和证据是否满足冻结的验收标准，不临时提高标准。`

const quickActionSmartContractBody = `## 适用范围

适合洗澡、刷牙、铺床等一次性的小行动。

## 部署规则

- 只定义一个当下可以完成的具体动作
- 用 2 到 5 个可观察的检查项说明做到什么算完成
- 允许完成、部分完成和未完成，不要求照片或复杂材料

## AI 审查原则

检查用户是否说明了各项实际完成情况。只指出缺少的事实，不把部分完成写成全部完成，也不因一次未完成评价用户的人格。`

const dailyRoutineSmartContractBody = `## 适用范围

适合每天或每周重复的生活行动，例如每天洗澡、刷牙或整理床铺。

## 部署规则

- 明确行动频率和本次要完成的具体实例
- 每次记录实际完成情况，可标记完成、部分完成、未完成或受阻
- 记录足以说明当次完成状态的简短事实，不要求复杂证据

## AI 审查原则

关注频率、连续性和实际阻碍，帮助用户决定下一次最小行动。周期性总结执行状态，但不把中断归因于人格，也不替用户补写未发生的事实。`

type officialSmartContract struct {
	id          string
	name        string
	description string
	body        string
}

var officialSmartContracts = []officialSmartContract{
	{generalSmartContractID, "正式项目规则", "适合长期目标、复杂工作和多人协作；要求冻结目标、验收标准与可核验证据。", generalSmartContractBody},
	{quickActionSmartContractID, "快速行动规则", "适合洗澡、刷牙、铺床等一次性小事，用少量可观察检查项确认当下是否做到。", quickActionSmartContractBody},
	{dailyRoutineSmartContractID, "日常习惯规则", "适合每天或每周重复的行动，记录每次实例、连续性与真实阻碍。", dailyRoutineSmartContractBody},
}

func seedSystemData(ctx context.Context, db *sql.DB) error {
	for _, contract := range officialSmartContracts {
		if _, err := db.ExecContext(ctx, `
			INSERT INTO smart_contracts
				(id, name, source, version, description, body, created_by, deleted_at, deleted_by)
			VALUES (?, ?, 'official', '1.0.0', ?, ?, NULL, NULL, NULL)
			ON DUPLICATE KEY UPDATE
				name = VALUES(name), source = 'official', version = VALUES(version),
				description = VALUES(description), body = VALUES(body),
				created_by = NULL, deleted_at = NULL, deleted_by = NULL`,
			contract.id, contract.name, contract.description, contract.body); err != nil {
			return fmt.Errorf("seed system smart contract %s: %w", contract.id, err)
		}
	}
	return nil
}

// seedDevelopmentTestAccount makes local browser testing use the same
// authenticated path as a registered user, including a real initial project.
func seedDevelopmentTestAccount(ctx context.Context, db *sql.DB, account TestAccountConfig) error {
	if !account.Enabled {
		return nil
	}
	username := strings.TrimSpace(account.Username)
	email, err := normalizeEmail(account.Email)
	if err != nil {
		return fmt.Errorf("test account email: %w", err)
	}
	if len([]rune(username)) < 2 || len([]rune(username)) > 64 {
		return fmt.Errorf("test account username must contain 2 to 64 characters")
	}
	if len(account.Password) < 6 {
		return fmt.Errorf("test account password must contain at least 6 characters")
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO users (username, user_id, is_test_account, email, password_hash, email_verified_at)
		VALUES (?, 'execgraph_test', 1, ?, ?, NOW())
		ON DUPLICATE KEY UPDATE
			username = VALUES(username),
			is_test_account = 1,
			password_hash = VALUES(password_hash),
			email_verified_at = COALESCE(email_verified_at, VALUES(email_verified_at))`, username, email, account.Password); err != nil {
		return fmt.Errorf("upsert test account: %w", err)
	}
	var userID uint64
	if err := tx.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, email).Scan(&userID); err != nil {
		return fmt.Errorf("load test account: %w", err)
	}
	if err := ensureInitialProjectTx(ctx, tx, userID); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}

func ensureInitialProjectTx(ctx context.Context, tx *sql.Tx, userID uint64) error {
	var exists bool
	if err := tx.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM projects WHERE owner_id = ?
		)`, userID).Scan(&exists); err != nil {
		return fmt.Errorf("check initial project: %w", err)
	}
	if exists {
		return nil
	}

	var smartContractVersion string
	if err := tx.QueryRowContext(ctx, `SELECT version FROM smart_contracts WHERE id = ?`, generalSmartContractID).Scan(&smartContractVersion); err != nil {
		return fmt.Errorf("load default smart contract: %w", err)
	}
	projectID := fmt.Sprintf("project-initial-%d", userID)
	revisionID := fmt.Sprintf("project-initial-revision-%d", userID)
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO projects
			(id, owner_id, title, description, project_type, project_rules, is_default, visibility, active_contract_revision_id)
		VALUES (?, ?, '我的执行', '用于开始和整理你的行动。', 'guided', '每次只推进一个明确行动；所有完成结果必须有可核验的证据。', 0, 'private', ?)`,
		projectID, userID, revisionID); err != nil {
		return fmt.Errorf("create initial project: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO project_contract_revisions
			(id, project_id, smart_contract_id, smart_contract_version, reason)
		VALUES (?, ?, ?, ?, '项目创建时的基础审查规则')`,
		revisionID, projectID, generalSmartContractID, smartContractVersion); err != nil {
		return fmt.Errorf("create initial project contract revision: %w", err)
	}
	return nil
}
