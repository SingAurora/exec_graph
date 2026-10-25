// Package demoseed 通过 GORM 事务导入已校验的演示夹具。
package demoseed

import (
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/demoseed"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/storage/demomedia"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

//go:embed testdata/demo-v1.json
var fixtures embed.FS

// Load 解码构建时的明确夹具，不能作为接口失败时的回退。
func Load() (app.Dataset, string, error) {
	body, err := fixtures.ReadFile("testdata/demo-v1.json")
	if err != nil {
		return app.Dataset{}, "", err
	}
	var data app.Dataset
	if err := json.Unmarshal(body, &data); err != nil {
		return data, "", err
	}
	sum := sha256.Sum256(body)
	return data, hex.EncodeToString(sum[:]), nil
}

// Repository 持有显式导入使用的连接和演示文件读取器。
type Repository struct {
	db    *gorm.DB
	files demomedia.Files
}

// New 注入真实数据库，不在服务启动时自动导入。
func New(db *gorm.DB) *Repository { return &Repository{db: db} }

// Import 使用单个事务写入批次，重跑同一夹具返回未变更，内容变化拒绝覆盖。
func (r *Repository) Import(ctx context.Context, data app.Prepared) (bool, error) {
	changed := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing model.SeedImport
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("dataset = ?", data.Dataset).Take(&existing).Error
		if err == nil {
			if existing.SHA256 != data.Digest {
				return fmt.Errorf("同名演示批次内容已变化，请使用新版本导入，不覆盖现有业务")
			}
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := tx.Create(&model.SeedImport{Dataset: data.Dataset, SHA256: data.Digest, CreatedAt: time.Now().UTC()}).Error; err != nil {
			return err
		}
		if err := r.users(tx, data); err != nil {
			return err
		}
		if err := r.assets(ctx, tx, data); err != nil {
			return err
		}
		if err := r.graphs(tx, data); err != nil {
			return err
		}
		for _, node := range data.Nodes {
			if err := r.node(tx, node, data.Digest); err != nil {
				return fmt.Errorf("导入行动 #%d: %w", node.View.Number, err)
			}
		}
		for _, reference := range data.References {
			row := model.ActionReference{UUID: reference.UUID, GraphUUID: reference.GraphUUID, SourceNodeUUID: reference.SourceUUID, TargetNodeUUID: reference.TargetUUID, Kind: reference.Kind, SourceNodeVersion: 1, AgreementVersionUUID: reference.AgreementUUID, AgreementStatus: reference.Status, ExceptionReason: reference.Reason}
			var expression *string
			for _, n := range data.Nodes {
				if n.View.ID == reference.TargetUUID {
					row.CreatedAt = n.View.CreatedAt
				}
				if n.View.ID == reference.SourceUUID {
					expression = n.EffectiveExpressionUUID
				}
			}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
			var complies *uint8
			if reference.Status == "satisfied" || reference.Status == "exception" {
				value := uint8(0)
				if reference.Status == "satisfied" {
					value = 1
				}
				complies = &value
			}
			generationUUID := id.Demo("generation", reference.TargetUUID)
			if err := tx.Create(&model.GenerationSource{GraphUUID: reference.GraphUUID, GenerationUUID: generationUUID, SourceNodeUUID: reference.SourceUUID, SourceNodeVersion: 1, Kind: reference.Kind, SourceExpressionVersionUUID: expression, SourceAgreementVersionUUID: reference.AgreementUUID, Complies: complies, ExceptionReason: reference.Reason}).Error; err != nil {
				return err
			}
			if reference.Kind == "primary" {
				if err := tx.Model(&model.AIGeneration{}).Where("uuid = ?", generationUUID).Update("inherited_expression_version_uuid", expression).Error; err != nil {
					return err
				}
			}
		}
		for _, alias := range data.Aliases {
			if err := tx.Create(&model.LegacyAlias{Kind: alias.Kind, Alias: alias.Alias, ResourceUUID: alias.UUID, Dataset: data.Dataset}).Error; err != nil {
				return err
			}
		}
		for _, u := range data.Users {
			for i, uuid := range u.Highlights.ExpressionNodeIDs {
				if err := tx.Create(&model.ProfileHighlight{UserUUID: u.ID, NodeUUID: uuid, Position: uint8(i + 1), CreatedAt: time.Now().UTC()}).Error; err != nil {
					return err
				}
			}
		}
		owner := id.Demo("user", "jo")
		for _, uuid := range data.Following.UserIDs {
			if err := tx.Create(&model.UserFollow{FollowerUUID: owner, FollowedUserUUID: uuid}).Error; err != nil {
				return err
			}
		}
		for _, uuid := range data.Following.GraphIDs {
			if err := tx.Create(&model.GraphFollow{UserUUID: owner, GraphUUID: uuid}).Error; err != nil {
				return err
			}
		}
		changed = true
		return nil
	})
	return changed, err
}

func (r *Repository) users(tx *gorm.DB, data app.Prepared) error {
	now := time.Now().UTC()
	for _, u := range data.Users {
		row := model.User{UUID: u.ID, Name: u.Name, Gender: u.Gender, BiographyMarkdown: u.Bio, Version: 1, IsTestAccount: true, TestDataset: &data.Dataset, AvatarAssetUUID: assetUUID(u.Avatar), CreatedAt: now, UpdatedAt: now}
		if u.BackgroundImage != nil {
			row.CoverAssetUUID = assetUUID(*u.BackgroundImage)
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		credential := model.UserCredential{UserUUID: u.ID, Email: u.Email, PasswordHash: u.PasswordHash, EmailVerifiedAt: now, AuthVersion: 1, PasswordChangedAt: now, CreatedAt: now, UpdatedAt: now}
		if err := tx.Create(&credential).Error; err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) graphs(tx *gorm.DB, data app.Prepared) error {
	for _, g := range data.Graphs {
		next := uint32(1)
		for _, n := range data.Nodes {
			if n.View.GraphID == g.ID && n.View.Number >= next {
				next = n.View.Number + 1
			}
		}
		row := model.Graph{UUID: g.ID, OwnerUUID: g.OwnerID, Title: g.Title, Description: g.Description, ContextGuide: g.ContextGuide, NextNodeNumber: next, Version: 1, CreatedAt: g.CreatedAt, UpdatedAt: g.UpdatedAt}
		if g.Avatar != nil {
			row.AvatarAssetUUID = assetUUID(*g.Avatar)
		}
		if g.BackgroundImage != nil {
			row.CoverAssetUUID = assetUUID(*g.BackgroundImage)
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	}
	return nil
}
