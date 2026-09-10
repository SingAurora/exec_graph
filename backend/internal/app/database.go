package app

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

func openDatabase(config DatabaseConfig) (*sql.DB, error) {
	dbConfig := mysql.Config{
		User:      config.User,
		Passwd:    config.Password,
		Net:       "tcp",
		Addr:      fmt.Sprintf("%s:%d", config.Host, config.Port),
		DBName:    config.Name,
		ParseTime: true,
		Params: map[string]string{
			"charset": config.Charset,
		},
	}
	db, err := sql.Open("mysql", dbConfig.FormatDSN())
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping mysql: %w", err)
	}
	return db, nil
}

func migrateDatabase(ctx context.Context, db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
			username VARCHAR(64) NOT NULL,
			user_id VARCHAR(24) NOT NULL,
			email VARCHAR(255) NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			email_verified_at DATETIME NULL,
			profile_background_url VARCHAR(512) NULL,
			custom_profile_enabled TINYINT(1) NOT NULL DEFAULT 0,
			custom_profile_markdown LONGTEXT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`ALTER TABLE users ADD COLUMN user_id VARCHAR(24) NULL AFTER username`,
		`UPDATE users SET user_id = CONCAT('user', id) WHERE user_id IS NULL OR user_id = ''`,
		`ALTER TABLE users MODIFY COLUMN user_id VARCHAR(24) NOT NULL`,
		`ALTER TABLE users ADD UNIQUE KEY uq_users_user_id (user_id)`,
		`ALTER TABLE users ADD COLUMN bio TEXT NULL`,
		`ALTER TABLE users ADD COLUMN gender VARCHAR(20) NULL`,
		`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NULL`,
		`ALTER TABLE users ADD COLUMN profile_background_url VARCHAR(512) NULL`,
		`ALTER TABLE users ADD COLUMN custom_profile_enabled TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE users ADD COLUMN custom_profile_markdown LONGTEXT NULL`,
		`ALTER TABLE users MODIFY COLUMN password_hash TEXT NOT NULL`,
		`CREATE TABLE IF NOT EXISTS email_verification_codes (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
			email VARCHAR(255) NOT NULL,
			purpose VARCHAR(32) NOT NULL,
			code_hash CHAR(64) NOT NULL,
			expires_at DATETIME NOT NULL,
			used_at DATETIME NULL,
			send_ip VARCHAR(64) NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_verification_lookup (email, purpose, used_at, expires_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`CREATE TABLE IF NOT EXISTS auth_sessions (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
			user_id BIGINT UNSIGNED NOT NULL,
			token_hash CHAR(64) NOT NULL UNIQUE,
			expires_at DATETIME NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_sessions_user (user_id),
			INDEX idx_sessions_expiry (expires_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`CREATE TABLE IF NOT EXISTS smart_contracts (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			name VARCHAR(120) NOT NULL,
			source VARCHAR(20) NOT NULL,
			version VARCHAR(32) NOT NULL,
			description TEXT NOT NULL,
			body LONGTEXT NOT NULL,
			created_by BIGINT UNSIGNED NULL,
			deleted_at DATETIME NULL,
			deleted_by BIGINT UNSIGNED NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_smart_contracts_owner (created_by),
			INDEX idx_smart_contracts_source (source)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`ALTER TABLE smart_contracts ADD COLUMN deleted_at DATETIME NULL AFTER created_by`,
		`ALTER TABLE smart_contracts ADD COLUMN deleted_by BIGINT UNSIGNED NULL AFTER deleted_at`,
		`CREATE TABLE IF NOT EXISTS smart_contract_events (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			contract_id VARCHAR(100) NOT NULL,
			actor_id BIGINT UNSIGNED NULL,
			event_type VARCHAR(32) NOT NULL,
			contract_snapshot_json LONGTEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_contract_events_contract (contract_id, created_at),
			INDEX idx_contract_events_actor (actor_id, created_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`CREATE TABLE IF NOT EXISTS projects (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			owner_id BIGINT UNSIGNED NOT NULL,
			title VARCHAR(160) NOT NULL,
			description TEXT NOT NULL,
			project_type VARCHAR(20) NOT NULL DEFAULT 'guided',
			project_rules LONGTEXT NULL,
			is_default TINYINT(1) NOT NULL DEFAULT 0,
			visibility VARCHAR(20) NOT NULL DEFAULT 'private',
			default_ai_key_id VARCHAR(100) NULL,
			current_contract_id VARCHAR(100) NULL,
			active_contract_revision_id VARCHAR(100) NULL,
			archived_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_projects_owner (owner_id, archived_at),
			INDEX idx_projects_visibility (visibility, archived_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`ALTER TABLE projects ADD COLUMN default_ai_key_id VARCHAR(100) NULL AFTER visibility`,
		`ALTER TABLE projects ADD COLUMN project_type VARCHAR(20) NOT NULL DEFAULT 'guided' AFTER description`,
		`ALTER TABLE projects ADD COLUMN project_rules LONGTEXT NULL AFTER project_type`,
		`UPDATE projects SET project_type = 'guided' WHERE project_type IS NULL OR project_type NOT IN ('guided', 'autonomous')`,
		`CREATE TABLE IF NOT EXISTS project_contract_revisions (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			project_id VARCHAR(100) NOT NULL,
			smart_contract_id VARCHAR(100) NOT NULL,
			smart_contract_version VARCHAR(32) NOT NULL,
			rule_hash VARCHAR(128) NOT NULL,
			reason VARCHAR(255) NOT NULL,
			smart_contract_name VARCHAR(120) NULL,
			smart_contract_description TEXT NULL,
			smart_contract_body LONGTEXT NULL,
			activated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_revisions_project (project_id, activated_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`ALTER TABLE project_contract_revisions ADD COLUMN smart_contract_name VARCHAR(120) NULL AFTER reason`,
		`ALTER TABLE project_contract_revisions ADD COLUMN smart_contract_description TEXT NULL AFTER smart_contract_name`,
		`ALTER TABLE project_contract_revisions ADD COLUMN smart_contract_body LONGTEXT NULL AFTER smart_contract_description`,
		`CREATE TABLE IF NOT EXISTS execution_branches (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			project_id VARCHAR(100) NOT NULL,
			title VARCHAR(160) NOT NULL,
			root_contract_id VARCHAR(100) NULL,
			forked_from_contract_id VARCHAR(100) NULL,
			head_contract_id VARCHAR(100) NULL,
			current_contract_id VARCHAR(100) NULL,
			created_by BIGINT UNSIGNED NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_branches_project (project_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`CREATE TABLE IF NOT EXISTS execution_contracts (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			project_id VARCHAR(100) NOT NULL,
			branch_id VARCHAR(100) NULL,
			project_contract_revision_id VARCHAR(100) NOT NULL,
			parent_contract_id VARCHAR(100) NULL,
			source_contract_ids_json LONGTEXT NULL,
			actor_id BIGINT UNSIGNED NULL,
			title VARCHAR(200) NOT NULL,
			stage VARCHAR(32) NOT NULL,
			original_intent TEXT NOT NULL,
			smart_contract_id VARCHAR(100) NOT NULL,
			smart_contract_version VARCHAR(32) NOT NULL,
			rule_hash VARCHAR(128) NOT NULL,
			verifiable_goal TEXT NOT NULL,
			acceptance_criteria_json LONGTEXT NOT NULL,
			evidence_requirement TEXT NOT NULL,
			completion_claim TEXT NULL,
			evidence_text TEXT NULL,
			completion_record_id VARCHAR(100) NULL,
			draft_review_json LONGTEXT NULL,
			draft_review_ai_config_json LONGTEXT NULL,
			review_messages_json LONGTEXT NOT NULL,
			ai_review_json LONGTEXT NULL,
			completion_review_ai_config_json LONGTEXT NULL,
			user_verdict_json LONGTEXT NULL,
			next_contract_title VARCHAR(200) NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_execution_project_stage (project_id, stage),
			INDEX idx_execution_parent (parent_contract_id),
			INDEX idx_execution_branch (branch_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`ALTER TABLE execution_contracts ADD COLUMN supplement_of_contract_id VARCHAR(100) NULL AFTER source_contract_ids_json`,
		`ALTER TABLE execution_contracts ADD COLUMN draft_review_ai_config_json LONGTEXT NULL AFTER draft_review_json`,
		`ALTER TABLE execution_contracts ADD COLUMN completion_review_ai_config_json LONGTEXT NULL AFTER ai_review_json`,
		`ALTER TABLE execution_contracts ADD COLUMN completion_review_rounds_json LONGTEXT NULL AFTER completion_review_ai_config_json`,
		`ALTER TABLE execution_contracts ADD COLUMN planning_conversation_id VARCHAR(100) NULL AFTER completion_review_rounds_json`,
		`ALTER TABLE execution_contracts ADD COLUMN completion_conversation_id VARCHAR(100) NULL AFTER planning_conversation_id`,
		`CREATE TABLE IF NOT EXISTS node_conversations (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			project_id VARCHAR(100) NOT NULL,
			node_id VARCHAR(100) NULL,
			owner_id BIGINT UNSIGNED NOT NULL,
			phase VARCHAR(20) NOT NULL,
			status VARCHAR(32) NOT NULL DEFAULT 'active',
			context_json LONGTEXT NOT NULL,
			current_draft_json LONGTEXT NULL,
			latest_review_json LONGTEXT NULL,
			ai_config_json LONGTEXT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_conversations_project (project_id, phase, updated_at),
			INDEX idx_conversations_node (node_id, phase)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`CREATE TABLE IF NOT EXISTS node_conversation_messages (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			conversation_id VARCHAR(100) NOT NULL,
			role VARCHAR(16) NOT NULL,
			body LONGTEXT NOT NULL,
			structured_payload_json LONGTEXT NULL,
			ai_config_json LONGTEXT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_conversation_messages (conversation_id, created_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`CREATE TABLE IF NOT EXISTS execution_edges (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			source_contract_id VARCHAR(100) NOT NULL,
			target_contract_id VARCHAR(100) NOT NULL,
			type VARCHAR(32) NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_edges_source (source_contract_id),
			INDEX idx_edges_target (target_contract_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`CREATE TABLE IF NOT EXISTS completion_records (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			project_id VARCHAR(100) NOT NULL,
			closing_contract_id VARCHAR(100) NOT NULL,
			covered_contract_ids_json LONGTEXT NOT NULL,
			title VARCHAR(200) NOT NULL,
			summary TEXT NOT NULL,
			smart_contract_id VARCHAR(100) NOT NULL,
			smart_contract_version VARCHAR(32) NOT NULL,
			rule_hash VARCHAR(128) NOT NULL,
			review_id VARCHAR(100) NOT NULL,
			ai_review_verdict VARCHAR(20) NOT NULL,
			record_kind VARCHAR(20) NOT NULL DEFAULT 'accepted',
			user_verdict_json LONGTEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_completion_project (project_id, created_at),
			INDEX idx_completion_closing (closing_contract_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`ALTER TABLE completion_records ADD COLUMN record_kind VARCHAR(20) NOT NULL DEFAULT 'accepted' AFTER ai_review_verdict`,
		`UPDATE completion_records SET record_kind = 'sealed' WHERE ai_review_verdict <> 'pass' AND record_kind = 'accepted'`,
		`UPDATE execution_contracts n JOIN completion_records r ON r.id = n.completion_record_id SET n.stage = 'sealed' WHERE r.record_kind = 'sealed' AND n.stage = 'completed'`,
		`CREATE TABLE IF NOT EXISTS ai_api_keys (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			user_id BIGINT UNSIGNED NOT NULL,
			provider VARCHAR(32) NOT NULL,
			label VARCHAR(120) NOT NULL,
			key_ciphertext TEXT NOT NULL,
			key_hint VARCHAR(24) NOT NULL,
			base_url VARCHAR(255) NOT NULL,
			model VARCHAR(120) NOT NULL,
			is_default TINYINT(1) NOT NULL DEFAULT 0,
			last_verified_at DATETIME NULL,
			last_used_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_ai_keys_user (user_id, created_at),
			INDEX idx_ai_keys_default (user_id, is_default)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`CREATE TABLE IF NOT EXISTS collaboration_calls (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			project_id VARCHAR(100) NOT NULL,
			target_contract_id VARCHAR(100) NOT NULL,
			created_by BIGINT UNSIGNED NOT NULL,
			title VARCHAR(200) NOT NULL,
			status VARCHAR(24) NOT NULL DEFAULT 'open',
			max_submissions INT NOT NULL DEFAULT 10,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_collaboration_calls_project (project_id, status),
			INDEX idx_collaboration_calls_target (target_contract_id, status)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`CREATE TABLE IF NOT EXISTS collaboration_submissions (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			call_id VARCHAR(100) NOT NULL,
			source_record_id VARCHAR(100) NOT NULL,
			contributor_id BIGINT UNSIGNED NOT NULL,
			mapping_text LONGTEXT NOT NULL,
			note TEXT NULL,
			status VARCHAR(24) NOT NULL DEFAULT 'submitted',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			UNIQUE KEY uq_collaboration_submission (call_id, source_record_id),
			INDEX idx_collaboration_submissions_call (call_id, status),
			INDEX idx_collaboration_submissions_contributor (contributor_id, status)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`CREATE TABLE IF NOT EXISTS collaboration_review_batches (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			call_id VARCHAR(100) NOT NULL,
			project_id VARCHAR(100) NOT NULL,
			target_contract_id VARCHAR(100) NOT NULL,
			created_by BIGINT UNSIGNED NOT NULL,
			submission_ids_json LONGTEXT NOT NULL,
			ai_review_json LONGTEXT NOT NULL,
			status VARCHAR(24) NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			adopted_at DATETIME NULL,
			INDEX idx_collaboration_batches_call (call_id, created_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
	}

	for _, statement := range statements {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			message := strings.ToLower(err.Error())
			if strings.HasPrefix(statement, "ALTER TABLE") && (strings.Contains(message, "duplicate column") || strings.Contains(message, "duplicate key name")) {
				continue
			}
			return fmt.Errorf("migrate database: %w", err)
		}
	}
	return nil
}
