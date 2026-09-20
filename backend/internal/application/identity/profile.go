package identity

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// GetProfile 读取用户的公开个人资料和受控的媒体对象键。
func (s *Service) GetProfile(ctx context.Context, userID uint64) (Profile, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.ProfileMediaTimeout)
	defer cancel()
	stored, err := s.repository.FindUserByID(ctx, userID)
	if err != nil {
		return Profile{}, err
	}
	profile := Profile{
		ID:                   stored.ID,
		Username:             stored.Username,
		UserID:               stored.UserID,
		Email:                stored.Email,
		CustomProfileEnabled: stored.CustomProfileEnabled,
	}
	if stored.Bio != nil {
		profile.Bio = *stored.Bio
	}
	if stored.Gender != nil {
		profile.Gender = *stored.Gender
	}
	if stored.AvatarObjectKey != nil {
		profile.AvatarObjectKey = *stored.AvatarObjectKey
	}
	if stored.ProfileBackgroundKey != nil {
		profile.ProfileBackgroundKey = *stored.ProfileBackgroundKey
	}
	if stored.CustomProfileMarkdown != nil {
		profile.CustomProfileMarkdown = *stored.CustomProfileMarkdown
	}
	if profile.AvatarObjectKey != "" && s.storage.IsManagedObjectKey(profile.AvatarObjectKey) {
		url, err := s.storage.SignedObjectURL(ctx, profile.AvatarObjectKey, sharedconstants.ProfileMediaURLTTL)
		if err != nil {
			return Profile{}, fmt.Errorf("sign avatar URL: %w", err)
		}
		profile.AvatarURL = &url
	}
	if profile.ProfileBackgroundKey != "" && s.storage.IsManagedObjectKey(profile.ProfileBackgroundKey) {
		url, err := s.storage.SignedObjectURL(ctx, profile.ProfileBackgroundKey, sharedconstants.ProfileMediaURLTTL)
		if err != nil {
			return Profile{}, fmt.Errorf("sign profile background URL: %w", err)
		}
		profile.ProfileBackgroundURL = &url
	}
	return profile, nil
}

// UpdateProfile 保存已经由 HTTP 层完成格式校验的个人资料。
func (s *Service) UpdateProfile(ctx context.Context, userID uint64, input UpdateProfileInput) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	return s.repository.UpdateProfile(ctx, userID, ProfileUpdateRecord{
		Username: strings.TrimSpace(input.Username), UserID: strings.TrimSpace(input.UserID),
		Bio: strings.TrimSpace(input.Bio), Gender: input.Gender,
		CustomProfileEnabled: input.CustomProfileEnabled, CustomProfileMarkdown: strings.TrimSpace(input.CustomProfileMarkdown),
	})
}

// SetAvatarObjectKey 保存头像对象键。
func (s *Service) SetAvatarObjectKey(ctx context.Context, userID uint64, objectKey string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.ProfileMediaTimeout)
	defer cancel()
	return s.repository.SetAvatarObjectKey(ctx, userID, objectKey)
}

// SetProfileBackgroundObjectKey 保存个人背景图对象键。
func (s *Service) SetProfileBackgroundObjectKey(ctx context.Context, userID uint64, objectKey string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.ProfileMediaTimeout)
	defer cancel()
	return s.repository.SetProfileBackgroundObjectKey(ctx, userID, objectKey)
}

// UploadAvatar 处理、上传并替换当前用户头像。
func (s *Service) UploadAvatar(ctx context.Context, userID uint64, contents []byte) (ProfileMediaResult, error) {
	processed, err := s.images.ProcessAvatar(contents)
	if err != nil {
		return ProfileMediaResult{}, fault.Wrap(fault.InvalidRequest, "头像处理失败，请更换一张 PNG、JPEG 或 WebP 图片", err)
	}
	return s.replaceProfileMedia(ctx, userID, "avatar", processed)
}

// UploadProfileBackground 处理、上传并替换当前用户主页背景图。
func (s *Service) UploadProfileBackground(ctx context.Context, userID uint64, contents []byte) (ProfileMediaResult, error) {
	processed, err := s.images.ProcessBackground(contents)
	if err != nil {
		return ProfileMediaResult{}, fault.Wrap(fault.InvalidRequest, "背景图片处理失败，请更换一张 PNG、JPEG 或 WebP 图片", err)
	}
	return s.replaceProfileMedia(ctx, userID, "background", processed)
}

func (s *Service) replaceProfileMedia(ctx context.Context, userID uint64, mediaType string, contents []byte) (ProfileMediaResult, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.ProfileMediaTimeout)
	defer cancel()
	stored, err := s.repository.FindUserByID(ctx, userID)
	if err != nil {
		return ProfileMediaResult{}, fault.Wrap(fault.Internal, "读取当前个人资料图片失败", err)
	}
	oldObjectKey := ""
	if mediaType == "avatar" && stored.AvatarObjectKey != nil {
		oldObjectKey = *stored.AvatarObjectKey
	}
	if mediaType == "background" && stored.ProfileBackgroundKey != nil {
		oldObjectKey = *stored.ProfileBackgroundKey
	}
	if !s.storage.IsManagedObjectKey(oldObjectKey) {
		oldObjectKey = ""
	}
	name, err := sharedid.Opaque(mediaType)
	if err != nil {
		return ProfileMediaResult{}, fault.Wrap(fault.Internal, "生成图片对象地址失败", err)
	}
	newObjectKey, err := s.storage.NewObjectKey(strconv.FormatUint(userID, 10), name+".jpg")
	if err != nil {
		return ProfileMediaResult{}, fault.Wrap(fault.Internal, "生成图片对象地址失败", err)
	}
	if err := s.storage.PutObject(ctx, newObjectKey, "image/jpeg", contents, "private, max-age=86400"); err != nil {
		return ProfileMediaResult{}, fault.Wrap(fault.UpstreamFailure, "图片上传失败，请稍后重试", err)
	}
	mediaURL, err := s.storage.SignedObjectURL(ctx, newObjectKey, sharedconstants.ProfileMediaURLTTL)
	if err != nil {
		cleanupErr := s.storage.DeleteObject(ctx, newObjectKey)
		return ProfileMediaResult{}, fault.Wrap(fault.UpstreamFailure, "图片上传失败，请稍后重试", errors.Join(err, cleanupErr))
	}
	if mediaType == "avatar" {
		err = s.repository.SetAvatarObjectKey(ctx, userID, newObjectKey)
	} else {
		err = s.repository.SetProfileBackgroundObjectKey(ctx, userID, newObjectKey)
	}
	if err != nil {
		cleanupErr := s.storage.DeleteObject(ctx, newObjectKey)
		return ProfileMediaResult{}, fault.Wrap(fault.Internal, "保存个人资料图片失败", errors.Join(err, cleanupErr))
	}
	if oldObjectKey != "" && oldObjectKey != newObjectKey {
		if err := s.storage.DeleteObject(ctx, oldObjectKey); err != nil {
			slog.Error("delete previous profile media failed", "user_id", userID, "media_type", mediaType, "error", err)
		}
	}
	return ProfileMediaResult{URL: mediaURL}, nil
}
