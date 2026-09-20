package profile

import (
	"errors"
	"net/http"
	"strings"

	applicationpublicprofile "github.com/singaurora/exec-graph/backend/internal/application/publicprofile"
)

type publicUserResponse struct {
	Username              string `json:"username"`
	UserID                string `json:"userId"`
	Bio                   string `json:"bio"`
	Gender                string `json:"gender"`
	AvatarURL             string `json:"avatarUrl,omitempty"`
	ProfileBackgroundURL  string `json:"profileBackgroundUrl,omitempty"`
	CustomProfileEnabled  bool   `json:"customProfileEnabled"`
	CustomProfileMarkdown string `json:"customProfileMarkdown,omitempty"`
}

type publicProfileResponse struct {
	User       publicUserResponse                    `json:"user"`
	Projects   []applicationpublicprofile.Project    `json:"projects"`
	Records    []applicationpublicprofile.Completion `json:"records"`
	ActiveDays int                                   `json:"activeDays"`
}

// GetPublicUserProfile 按公开用户 ID 返回个人资料、公开项目和已验收成果。
func (h *Handler) GetPublicUserProfile(w http.ResponseWriter, r *http.Request) error {
	userID := strings.TrimSpace(r.URL.Query().Get("userId"))
	profile, err := h.publicProfile.GetPublicProfile(r.Context(), userID)
	if errors.Is(err, applicationpublicprofile.ErrInvalidUserID) {
		return newHTTPError(http.StatusBadRequest, "用户 ID 格式不正确")
	}
	if errors.Is(err, applicationpublicprofile.ErrNotFound) {
		return newHTTPError(http.StatusNotFound, "公开用户不存在")
	}
	if err != nil {
		return newHTTPError(http.StatusInternalServerError, "读取公开个人主页失败")
	}
	user := publicUserResponse{
		Username: profile.User.Username, UserID: profile.User.UserID, Bio: profile.User.Bio,
		Gender: profile.User.Gender, AvatarURL: profile.User.AvatarURL,
		ProfileBackgroundURL: profile.User.ProfileBackgroundURL, CustomProfileEnabled: profile.User.CustomProfileEnabled,
		CustomProfileMarkdown: profile.User.CustomProfileMarkdown,
	}
	writeJSON(w, http.StatusOK, publicProfileResponse{
		User: user, Projects: profile.Projects, Records: profile.Records, ActiveDays: profile.ActiveDays,
	})
	return nil
}
