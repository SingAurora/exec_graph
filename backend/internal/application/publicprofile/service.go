// Package publicprofile provides the public user-profile read use case.
package publicprofile

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

var publicUserIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{2,64}$`)

// Service 聚合一个用户可公开访问的资料、项目和成果。
type Service struct {
	repository Repository
	storage    ObjectURLSigner
}

// New 创建公开个人主页应用服务。
func New(dependencies Dependencies) *Service {
	return &Service{repository: dependencies.Repository, storage: dependencies.Storage}
}

// GetPublicProfile 按稳定用户 ID 读取公开主页。
func (s *Service) GetPublicProfile(ctx context.Context, userID string) (Profile, error) {
	userID = strings.TrimPrefix(strings.TrimSpace(userID), "@")
	if !publicUserIDPattern.MatchString(userID) {
		return Profile{}, ErrInvalidUserID
	}
	databaseContext, cancelDatabase := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	user, projects, records, err := s.repository.Load(databaseContext, userID)
	cancelDatabase()
	if err != nil {
		return Profile{}, err
	}
	mediaContext, cancelMedia := context.WithTimeout(ctx, sharedconstants.ProfileMediaTimeout)
	defer cancelMedia()
	if s.storage != nil && user.AvatarObjectKey != "" && s.storage.IsManagedObjectKey(user.AvatarObjectKey) {
		user.AvatarURL, err = s.storage.SignedObjectURL(mediaContext, user.AvatarObjectKey, sharedconstants.ProfileMediaURLTTL)
		if err != nil {
			return Profile{}, fmt.Errorf("sign public profile avatar URL: %w", err)
		}
	}
	if s.storage != nil && user.ProfileBackgroundKey != "" && s.storage.IsManagedObjectKey(user.ProfileBackgroundKey) {
		user.ProfileBackgroundURL, err = s.storage.SignedObjectURL(mediaContext, user.ProfileBackgroundKey, sharedconstants.ProfileMediaURLTTL)
		if err != nil {
			return Profile{}, fmt.Errorf("sign public profile background URL: %w", err)
		}
	}
	activeDates := make(map[string]struct{}, len(records))
	for _, record := range records {
		activeDates[record.CreatedAt.Format("2006-01-02")] = struct{}{}
	}
	return Profile{User: user, Projects: projects, Records: records, ActiveDays: len(activeDates)}, nil
}
