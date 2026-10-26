package bootstrap

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	appaccount "github.com/singaurora/exec-graph/backend/internal/application/account"
	app "github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	appgeneration "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/application/graph"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	appmedia "github.com/singaurora/exec-graph/backend/internal/application/media"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/database"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/schema"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/security"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/session"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"gorm.io/gorm"
)

type writeSystem struct {
	deps   *Dependencies
	server *httptest.Server
}

type writeClient struct {
	url, token, csrf string
	http             *http.Client
}

type commandResponse struct {
	status  int
	data    json.RawMessage
	code    int
	message string
}

func writeFixture(t *testing.T, objects ...appmedia.Objects) *writeSystem {
	var selected appmedia.Objects
	if len(objects) > 0 {
		selected = objects[0]
	}
	return writeFixtureDependencies(t, selected, nil)
}

func writeFixtureDependencies(t *testing.T, objects appmedia.Objects, provider appgeneration.Provider, senders ...appaccount.Sender) *writeSystem {
	t.Helper()
	if os.Getenv("EXEC_GRAPH_INTEGRATION") != "1" {
		t.Skip("显式启用后才连接真实 MySQL 和 Redis")
	}
	c, err := config.Load(config.Path())
	if err != nil {
		t.Fatal(err)
	}
	suffix := strings.ReplaceAll(id.New(), "-", "")
	c.Database.Schema, c.Redis.Prefix = "eg_write_"+suffix, "exec_graph:writeit:"+suffix+":"
	t.Logf("隔离写入测试库: %s", c.Database.Schema)
	c.App.Environment, c.App.EnableDemoLogin = "test", true
	if err := database.CreateSchema(c.Database); err != nil {
		t.Fatal(err)
	}
	db, err := database.Open(c.Database)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { defer database.Close(db); mustDB(t, db.Exec("DROP DATABASE `"+c.Database.Schema+"`")) })
	redis, err := session.Open(context.Background(), c.Redis)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := redis.Close(); err != nil {
			t.Error(err)
		}
	})
	deps := &Dependencies{Config: c, DB: db, Sessions: redis}
	deps.Objects, deps.AI = objects, provider
	if len(senders) > 0 {
		deps.Mail = senders[0]
	}
	if err := schema.Migrate(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	if _, err := SeedDemo(context.Background(), deps, ""); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(HTTP(deps, slog.New(slog.NewTextHandler(io.Discard, nil))))
	t.Cleanup(server.Close)
	return &writeSystem{deps, server}
}

func (s *writeSystem) as(t *testing.T, uuid string) writeClient {
	t.Helper()
	token, csrf := security.Passwords{}.Token(), security.Passwords{}.Token()
	if err := s.deps.Sessions.Put(context.Background(), token, identity.SessionRecord{UserUUID: uuid, AuthVersion: 1, CSRFToken: csrf, ExpiresAt: time.Now().Add(time.Hour)}, time.Hour); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := s.deps.Sessions.Delete(context.Background(), token); err != nil {
			t.Error(err)
		}
	})
	return writeClient{url: s.server.URL, token: token, csrf: csrf, http: &http.Client{Timeout: 110 * time.Second}}
}

