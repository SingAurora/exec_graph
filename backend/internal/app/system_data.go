package app

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

const generalSmartContractID = "smart-contract-general"

const generalSmartContractBody = `## 部署规则

- 必须写明可验证目标
- 必须至少列出两条验收标准
- 必须说明每条标准所需的证据

## AI 审查原则

只判断用户提交的完成说明和证据是否满足冻结的验收标准，不临时提高标准。`

func seedSystemData(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
		INSERT IGNORE INTO smart_contracts
			(id, name, source, version, description, body, created_by)
		VALUES (?, ?, 'official', '1.0.0', ?, ?, NULL)`,
		generalSmartContractID,
		"通用执行智能合约",
		"定义可部署目标的最低规则，并验证结果是否满足已冻结要求。",
		generalSmartContractBody,
	)
	if err != nil {
		return fmt.Errorf("seed system smart contract: %w", err)
	}
	return nil
}

// seedDevelopmentTestAccount makes local browser testing use the same
// authenticated path as a registered user, including a real default project.
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
	if err := ensureDefaultProjectTx(ctx, tx, userID); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}

func ensureDefaultProjectTx(ctx context.Context, tx *sql.Tx, userID uint64) error {
	var exists bool
	if err := tx.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM projects WHERE owner_id = ? AND is_default = 1
		)`, userID).Scan(&exists); err != nil {
		return fmt.Errorf("check default project: %w", err)
	}
	if exists {
		return nil
	}

	var smartContractVersion string
	if err := tx.QueryRowContext(ctx, `SELECT version FROM smart_contracts WHERE id = ?`, generalSmartContractID).Scan(&smartContractVersion); err != nil {
		return fmt.Errorf("load default smart contract: %w", err)
	}
	projectID := fmt.Sprintf("project-default-%d", userID)
	revisionID := fmt.Sprintf("project-default-revision-%d", userID)
	ruleHash := hashValue(generalSmartContractBody)
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO projects
			(id, owner_id, title, description, project_type, project_rules, is_default, visibility, active_contract_revision_id)
		VALUES (?, ?, '我的执行', '默认项目。任何还不需要单独归档的行动，都可以直接在这里开始。', 'guided', '每次只推进一个明确行动；所有完成结果必须有可核验的证据。', 1, 'private', ?)`,
		projectID, userID, revisionID); err != nil {
		return fmt.Errorf("create default project: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO project_contract_revisions
			(id, project_id, smart_contract_id, smart_contract_version, rule_hash, reason)
		VALUES (?, ?, ?, ?, ?, '平台默认智能合约')`,
		revisionID, projectID, generalSmartContractID, smartContractVersion, ruleHash); err != nil {
		return fmt.Errorf("create default project contract revision: %w", err)
	}
	return nil
}
