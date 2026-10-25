package demoseed

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"net/http"
	"net/url"
	"strings"

	app "github.com/singaurora/exec-graph/backend/internal/application/demoseed"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"gorm.io/gorm"
)

func assetUUID(value string) *string {
	u, err := url.Parse(value)
	if err != nil || u.Path != "/api/commands/media/file" {
		return nil
	}
	uuid := u.Query().Get("assetId")
	if !id.Valid(uuid) {
		return nil
	}
	return &uuid
}

func (r *Repository) assets(ctx context.Context, tx *gorm.DB, data app.Prepared) error {
	for _, a := range data.Assets {
		key := "demo/v1/" + a.Key
		body, err := r.files.Read(ctx, key)
		if err != nil {
			return err
		}
		dimensions, _, err := image.DecodeConfig(bytes.NewReader(body))
		if err != nil {
			return fmt.Errorf("演示配图无法解码: %w", err)
		}
		mime := http.DetectContentType(body)
		size, width, height := uint64(len(body)), uint32(dimensions.Width), uint32(dimensions.Height)
		sum := sha256.Sum256(body)
		row := model.MediaAsset{UUID: id.Demo("asset", a.Key), OwnerUUID: id.Demo("user", "jo"), ObjectKey: key, Status: "ready", MIMEType: &mime, ByteSize: &size, Width: &width, Height: &height, SHA256: sum[:]}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) node(tx *gorm.DB, n app.Node, digest string) error {
	v := n.View
	conversationUUID := id.Demo("conversation", v.ID)
	generationUUID := id.Demo("generation", v.ID)
	row := model.ActionNode{UUID: v.ID, GraphUUID: v.GraphID, NodeNumber: v.Number, AuthorUUID: v.AuthorID, Title: v.Title, ObjectiveMarkdown: v.ObjectiveMarkdown, ContextGuideSnapshot: v.ContextSnapshot.Guide, HistoryNodeCount: v.ContextSnapshot.HistoryNodeCount, NodeLevel: n.Level, Version: 1, CreatedAt: v.CreatedAt, UpdatedAt: v.CreatedAt}
	if v.ParentID == "" {
		row.IsRoot = 1
	}
	if err := tx.Create(&row).Error; err != nil {
		return err
	}
	boundary := uint32(len(v.Conversation))
	conversation := model.AIConversation{UUID: conversationUUID, GraphUUID: v.GraphID, OwnerUUID: v.AuthorID, NodeUUID: &v.ID, PublishedThroughSequence: &boundary, NextMessageSequence: boundary + 1, Version: 1, CreatedAt: v.CreatedAt, UpdatedAt: v.CreatedAt}
	if err := tx.Create(&conversation).Error; err != nil {
		return err
	}
	inputThrough := uint32(0)
	for i, m := range v.Conversation {
		message := model.AIMessage{UUID: m.ID, ConversationUUID: conversationUUID, SequenceNumber: uint32(i + 1), Speaker: m.Speaker, Body: m.Body, ConfirmedAt: &v.CreatedAt, CreatedAt: v.CreatedAt}
		if m.Speaker == "user" {
			message.AuthorUUID = &v.AuthorID
			inputThrough = uint32(i + 1)
		}
		if err := tx.Create(&message).Error; err != nil {
			return err
		}
	}
	outputUUID := v.Conversation[len(v.Conversation)-1].ID
	expression := ""
	if v.ExpressionMarkdown != nil {
		expression = *v.ExpressionMarkdown
	}
	var agreement *string
	if n.AgreementMode != "inherit" {
		agreement = v.AgreementMarkdown
	}
	title, objective := v.Title, v.ObjectiveMarkdown
	hash, _ := hex.DecodeString(digest)
	generation := model.AIGeneration{UUID: generationUUID, ConversationUUID: conversationUUID, GraphUUID: v.GraphID, RequestedByUUID: v.AuthorID, RequestKey: id.Demo("request", v.ID), Mode: "action", Status: "succeeded", InputThroughSequence: inputThrough, OutputMessageUUID: &outputUUID, DownstreamAgreementMode: n.AgreementMode, DownstreamAgreementMarkdown: agreement, ContextGuideSnapshot: v.ContextSnapshot.Guide, ContextSHA256: hash, Model: "demo-fixture", PromptVersion: "demo-import-v1", GeneratedTitle: &title, ObjectiveMarkdown: &objective, ExpressionMode: &n.ExpressionMode, ExpressionMarkdown: &expression, CreatedAt: v.CreatedAt, CompletedAt: &v.CreatedAt, ConfirmedAt: &v.CreatedAt}
	if err := tx.Create(&generation).Error; err != nil {
		return err
	}
	// 最后一条 AI 消息是本轮输出，不重复放入该轮输入清单。
	for i, m := range v.Conversation[:len(v.Conversation)-1] {
		if err := tx.Create(&model.GenerationMessage{ConversationUUID: conversationUUID, GenerationUUID: generationUUID, MessageUUID: m.ID, Position: uint32(i + 1)}).Error; err != nil {
			return err
		}
	}
	for _, doc := range n.Documents {
		change := "initial"
		if doc.Mode == "clear" {
			change = "clear"
		}
		record := model.DocumentVersion{UUID: doc.UUID, GraphUUID: v.GraphID, NodeUUID: v.ID, Kind: doc.Kind, RevisionNumber: 1, Mode: doc.Mode, ChangeKind: change, Markdown: doc.Markdown, ActorUUID: v.AuthorID, PreviousVersionUUID: doc.PreviousUUID, GenerationUUID: &generationUUID, CreatedAt: v.CreatedAt}
		if err := tx.Create(&record).Error; err != nil {
			return err
		}
	}
	states := []model.DocumentState{{GraphUUID: v.GraphID, NodeUUID: v.ID, Kind: "expression", Mode: n.ExpressionMode, LocalVersionUUID: n.LocalExpressionUUID, EffectiveVersionUUID: n.EffectiveExpressionUUID, UpdatedAt: v.CreatedAt}, {GraphUUID: v.GraphID, NodeUUID: v.ID, Kind: "agreement", Mode: n.AgreementMode, LocalVersionUUID: n.LocalAgreementUUID, EffectiveVersionUUID: n.EffectiveAgreementUUID, UpdatedAt: v.CreatedAt}}
	if err := tx.Create(&states).Error; err != nil {
		return err
	}
	for i, img := range v.Images {
		asset := assetUUID(img.URL)
		var external *string
		if asset == nil {
			u, err := url.Parse(img.URL)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") || strings.TrimSpace(img.URL) == "" {
				return fmt.Errorf("演示外链图片地址不合法")
			}
			external = &img.URL
		}
		if err := tx.Create(&model.ActionImage{NodeUUID: v.ID, AssetUUID: asset, ExternalURL: external, Position: uint16(i + 1), AltText: img.Alt}).Error; err != nil {
			return err
		}
	}
	return nil
}
