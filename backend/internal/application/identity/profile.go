package identity

import (
	"context"
	"strings"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

// GetProfile 读取用户的公开个人资料和受控的媒体对象键。
func (s *Service) GetProfile(ctx context.Context, userID uint64) (Profile, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
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
	if stored.AvatarURL != nil {
		profile.AvatarObjectKey = *stored.AvatarURL
	}
	if stored.ProfileBackgroundURL != nil {
		profile.ProfileBackgroundKey = *stored.ProfileBackgroundURL
	}
	if stored.CustomProfileMarkdown != nil {
		profile.CustomProfileMarkdown = *stored.CustomProfileMarkdown
	}
	return profile, nil
}

// UpdateProfile 保存已经由 HTTP 层完成格式校验的个人资料。
func (s *Service) UpdateProfile(ctx context.Context, userID uint64, input UpdateProfileInput) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	return s.repository.UpdateUser(ctx, userID, map[string]any{
		"username":                strings.TrimSpace(input.Username),
		"user_id":                 strings.TrimSpace(input.UserID),
		"bio":                     strings.TrimSpace(input.Bio),
		"gender":                  input.Gender,
		"custom_profile_enabled":  input.CustomProfileEnabled,
		"custom_profile_markdown": strings.TrimSpace(input.CustomProfileMarkdown),
	})
}

// SetAvatarObjectKey 保存头像对象键。
func (s *Service) SetAvatarObjectKey(ctx context.Context, userID uint64, objectKey string) error {
	return s.updateMediaObjectKey(ctx, userID, "avatar_url", objectKey)
}

// SetProfileBackgroundObjectKey 保存个人背景图对象键。
func (s *Service) SetProfileBackgroundObjectKey(ctx context.Context, userID uint64, objectKey string) error {
	return s.updateMediaObjectKey(ctx, userID, "profile_background_url", objectKey)
}

func (s *Service) updateMediaObjectKey(ctx context.Context, userID uint64, column, objectKey string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.ProfileMediaTimeout)
	defer cancel()
	return s.repository.UpdateUser(ctx, userID, map[string]any{column: objectKey})
}
