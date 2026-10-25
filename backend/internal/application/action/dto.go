// Package action 实现行动发布及终点表达、约定的版本化确认。
package action

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/application/submission"
)

// DocumentUpdate 显式区分继承、非空更新及主动清空。
type DocumentUpdate struct {
	Mode     string  `json:"mode"`
	Markdown *string `json:"markdown,omitempty"`
}

// SourceVersion 固定用户确认时看到的直接来源版本。
type SourceVersion struct {
	NodeID  string `json:"nodeId"`
	Version uint32 `json:"version"`
}

// SourceAssessment 要求明确提供 complies，null 表示未核对。
type SourceAssessment struct {
	SourceID        string  `json:"sourceId"`
	Complies        *bool   `json:"complies"`
	ExceptionReason *string `json:"exceptionReason,omitempty"`
	Provided        bool    `json:"-"`
}

// UnmarshalJSON 保留 complies 的缺省与显式 null 区别，并拒绝未知嵌套字段。
func (s *SourceAssessment) UnmarshalJSON(body []byte) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(body, &fields); err != nil {
		return err
	}
	for key := range fields {
		if key != "sourceId" && key != "complies" && key != "exceptionReason" {
			return fmt.Errorf("未知约定核对字段")
		}
	}
	type plain SourceAssessment
	var value plain
	if err := json.Unmarshal(body, &value); err != nil {
		return err
	}
	*s = SourceAssessment(value)
	_, s.Provided = fields["complies"]
	return nil
}

// ImageInput 只引用当前用户的站内已就绪图片。
type ImageInput struct {
	AssetID string `json:"assetId"`
	Alt     string `json:"alt"`
}

// CreateActionInput 只确认服务器生成结果，不接收浏览器伪造的事实或对话。
type CreateActionInput struct {
	GraphID             string             `json:"graphId"`
	GenerationID        string             `json:"generationId"`
	ParentID            string             `json:"parentId,omitempty"`
	MergedParentIDs     []string           `json:"mergedParentIds"`
	SourceVersions      []SourceVersion    `json:"sourceVersions"`
	ReferenceAgreements []SourceAssessment `json:"referenceAgreements"`
	Images              []ImageInput       `json:"images"`
}

// UpdateExpressionInput 确认当前节点连续对话中形成的新表达。
type UpdateExpressionInput struct {
	NodeID          string `json:"nodeId"`
	ExpectedVersion uint32 `json:"expectedVersion"`
	GenerationID    string `json:"generationId"`
}

// UpdateAgreementInput 修改向后传递的约定，不改变原有引用核对。
type UpdateAgreementInput struct {
	NodeID          string         `json:"nodeId"`
	ExpectedVersion uint32         `json:"expectedVersion"`
	Document        DocumentUpdate `json:"document"`
}

// Document 是解析后的有效版本，空 ID 表示从未有明确版本。
type Document struct {
	ID       string
	NodeID   string
	ActorID  string
	Mode     string
	Markdown string
	Revision uint32
}

// Node 是事务内计算引用背景所需的行动事实。
type Node struct {
	ID         string
	AuthorID   string
	Version    uint32
	Number     uint32
	Level      uint32
	Expression Document
	Agreement  Document
}

// Edge 是由旧行动指向新行动的引用关系。
type Edge struct{ SourceID, TargetID, Kind string }

// Graph 是持有图锁后的完整一致上下文。
type Graph struct {
	ID         string
	Guide      string
	NextNumber uint32
	Nodes      []Node
	Edges      []Edge
}

// GenerationSource 固定生成时使用的直接来源及约定核对。
type GenerationSource struct {
	GraphID         string
	NodeID          string
	Kind            string
	Version         uint32
	ExpressionID    string
	AgreementID     string
	AgreementStatus string
	Complies        *bool
	ExceptionReason *string
}

// Generation 是服务端存储的成功输出及它实际使用的上下文，不来自发布请求。
type Generation struct {
	ID                    string
	GraphID               string
	RequesterID           string
	Mode                  string
	ConversationNodeID    string
	ConversationOwnerID   string
	BaseVersion           uint32
	Guide                 string
	Title                 string
	Objective             string
	Expression            DocumentUpdate
	Agreement             DocumentUpdate
	Sources               []GenerationSource
	Status                string
	Confirmed             bool
	Completed             bool
	HasExpression         bool
	InheritedExpressionID string
	ConversationID        string
	ConversationGraphID   string
	NextMessageSequence   uint32
	InputThroughSequence  uint32
	Output                *ConversationMessage
	Messages              []ConversationMessage
	UsedMessages          []GenerationInput
}

// ConversationMessage 是确认完整性校验所需的服务端消息事实。
type ConversationMessage struct {
	ID             string
	ConversationID string
	Sequence       uint32
	Speaker        string
	AuthorID       string
	Confirmed      bool
}

// GenerationInput 固定一次生成实际使用的消息及顺序。
type GenerationInput struct {
	MessageID      string
	ConversationID string
	Position       uint32
}

// Publication 是 application 验证后交给仓储原子落库的完整结果。
type Publication struct {
	ID           string
	ActorID      string
	GraphID      string
	Number       uint32
	Level        uint32
	HistoryCount uint32
	Guide        string
	Generation   Generation
	Sources      []GenerationSource
	Images       []ImageInput
	CreatedAt    time.Time
}

// Revision 描述不可变文档新版本及被替换的有效版本。
type Revision struct {
	NodeID          string
	GraphID         string
	Kind            string
	Previous        Document
	Document        DocumentUpdate
	GenerationID    string
	ActorID         string
	ExpectedVersion uint32
	Number          uint32
	ChangeKind      string
}

// Transaction 绑定一次图内写入事务，application 不接触数据库句柄。
type Transaction interface {
	submission.Log
	Graph(string) (Graph, error)
	NodeGraph(string) (string, error)
	Generation(string) (Generation, error)
	CheckAssets(...*string) error
	Publish(Publication) error
	Revise(Revision) error
	Confirm(generationID, nodeID string, initial bool) error
	View(string) (catalogue.ActionView, error)
}

// Store 提供账号锁及原子事务。
type Store interface {
	Within(context.Context, identity.Actor, func(Transaction) error) error
}
