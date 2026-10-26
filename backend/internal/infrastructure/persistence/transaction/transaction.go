// Package transaction 提供仓储共用的认证锁、资产检查及幂等记录访问。
package transaction

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/application/submission"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Scope 只在一次数据库事务内使用，账号来自可信会话。
type Scope struct {
	DB    *gorm.DB
	Actor identity.Actor
}

// Within 统一锁顺序为提交账号、凭据、图、对话；不同账号仍能并行。
func Within(ctx context.Context, db *gorm.DB, actor identity.Actor, run func(*Scope) error) error {
	err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user model.User
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uuid = ?", actor.UserID).Take(&user).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fault.New(fault.Unauthenticated, "账号已不可用")
		}
		if err != nil {
			return err
		}
		var credential model.UserCredential
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("user_uuid = ?", actor.UserID).Take(&credential).Error; err != nil {
			return err
		}
		if user.DisabledAt != nil || credential.AuthVersion != actor.AuthVersion {
			return fault.New(fault.Unauthenticated, "会话已失效，请重新登录")
		}
		return run(&Scope{DB: tx, Actor: actor})
	}, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err == nil {
		return nil
	}
	var known *fault.Error
	if errors.As(err, &known) {
		return err
	}
	return fmt.Errorf("业务写入事务失败: %w", err)
}

// Receipt 查询当前账号下已确认命令；暂不清理过期结果，保证不提前失去重放能力。
func (s *Scope) Receipt(command, key string) (*submission.Receipt, error) {
	var row model.IdempotencyRecord
	err := s.DB.Where("user_uuid = ? AND command = ? AND request_key = ?", s.Actor.UserID, command, key).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if row.Status != "succeeded" {
		return nil, fault.New(fault.Conflict, "此提交尚未完成，请稍后重试")
	}
	return &submission.Receipt{Digest: row.RequestSHA256, Response: row.ResponseJSON}, nil
}

// Record 只写成功结果，与业务写入共同提交或共同回滚。
func (s *Scope) Record(command, key string, receipt submission.Receipt, expires time.Time) error {
	status := uint16(200)
	return s.DB.Create(&model.IdempotencyRecord{UserUUID: s.Actor.UserID, Command: command, RequestKey: key, RequestSHA256: receipt.Digest, Status: "succeeded", ResponseHTTPStatus: &status, ResponseJSON: receipt.Response, CreatedAt: time.Now().UTC(), ExpiresAt: expires}).Error
}

// CheckAssets 仅接受当前账号拥有的已就绪站内资产；nil 表示主动移除。
func (s *Scope) CheckAssets(ids ...*string) error {
	for _, uuid := range ids {
		if uuid == nil {
			continue
		}
		if !id.Valid(*uuid) {
			return fault.New(fault.Invalid, "图片资源标识不合法")
		}
		var asset model.MediaAsset
		err := s.DB.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uuid = ? AND owner_uuid = ? AND status = ? AND deleted_at IS NULL", *uuid, s.Actor.UserID, "ready").Take(&asset).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fault.New(fault.Forbidden, "只能使用自己已上传的图片")
		}
		if err != nil {
			return err
		}
		var claimed int64
		if err := s.DB.Model(&model.MediaRetention{}).Where("asset_uuid = ? AND cleanup_started_at IS NOT NULL", *uuid).Count(&claimed).Error; err != nil {
			return err
		}
		if claimed != 0 {
			return fault.New(fault.Conflict, "图片已过期，请重新上传")
		}
	}
	return nil
}

// LockGraph 是所有图内写入共同使用的串行边界，防止删除、引用和文档更新竞态。
func (s *Scope) LockGraph(uuid string) (model.Graph, error) {
	var graph model.Graph
	err := s.DB.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uuid = ? AND deleted_at IS NULL", uuid).Take(&graph).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return graph, fault.New(fault.NotFound, "行动图不存在")
	}
	return graph, err
}
