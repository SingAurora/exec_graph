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
			email VARCHAR(255) NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			email_verified_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`ALTER TABLE users ADD COLUMN bio TEXT NULL`,
		`ALTER TABLE users ADD COLUMN gender VARCHAR(20) NULL`,
		`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NULL`,
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
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_smart_contracts_owner (created_by),
			INDEX idx_smart_contracts_source (source)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`CREATE TABLE IF NOT EXISTS projects (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			owner_id BIGINT UNSIGNED NOT NULL,
			title VARCHAR(160) NOT NULL,
			description TEXT NOT NULL,
			is_default TINYINT(1) NOT NULL DEFAULT 0,
			visibility VARCHAR(20) NOT NULL DEFAULT 'private',
			current_contract_id VARCHAR(100) NULL,
			active_contract_revision_id VARCHAR(100) NULL,
			archived_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_projects_owner (owner_id, archived_at),
			INDEX idx_projects_visibility (visibility, archived_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
		`CREATE TABLE IF NOT EXISTS project_contract_revisions (
			id VARCHAR(100) NOT NULL PRIMARY KEY,
			project_id VARCHAR(100) NOT NULL,
			smart_contract_id VARCHAR(100) NOT NULL,
			smart_contract_version VARCHAR(32) NOT NULL,
			rule_hash VARCHAR(128) NOT NULL,
			reason VARCHAR(255) NOT NULL,
			activated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_revisions_project (project_id, activated_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
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
			review_messages_json LONGTEXT NOT NULL,
			ai_review_json LONGTEXT NULL,
			user_verdict_json LONGTEXT NULL,
			next_contract_title VARCHAR(200) NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_execution_project_stage (project_id, stage),
			INDEX idx_execution_parent (parent_contract_id),
			INDEX idx_execution_branch (branch_id)
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
			user_verdict_json LONGTEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_completion_project (project_id, created_at),
			INDEX idx_completion_closing (closing_contract_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
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
	}

	for _, statement := range statements {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			if strings.HasPrefix(statement, "ALTER TABLE users ADD COLUMN") && strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
				continue
			}
			return fmt.Errorf("migrate database: %w", err)
		}
	}
	return nil
}
