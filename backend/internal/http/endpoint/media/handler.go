// Package media 适配图片上传、读取及草稿续期，不处理数据库或对象存储细节。
package media

import (
	"context"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	app "github.com/singaurora/exec-graph/backend/internal/application/media"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// Handler 接收已装配的资产与认证服务。
type Handler struct {
	service *app.Service
	auth    *identity.Service
}

// New 创建图片端点。
func New(service *app.Service, auth *identity.Service) *Handler { return &Handler{service, auth} }

// Upload 在读取文件前校验会话、CSRF，并限制完整 multipart 请求容量。
func (h *Handler) Upload(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), constants.HTTPRequestTimeout)
	defer cancel()
	actor, err := h.auth.Authorize(ctx, common.SessionToken(c), c.GetHeader("X-CSRF-Token"))
	if err != nil {
		common.Fail(c, err)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, constants.MaxImageBytes+constants.MultipartOverhead)
	if err := c.Request.ParseMultipartForm(constants.MaxImageBytes + constants.MultipartOverhead); err != nil {
		if c.Request.MultipartForm != nil {
			_ = c.Request.MultipartForm.RemoveAll()
		}
		common.Fail(c, fault.New(fault.Invalid, "请使用 multipart/form-data 上传不超过 8 MB 的图片"))
		return
	}
	form := c.Request.MultipartForm
	defer form.RemoveAll()
	if len(form.Value) != 0 || len(form.File) != 1 || len(form.File["file"]) != 1 {
		common.Fail(c, fault.New(fault.Invalid, "请只提交一个 file 图片文件"))
		return
	}
	file, err := form.File["file"][0].Open()
	if err != nil {
		common.Fail(c, fault.New(fault.Invalid, "无法读取上传文件"))
		return
	}
	defer file.Close()
	body, err := io.ReadAll(io.LimitReader(file, constants.MaxImageBytes+1))
	if err != nil {
		common.Fail(c, fault.New(fault.Invalid, "无法读取上传文件"))
		return
	}
	out, err := h.service.Upload(ctx, actor, body)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// Retain 是草稿显式续期入口，使用统一 JSON 和认证边界。
func (h *Handler) Retain(c *gin.Context) { common.Mutation(c, h.auth, h.service.Retain) }

// File 未保存资源只向上传者返回，已发布配图允许匿名读取；响应不套 JSON。
func (h *Handler) File(c *gin.Context) {
	uuid, err := common.Query(c, "assetId")
	if err != nil {
		common.Fail(c, err)
		return
	}
	viewer := ""
	if token := common.SessionToken(c); token != "" {
		session, err := h.auth.Session(c.Request.Context(), token)
		if err != nil {
			common.Fail(c, err)
			return
		}
		viewer = session.User.ID
	}
	body, mime, err := h.service.File(c.Request.Context(), uuid, viewer)
	if err != nil {
		common.Fail(c, err)
		return
	}
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Cache-Control", "private, no-store")
	c.Data(http.StatusOK, mime, body)
}
