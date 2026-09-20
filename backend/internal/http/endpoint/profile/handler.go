package profile

import (
	"context"
	"io"
	"net/http"
	"strings"

	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

type userProfileResponse struct {
	Username              string  `json:"username"`
	UserID                string  `json:"userId"`
	Email                 string  `json:"email"`
	Bio                   string  `json:"bio"`
	Gender                string  `json:"gender"`
	AvatarURL             *string `json:"avatarUrl,omitempty"`
	ProfileBackgroundURL  *string `json:"profileBackgroundUrl,omitempty"`
	CustomProfileEnabled  bool    `json:"customProfileEnabled"`
	CustomProfileMarkdown string  `json:"customProfileMarkdown"`
}

type updateUserProfileRequest struct {
	Username              string `json:"username"`
	UserID                string `json:"userId"`
	Bio                   string `json:"bio"`
	Gender                string `json:"gender"`
	CustomProfileEnabled  bool   `json:"customProfileEnabled"`
	CustomProfileMarkdown string `json:"customProfileMarkdown"`
}

// GetCurrentUserProfile 返回当前用户的公开资料和主页设置。
func (h *Handler) GetCurrentUserProfile(w http.ResponseWriter, r *http.Request, user applicationidentity.User) error {
	profile, err := h.loadUserProfile(r.Context(), user.ID)
	if err != nil {
		return newHTTPError(http.StatusInternalServerError, "读取个人资料失败")
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": profile})
	return nil
}

// UpdateCurrentUserProfile 更新当前用户的公开资料和主页设置。
func (h *Handler) UpdateCurrentUserProfile(w http.ResponseWriter, r *http.Request, user applicationidentity.User) error {
	var request updateUserProfileRequest
	if err := bindJSON(r, &request); err != nil {
		return err
	}
	username := strings.TrimSpace(request.Username)
	userID, err := normalizeUserID(request.UserID)
	if len([]rune(username)) < 2 || len([]rune(username)) > 64 {
		return newHTTPError(http.StatusBadRequest, "用户名长度需要在 2 到 64 个字符之间")
	}
	if err != nil {
		return newHTTPError(http.StatusBadRequest, err.Error())
	}
	bio := strings.TrimSpace(request.Bio)
	if len([]rune(bio)) > 120 {
		return newHTTPError(http.StatusBadRequest, "个人说明最多 120 个字符")
	}
	customProfileMarkdown := strings.TrimSpace(request.CustomProfileMarkdown)
	if len([]rune(customProfileMarkdown)) > 20000 {
		return newHTTPError(http.StatusBadRequest, "自定义主页最多 20000 个字符")
	}
	if request.Gender != "female" && request.Gender != "male" && request.Gender != "undisclosed" {
		return newHTTPError(http.StatusBadRequest, "性别选项不正确")
	}

	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	err = h.identity.UpdateProfile(ctx, user.ID, applicationidentity.UpdateProfileInput{Username: username, UserID: userID, Bio: bio, Gender: request.Gender, CustomProfileEnabled: request.CustomProfileEnabled, CustomProfileMarkdown: customProfileMarkdown})
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return newHTTPError(http.StatusConflict, "该用户 ID 已被使用")
		}
		return newHTTPError(http.StatusInternalServerError, "保存个人资料失败")
	}
	profile, err := h.loadUserProfile(ctx, user.ID)
	if err != nil {
		return newHTTPError(http.StatusInternalServerError, "读取个人资料失败")
	}
	if err := h.cacheSession(r.Context(), bearerToken(r), applicationidentity.User{ID: user.ID, Username: profile.Username, UserID: profile.UserID, Email: user.Email}); err != nil {
		return newHTTPError(http.StatusServiceUnavailable, "个人资料已保存，但 Redis 登录会话暂时不可用，请稍后重试")
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": profile})
	return nil
}

// UploadCurrentUserAvatar 上传并替换当前用户头像。
func (h *Handler) UploadCurrentUserAvatar(w http.ResponseWriter, r *http.Request, user applicationidentity.User) error {
	return h.uploadAvatar(w, r, user)
}

// UploadCurrentUserProfileBackground 上传并替换当前用户主页背景图。
func (h *Handler) UploadCurrentUserProfileBackground(w http.ResponseWriter, r *http.Request, user applicationidentity.User) error {
	return h.uploadProfileBackground(w, r, user)
}

func (h *Handler) uploadAvatar(w http.ResponseWriter, r *http.Request, user applicationidentity.User) error {
	r.Body = http.MaxBytesReader(w, r.Body, sharedconstants.AvatarRequestBodyBytes)
	if err := r.ParseMultipartForm(sharedconstants.AvatarRequestBodyBytes); err != nil {
		return newHTTPError(http.StatusBadRequest, "头像文件不能超过 2 MB")
	}
	file, _, err := r.FormFile("avatar")
	if err != nil {
		return newHTTPError(http.StatusBadRequest, "请选择头像文件")
	}
	defer file.Close()
	contents, err := io.ReadAll(io.LimitReader(file, sharedconstants.AvatarUploadBytes+1))
	if err != nil {
		return newHTTPError(http.StatusBadRequest, "读取头像文件失败")
	}
	if len(contents) == 0 || len(contents) > sharedconstants.AvatarUploadBytes {
		return newHTTPError(http.StatusBadRequest, "头像文件不能超过 2 MB")
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ProfileMediaTimeout)
	defer cancel()
	result, err := h.identity.UploadAvatar(ctx, user.ID, contents)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusCreated, map[string]string{"avatarUrl": result.URL})
	return nil
}

func (h *Handler) uploadProfileBackground(w http.ResponseWriter, r *http.Request, user applicationidentity.User) error {
	r.Body = http.MaxBytesReader(w, r.Body, sharedconstants.ProfileBackgroundRequestBodyBytes)
	if err := r.ParseMultipartForm(sharedconstants.ProfileBackgroundRequestBodyBytes); err != nil {
		return newHTTPError(http.StatusBadRequest, "背景图片不能超过 2 MB")
	}
	file, _, err := r.FormFile("background")
	if err != nil {
		return newHTTPError(http.StatusBadRequest, "请选择背景图片")
	}
	defer file.Close()
	contents, err := io.ReadAll(io.LimitReader(file, sharedconstants.ProfileBackgroundUploadBytes+1))
	if err != nil {
		return newHTTPError(http.StatusBadRequest, "读取背景图片失败")
	}
	if len(contents) == 0 || len(contents) > sharedconstants.ProfileBackgroundUploadBytes {
		return newHTTPError(http.StatusBadRequest, "背景图片不能超过 2 MB")
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ProfileMediaTimeout)
	defer cancel()
	result, err := h.identity.UploadProfileBackground(ctx, user.ID, contents)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusCreated, map[string]string{"profileBackgroundUrl": result.URL})
	return nil
}

func (h *Handler) loadUserProfile(requestContext context.Context, userID uint64) (userProfileResponse, error) {
	ctx, cancel := context.WithTimeout(requestContext, sharedconstants.ProfileMediaTimeout)
	defer cancel()
	stored, err := h.identity.GetProfile(ctx, userID)
	if err != nil {
		return userProfileResponse{}, err
	}
	return userProfileResponse{
		Username: stored.Username, UserID: stored.UserID, Email: stored.Email, Bio: stored.Bio,
		Gender: stored.Gender, AvatarURL: stored.AvatarURL, ProfileBackgroundURL: stored.ProfileBackgroundURL,
		CustomProfileEnabled: stored.CustomProfileEnabled, CustomProfileMarkdown: stored.CustomProfileMarkdown,
	}, nil
}
