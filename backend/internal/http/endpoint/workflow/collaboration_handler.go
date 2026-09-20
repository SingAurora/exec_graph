package workflow

import (
	"context"
	"errors"
	"net/http"
	"strings"

	applicationcollaboration "github.com/singaurora/exec-graph/backend/internal/application/collaboration"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

type createCollaborationCallRequest struct {
	ProjectUUID        string `json:"projectUuid"`
	TargetContractUUID string `json:"targetContractUuid"`
	Title              string `json:"title"`
	MaxSubmissions     int    `json:"maxSubmissions"`
}

type createCollaborationSubmissionRequest struct {
	CallUUID         string `json:"callUuid"`
	SourceRecordUUID string `json:"sourceRecordUuid"`
	MappingText      string `json:"mappingText"`
	Note             string `json:"note"`
}

type createCollaborationReviewRequest struct {
	CallUUID        string   `json:"callUuid"`
	SubmissionUUIDs []string `json:"submissionUuids"`
}

type adoptReviewedContributionsRequest struct {
	BatchUUID string `json:"batchUuid"`
}

type getPublicProjectDetailQuery struct {
	ProjectUUID string
}

type getCollaborationCallDetailQuery struct {
	CallUUID string
}

// PublishCollaborationCall 将一个冻结执行节点的缺口发布为公开协作征集。
func (h *Handler) PublishCollaborationCall(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input createCollaborationCallRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	projectUUID := strings.TrimSpace(input.ProjectUUID)
	if projectUUID == "" {
		return newHTTPError(http.StatusBadRequest, "缺少项目 UUID")
	}
	call, err := h.collaboration.PublishCollaborationCall(r.Context(), applicationcollaboration.CreateCallInput{
		OwnerID: userID, ProjectID: projectUUID, TargetContractID: input.TargetContractUUID,
		Title: input.Title, MaxSubmissions: input.MaxSubmissions,
	})
	if errors.Is(err, applicationcollaboration.ErrNotFound) {
		return newHTTPError(http.StatusNotFound, "项目或目标节点不存在")
	}
	if errors.Is(err, applicationcollaboration.ErrProjectPrivate) {
		return newHTTPError(http.StatusBadRequest, "只有公开项目可以发布开放缺口")
	}
	if errors.Is(err, applicationcollaboration.ErrTargetNotReady) {
		return newHTTPError(http.StatusBadRequest, "只能为等待推进的冻结节点发布开放缺口")
	}
	if errors.Is(err, applicationcollaboration.ErrCallExists) {
		return newHTTPError(http.StatusBadRequest, "这个节点已经有一个开放缺口")
	}
	if errors.Is(err, applicationcollaboration.ErrInvalidRequest) {
		return newHTTPError(http.StatusBadRequest, "开放缺口参数不正确")
	}
	if err != nil {
		return newHTTPError(http.StatusInternalServerError, "创建开放缺口失败")
	}
	writeJSON(w, http.StatusCreated, map[string]any{"call": call})
	return nil
}

// ListPublicProjects 返回可在探索页公开发现的项目。
func (h *Handler) ListPublicProjects(w http.ResponseWriter, r *http.Request) error {
	projects, err := h.collaboration.ListPublicProjects(r.Context())
	if err != nil {
		return newHTTPError(http.StatusInternalServerError, "读取公开项目失败")
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
	return nil
}

// GetPublicProjectDetail 返回一个公开项目的协作详情。
func (h *Handler) GetPublicProjectDetail(w http.ResponseWriter, r *http.Request) error {
	query := getPublicProjectDetailQuery{ProjectUUID: strings.TrimSpace(r.URL.Query().Get("projectUuid"))}
	if query.ProjectUUID == "" {
		return newHTTPError(http.StatusBadRequest, "缺少项目 UUID")
	}
	project, err := h.collaboration.GetPublicProject(r.Context(), query.ProjectUUID)
	if errors.Is(err, applicationcollaboration.ErrNotFound) {
		return newHTTPError(http.StatusNotFound, "公开项目不存在")
	}
	if err != nil {
		return newHTTPError(http.StatusInternalServerError, "读取公开项目失败")
	}
	writeJSON(w, http.StatusOK, map[string]any{"project": project})
	return nil
}

// GetCollaborationCallDetail 返回一份协作征集及其全部投稿。
func (h *Handler) GetCollaborationCallDetail(w http.ResponseWriter, r *http.Request) error {
	query := getCollaborationCallDetailQuery{CallUUID: strings.TrimSpace(r.URL.Query().Get("callUuid"))}
	if query.CallUUID == "" {
		return newHTTPError(http.StatusBadRequest, "缺少开放缺口 UUID")
	}
	details, err := h.collaboration.GetCollaborationCallDetails(r.Context(), query.CallUUID)
	if errors.Is(err, applicationcollaboration.ErrNotFound) {
		return newHTTPError(http.StatusNotFound, "开放缺口不存在")
	}
	if err != nil {
		return newHTTPError(http.StatusInternalServerError, "读取开放缺口失败")
	}
	writeJSON(w, http.StatusOK, details)
	return nil
}

// SubmitProjectContribution 将一份已有公开成果提交给协作征集。
func (h *Handler) SubmitProjectContribution(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input createCollaborationSubmissionRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	callUUID := strings.TrimSpace(input.CallUUID)
	if callUUID == "" {
		return newHTTPError(http.StatusBadRequest, "缺少开放缺口 UUID")
	}
	details, err := h.collaboration.SubmitProjectContribution(r.Context(), applicationcollaboration.SubmitInput{
		UserID: userID, CallID: callUUID, SourceRecordID: input.SourceRecordUUID,
		MappingText: input.MappingText, Note: input.Note,
	})
	if errors.Is(err, applicationcollaboration.ErrNotFound) {
		return newHTTPError(http.StatusNotFound, "开放缺口不存在")
	}
	if errors.Is(err, applicationcollaboration.ErrDuplicateSubmission) {
		return newHTTPError(http.StatusBadRequest, "这份成果已经提交给该开放缺口")
	}
	if errors.Is(err, applicationcollaboration.ErrSubmissionInvalid) {
		return newHTTPError(http.StatusBadRequest, "请选择自己的公开成果，并说明它对应目标标准的哪一部分")
	}
	if err != nil {
		return newHTTPError(http.StatusInternalServerError, "提交贡献失败")
	}
	writeJSON(w, http.StatusCreated, map[string]any{"submissions": details.Submissions})
	return nil
}

// ReviewContributionBatch 按目标节点标准审查选中的贡献组合。
func (h *Handler) ReviewContributionBatch(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input createCollaborationReviewRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationReviewTimeout)
	defer cancel()
	batch, err := h.collaboration.ReviewContributionBatch(ctx, userID, input.CallUUID, input.SubmissionUUIDs)
	if errors.Is(err, applicationcollaboration.ErrNotFound) {
		return newHTTPError(http.StatusNotFound, "开放缺口不存在")
	}
	if errors.Is(err, applicationcollaboration.ErrUnauthorized) {
		return newHTTPError(http.StatusForbidden, "只有项目维护者可以审查贡献组合")
	}
	if errors.Is(err, applicationcollaboration.ErrInvalidRequest) {
		return newHTTPError(http.StatusBadRequest, "这个开放缺口、目标状态或投稿选择已经变化")
	}
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"batch": batch})
	return nil
}

