// Package publicprofile contains GORM read projections for public user profiles.
package publicprofile

import (
	"context"
	"errors"
	"fmt"

	applicationpublicprofile "github.com/singaurora/exec-graph/backend/internal/application/publicprofile"
	"gorm.io/gorm"
)

// Repository 只执行公开个人主页所需的跨表读取。
type Repository struct{ db *gorm.DB }

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// Load 读取一个用户的公开资料、未归档公开项目和本人形成的已验收成果。
func (repository *Repository) Load(ctx context.Context, userID string) (applicationpublicprofile.User, []applicationpublicprofile.Project, []applicationpublicprofile.Completion, error) {
	var user struct {
		ID                    uint64 `gorm:"column:id"`
		Username              string
		UserID                string `gorm:"column:user_id"`
		Bio                   string
		Gender                string
		AvatarObjectKey       string `gorm:"column:avatar_object_key"`
		ProfileBackgroundKey  string `gorm:"column:profile_background_key"`
		CustomProfileEnabled  bool   `gorm:"column:custom_profile_enabled"`
		CustomProfileMarkdown string `gorm:"column:custom_profile_markdown"`
	}
	err := repository.db.WithContext(ctx).Table("users").
		Select("id, username, user_id, COALESCE(bio, '') AS bio, COALESCE(gender, '') AS gender, COALESCE(avatar_url, '') AS avatar_object_key, COALESCE(profile_background_url, '') AS profile_background_key, custom_profile_enabled, COALESCE(custom_profile_markdown, '') AS custom_profile_markdown").
		Where("user_id = ?", userID).Take(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return applicationpublicprofile.User{}, nil, nil, applicationpublicprofile.ErrNotFound
	}
	if err != nil {
		return applicationpublicprofile.User{}, nil, nil, fmt.Errorf("load public profile user: %w", err)
	}

	projects := make([]applicationpublicprofile.Project, 0)
	err = repository.db.WithContext(ctx).Table("projects AS p").
		Select("p.uuid, p.title, p.description, (SELECT COUNT(*) FROM execution_contracts AS n WHERE n.project_id = p.id) AS node_count, (SELECT COUNT(*) FROM completion_records AS r WHERE r.project_id = p.id AND r.record_kind = 'accepted') AS completion_count").
		Where("p.owner_id = ? AND p.visibility = ? AND p.archived_at IS NULL", user.ID, "public").
		Order("p.updated_at DESC").Scan(&projects).Error
	if err != nil {
		return applicationpublicprofile.User{}, nil, nil, fmt.Errorf("load public profile projects: %w", err)
	}

	records := make([]applicationpublicprofile.Completion, 0)
	err = repository.db.WithContext(ctx).Table("completion_records AS r").
		Select("r.uuid, p.uuid AS project_uuid, p.title AS project_title, r.title, r.summary, COALESCE(JSON_LENGTH(r.covered_contract_ids_json), 0) AS covered_contract_count, r.ai_review_verdict, r.created_at").
		Joins("JOIN projects AS p ON p.id = r.project_id").
		Joins("JOIN execution_contracts AS n ON n.id = r.closing_contract_id").
		Where("p.visibility = ? AND p.archived_at IS NULL AND n.actor_id = ? AND r.record_kind = ?", "public", user.ID, "accepted").
		Order("r.created_at DESC").Scan(&records).Error
	if err != nil {
		return applicationpublicprofile.User{}, nil, nil, fmt.Errorf("load public profile completions: %w", err)
	}

	return applicationpublicprofile.User{
		Username: user.Username, UserID: user.UserID, Bio: user.Bio, Gender: user.Gender,
		AvatarObjectKey: user.AvatarObjectKey, ProfileBackgroundKey: user.ProfileBackgroundKey,
		CustomProfileEnabled: user.CustomProfileEnabled, CustomProfileMarkdown: user.CustomProfileMarkdown,
	}, projects, records, nil
}
