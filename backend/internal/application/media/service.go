package media

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// Service 协调资产登记与网络存储；网络调用始终在数据库事务之外。
type Service struct {
	store   Store
	objects Objects
	limits  Limits
}

// New 注入生命周期仓储和对象存储。
func New(store Store, objects Objects, limits Limits) *Service {
	return &Service{store, objects, limits}
}

// Upload 先登记 pending，再上传，最后标记 ready；任何中断仍保留可回收的对象键。
func (s *Service) Upload(ctx context.Context, actor identity.Actor, body []byte) (AssetView, error) {
	asset, format, err := inspect(body)
	if err != nil {
		return AssetView{}, err
	}
	asset.AssetID = id.New()
	asset.URL = "/api/commands/media/file?assetId=" + asset.AssetID
	asset.RetainUntil = time.Now().UTC().Add(constants.UnusedMediaRetention)
	asset.ObjectKey, err = s.objects.Key(asset.AssetID, format)
	if err != nil {
		return AssetView{}, err
	}
	if err := s.store.Reserve(ctx, actor, asset, s.limits); err != nil {
		return AssetView{}, err
	}
	if err := s.objects.Put(ctx, asset.ObjectKey, asset.MIMEType, body); err != nil {
		return AssetView{}, fmt.Errorf("上传图片到对象存储失败: %w", err)
	}
	if err := s.store.Complete(ctx, actor, asset.AssetID); err != nil {
		return AssetView{}, err
	}
	return asset.AssetView, nil
}

// Retain 校验归属后对草稿配图续期，不接受客户端指定任意保留时间。
func (s *Service) Retain(ctx context.Context, actor identity.Actor, input RetainInput) (RetentionView, error) {
	out := RetentionView{AssetIDs: input.AssetIDs, RetainUntil: time.Now().UTC().Add(constants.DraftMediaRetention)}
	if input.AssetIDs == nil || len(input.AssetIDs) > constants.ActionImageLimit {
		return out, fault.New(fault.Invalid, "请提交最多十二张草稿图片")
	}
	seen := map[string]bool{}
	for _, uuid := range input.AssetIDs {
		if !id.Valid(uuid) || seen[uuid] {
			return out, fault.New(fault.Invalid, "图片标识不合法或重复")
		}
		seen[uuid] = true
	}
	return out, s.store.Retain(ctx, actor, input.AssetIDs, out.RetainUntil)
}

// File 未保存的图片只允许上传者读取；被公开内容引用后允许公开读取。
func (s *Service) File(ctx context.Context, uuid, viewer string) ([]byte, string, error) {
	if !id.Valid(uuid) {
		return nil, "", fault.New(fault.Invalid, "图片标识不合法")
	}
	file, err := s.store.File(ctx, uuid)
	if err != nil {
		return nil, "", err
	}
	if !file.Public && file.OwnerID != viewer {
		return nil, "", fault.New(fault.NotFound, "图片不存在")
	}
	body, err := s.objects.Read(ctx, file.ObjectKey)
	return body, file.MIMEType, err
}

// Prune 认领后执行可重复的云端删除，成功才标记 deleted；失败或进程退出后仍可重试。
func (s *Service) Prune(ctx context.Context, now time.Time) (CleanupReport, error) {
	var report CleanupReport
	ids, err := s.store.Candidates(ctx, now)
	if err != nil {
		return report, err
	}
	var failures []error
	for _, uuid := range ids {
		if err := ctx.Err(); err != nil {
			return report, errors.Join(append(failures, err)...)
		}
		report.Scanned++
		target, err := s.store.Claim(ctx, uuid, now)
		if err == nil && target == nil {
			continue
		}
		if err == nil {
			err = s.objects.Delete(ctx, target.ObjectKey)
		}
		if err == nil {
			err = s.store.FinishDelete(ctx, uuid, now)
		}
		if err != nil {
			report.Failed++
			failures = append(failures, fmt.Errorf("回收图片 %s: %w", uuid, err))
			continue
		}
		report.Deleted++
	}
	return report, errors.Join(failures...)
}