// AdoptReviewedContributions 将一组已审查贡献正式采纳到目标项目。
func (h *Handler) AdoptReviewedContributions(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input adoptReviewedContributionsRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	batchUUID := strings.TrimSpace(input.BatchUUID)
	if batchUUID == "" {
		return newHTTPError(http.StatusBadRequest, "缺少组合审查 UUID")
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	if err := h.collaboration.AdoptReviewedContributions(ctx, applicationcollaboration.AdoptReviewInput{UserID: userID, BatchID: batchUUID}); err != nil {
		if errors.Is(err, applicationcollaboration.ErrNotFound) {
			return newHTTPError(http.StatusNotFound, "组合审查不存在")
		}
		if errors.Is(err, applicationcollaboration.ErrUnauthorized) {
			return newHTTPError(http.StatusForbidden, "只有项目维护者可以采纳贡献")
		}
		if errors.Is(err, applicationcollaboration.ErrInvalidRequest) {
			return newHTTPError(http.StatusBadRequest, "目标节点或贡献状态已经变化，不能采纳这批贡献")
		}
		return newHTTPError(http.StatusInternalServerError, "采纳贡献失败")
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "贡献已采纳。来源作者和来源成果会一直保留在协作记录中。"})
	return nil
}

// ListContributionSourceRecords 返回当前用户可用于投稿的公开成果。
func (h *Handler) ListContributionSourceRecords(w http.ResponseWriter, r *http.Request, userID uint64) error {
	sources, err := h.collaboration.ListContributionSources(r.Context(), userID)
	if err != nil {
		return newHTTPError(http.StatusInternalServerError, "读取可提交成果失败")
	}
	writeJSON(w, http.StatusOK, map[string]any{"sources": sources})
	return nil
}

// ListCurrentUserContributions 返回当前用户发起的贡献记录。
func (h *Handler) ListCurrentUserContributions(w http.ResponseWriter, r *http.Request, userID uint64) error {
	items, err := h.collaboration.ListContributionActivities(r.Context(), userID)
	if err != nil {
		return newHTTPError(http.StatusInternalServerError, "读取协作回流失败")
	}
	writeJSON(w, http.StatusOK, map[string]any{"contributions": items})
	return nil
}
