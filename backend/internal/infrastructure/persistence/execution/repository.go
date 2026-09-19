// Package execution contains GORM persistence for execution nodes and their state.
package execution

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

// Repository owns execution-domain SQL and transactions. Callers never receive
// a database connection; they only use this domain persistence boundary.
type Repository struct {
	orm           *gorm.DB
	transactional bool
}

func NewRepository(orm *gorm.DB) *Repository { return &Repository{orm: orm} }

func (repository *Repository) Rows(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	if repository == nil || repository.orm == nil {
		return nil, fmt.Errorf("execution repository is not configured")
	}
	return repository.orm.WithContext(ctx).Raw(query, args...).Rows()
}

func (repository *Repository) Row(ctx context.Context, query string, args ...any) *sql.Row {
	return repository.orm.WithContext(ctx).Raw(query, args...).Row()
}

type Result struct {
	rowsAffected int64
	lastInsertID int64
}

func (result Result) RowsAffected() (int64, error) { return result.rowsAffected, nil }
func (result Result) LastInsertId() (int64, error) { return result.lastInsertID, nil }

func (repository *Repository) Execute(ctx context.Context, query string, args ...any) (Result, error) {
	if repository == nil || repository.orm == nil {
		return Result{}, fmt.Errorf("execution repository is not configured")
	}
	result := repository.orm.WithContext(ctx).Exec(query, args...)
	if result.Error != nil {
		return Result{}, result.Error
	}
	output := Result{rowsAffected: result.RowsAffected}
	if repository.transactional && strings.HasPrefix(strings.ToUpper(strings.TrimSpace(query)), "INSERT") {
		if err := repository.orm.WithContext(ctx).Raw("SELECT LAST_INSERT_ID()").Row().Scan(&output.lastInsertID); err != nil {
			return Result{}, err
		}
	}
	return output, nil
}

func (repository *Repository) Begin(ctx context.Context) (*Repository, error) {
	if repository == nil || repository.orm == nil {
		return nil, fmt.Errorf("execution repository is not configured")
	}
	tx := repository.orm.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	return &Repository{orm: tx, transactional: true}, nil
}

func (repository *Repository) Commit() error   { return repository.orm.Commit().Error }
func (repository *Repository) Rollback() error { return repository.orm.Rollback().Error }