func (c writeClient) send(method, path string, input any, key string) (commandResponse, error) {
	body, err := json.Marshal(input)
	if err != nil {
		return commandResponse{}, err
	}
	req, err := http.NewRequest(method, c.url+"/api/commands/"+path, bytes.NewReader(body))
	if err != nil {
		return commandResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-CSRF-Token", c.csrf)
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
	req.AddCookie(&http.Cookie{Name: "exec_graph_v1_session", Value: c.token})
	res, err := c.http.Do(req)
	if err != nil {
		return commandResponse{}, err
	}
	defer res.Body.Close()
	var wire wire[json.RawMessage]
	if err := json.NewDecoder(res.Body).Decode(&wire); err != nil {
		return commandResponse{}, err
	}
	return commandResponse{status: res.StatusCode, data: wire.Data, code: wire.Code, message: wire.Message}, nil
}

func (c writeClient) call(t *testing.T, method, path string, input any, status int, key string) json.RawMessage {
	t.Helper()
	out, err := c.send(method, path, input, key)
	if err != nil {
		t.Fatal(err)
	}
	if out.status != status {
		t.Fatalf("%s %s: HTTP %d code=%d，期望 %d: %s", method, path, out.status, out.code, status, out.message)
	}
	return out.data
}

func decode[T any](t *testing.T, body json.RawMessage) T {
	t.Helper()
	var out T
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func (c writeClient) graph(t *testing.T) catalogue.GraphView {
	return decode[catalogue.GraphView](t, c.call(t, "POST", "graphs/create", graph.CreateGraphInput{Title: "实库写入测试", Description: "隔离测试图"}, 200, id.New()))
}

func (c writeClient) publish(t *testing.T, input app.CreateActionInput) catalogue.ActionView {
	return decode[catalogue.ActionView](t, c.call(t, "POST", "actions/create", input, 200, id.New()))
}

func mustDB(t *testing.T, result *gorm.DB) {
	t.Helper()
	if result.Error != nil {
		t.Fatal(result.Error)
	}
}

func str(value string) *string { return &value }

// draft 仅在集成测试中创建明确标记的成功生成；不调用外部 AI，也不提供运行时生成后门。
func (s *writeSystem) draft(t *testing.T, user, graphID, nodeID string, sources []string, expression, agreement app.DocumentUpdate) app.CreateActionInput {
	t.Helper()
	db, now := s.deps.DB, time.Now().UTC()
	uuid, conversationID := id.New(), id.New()
	var graph model.Graph
	mustDB(t, db.Where("uuid = ?", graphID).Take(&graph))
	conversation := model.AIConversation{UUID: conversationID, GraphUUID: graphID, OwnerUUID: user, NextMessageSequence: 1, Version: 1}
	mode := "action"
	var base *uint32
	var inherited *string
	if nodeID != "" {
		mode = "expression"
		mustDB(t, db.Where("node_uuid = ?", nodeID).Take(&conversation))
		conversationID = conversation.UUID
		var node model.ActionNode
		mustDB(t, db.Where("uuid = ?", nodeID).Take(&node))
		base = &node.Version
		var state model.DocumentState
		mustDB(t, db.Where("node_uuid = ? AND kind = ?", nodeID, "expression").Take(&state))
		inherited = state.EffectiveVersionUUID
	} else {
		mustDB(t, db.Create(&conversation))
	}
	userMessage := model.AIMessage{UUID: id.New(), ConversationUUID: conversationID, SequenceNumber: conversation.NextMessageSequence, Speaker: "user", AuthorUUID: &user, Body: "集成测试的明确事实输入", CreatedAt: now}
	output := model.AIMessage{UUID: id.New(), ConversationUUID: conversationID, SequenceNumber: conversation.NextMessageSequence + 1, Speaker: "ai", Body: "集成测试输出，不代表调用真实 AI", CreatedAt: now}
	mustDB(t, db.Create(&userMessage))
	mustDB(t, db.Create(&output))
	mustDB(t, db.Model(&model.AIConversation{}).Where("uuid = ?", conversationID).Update("next_message_sequence", output.SequenceNumber+1))
	input := app.CreateActionInput{GraphID: graphID, GenerationID: uuid, MergedParentIDs: []string{}, SourceVersions: []app.SourceVersion{}, ReferenceAgreements: []app.SourceAssessment{}, Images: []app.ImageInput{}}
	for index, sourceID := range sources {
		kind := "merged"
		if index == 0 {
			kind = "primary"
			input.ParentID = sourceID
		} else {
			input.MergedParentIDs = append(input.MergedParentIDs, sourceID)
		}
		var source model.ActionNode
		mustDB(t, db.Where("uuid = ?", sourceID).Take(&source))
		var states []model.DocumentState
		mustDB(t, db.Where("node_uuid = ?", sourceID).Find(&states))
		snapshot := model.GenerationSource{GraphUUID: graphID, GenerationUUID: uuid, SourceNodeUUID: sourceID, SourceNodeVersion: source.Version, Kind: kind}
		for _, state := range states {
			if state.Kind == "expression" {
				snapshot.SourceExpressionVersionUUID = state.EffectiveVersionUUID
			} else {
				snapshot.SourceAgreementVersionUUID = state.EffectiveVersionUUID
			}
		}
		if index == 0 {
			inherited = snapshot.SourceExpressionVersionUUID
		}
		mustDB(t, db.Create(&snapshot))
		input.SourceVersions = append(input.SourceVersions, app.SourceVersion{NodeID: sourceID, Version: source.Version})
		input.ReferenceAgreements = append(input.ReferenceAgreements, app.SourceAssessment{SourceID: sourceID, Provided: true})
	}
	text := ""
	if expression.Markdown != nil {
		text = *expression.Markdown
	}
	var agreementMarkdown *string
	if agreement.Mode != "inherit" {
		agreementMarkdown = str("")
		if agreement.Markdown != nil {
			agreementMarkdown = agreement.Markdown
		}
	}
	title, objective := "记录已经发生的行动", fmt.Sprintf("这是服务端测试生成 %s 的客观文稿。", uuid)
	row := model.AIGeneration{UUID: uuid, ConversationUUID: conversationID, GraphUUID: graphID, RequestedByUUID: user, RequestKey: id.New(), Mode: mode, Status: "succeeded", InputThroughSequence: userMessage.SequenceNumber, OutputMessageUUID: &output.UUID, BaseNodeVersion: base, InheritedExpressionVersionUUID: inherited, DownstreamAgreementMode: agreement.Mode, DownstreamAgreementMarkdown: agreementMarkdown, ContextGuideSnapshot: graph.ContextGuide, ContextSHA256: make([]byte, 32), Model: "integration-fixture", PromptVersion: "integration-only", GeneratedTitle: &title, ObjectiveMarkdown: &objective, ExpressionMode: &expression.Mode, ExpressionMarkdown: &text, CompletedAt: &now}
	mustDB(t, db.Create(&row))
	var messages []model.AIMessage
	mustDB(t, db.Where("conversation_uuid = ? AND sequence_number <= ?", conversationID, userMessage.SequenceNumber).Order("sequence_number").Find(&messages))
	for i, message := range messages {
		mustDB(t, db.Create(&model.GenerationMessage{ConversationUUID: conversationID, GenerationUUID: uuid, MessageUUID: message.UUID, Position: uint32(i + 1)}))
	}
	return input
}
