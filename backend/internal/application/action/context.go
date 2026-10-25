package action

import (
	"strings"
	"unicode/utf8"

	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// ValidateDocument 校验显式文档意图；首次行动及已有节点修改不能继承。
func ValidateDocument(doc DocumentUpdate, inherit bool) error {
	if doc.Mode == "inherit" && inherit && doc.Markdown == nil {
		return nil
	}
	if doc.Mode == "clear" && doc.Markdown == nil {
		return nil
	}
	if doc.Mode == "update" && doc.Markdown != nil && strings.TrimSpace(*doc.Markdown) != "" && utf8.RuneCountInString(*doc.Markdown) <= constants.DocumentLimit {
		return nil
	}
	return fault.New(fault.Invalid, "文档必须明确继承、更新非空内容或清空")
}

func known(graph Graph, start string) map[string]bool {
	parents := map[string][]string{}
	for _, edge := range graph.Edges {
		parents[edge.TargetID] = append(parents[edge.TargetID], edge.SourceID)
	}
	seen := map[string]bool{}
	queue := []string{start}
	for len(queue) > 0 {
		current := queue[len(queue)-1]
		queue = queue[:len(queue)-1]
		if seen[current] {
			continue
		}
		seen[current] = true
		queue = append(queue, parents[current]...)
	}
	return seen
}

func terminal(graph Graph, nodeID string) bool {
	for _, edge := range graph.Edges {
		if edge.SourceID == nodeID {
			return false
		}
	}
	return true
}

// ResolveSources 只采用当前主要链和合法合入终点的历史并集，不接收客户端历史数量。
func ResolveSources(graph Graph, input CreateActionInput) ([]GenerationSource, uint32, uint32, error) {
	if input.MergedParentIDs == nil || input.SourceVersions == nil || input.ReferenceAgreements == nil || len(input.MergedParentIDs)+1 > constants.DirectSourceLimit {
		return nil, 0, 0, fault.New(fault.Invalid, "来源及核对列表不完整")
	}
	if input.ParentID == "" {
		if len(graph.Nodes) != 0 || len(input.MergedParentIDs) != 0 || len(input.SourceVersions) != 0 || len(input.ReferenceAgreements) != 0 {
			return nil, 0, 0, fault.New(fault.Conflict, "此图已有起点或首次行动携带了来源")
		}
		return []GenerationSource{}, 0, 1, nil
	}
	byID := map[string]Node{}
	for _, node := range graph.Nodes {
		byID[node.ID] = node
	}
	parent, found := byID[input.ParentID]
	if !found {
		return nil, 0, 0, fault.New(fault.Conflict, "主要来源不属于当前图或已不可用")
	}
	primaryHistory := known(graph, parent.ID)
	ids := append([]string{input.ParentID}, input.MergedParentIDs...)
	if len(input.SourceVersions) != len(ids) || len(input.ReferenceAgreements) != len(ids) {
		return nil, 0, 0, fault.New(fault.Invalid, "每个直接来源都需要版本和明确核对状态")
	}
	versions := map[string]uint32{}
	for _, v := range input.SourceVersions {
		if !id.Valid(v.NodeID) || v.Version == 0 || versions[v.NodeID] != 0 {
			return nil, 0, 0, fault.New(fault.Invalid, "来源版本不合法或重复")
		}
		versions[v.NodeID] = v.Version
	}
	reviews := map[string]SourceAssessment{}
	for _, review := range input.ReferenceAgreements {
		if _, exists := reviews[review.SourceID]; exists || !review.Provided {
			return nil, 0, 0, fault.New(fault.Invalid, "来源核对重复或未明确提供 complies")
		}
		if review.Complies != nil && !*review.Complies {
			if review.ExceptionReason == nil || strings.TrimSpace(*review.ExceptionReason) == "" || utf8.RuneCountInString(*review.ExceptionReason) > constants.ContextGuideLimit {
				return nil, 0, 0, fault.New(fault.Invalid, "不满足约定时需要说明原因")
			}
		} else if review.ExceptionReason != nil {
			return nil, 0, 0, fault.New(fault.Invalid, "只有不满足约定时才能附带例外理由")
		}
		reviews[review.SourceID] = review
	}
	seen, history := map[string]bool{}, map[string]bool{}
	sources := make([]GenerationSource, 0, len(ids))
	level := uint32(1)
	for index, uuid := range ids {
		node, ok := byID[uuid]
		if !ok || seen[uuid] || (index > 0 && (primaryHistory[uuid] || !terminal(graph, uuid))) {
			return nil, 0, 0, fault.New(fault.Conflict, "合入来源必须是同图且不在主要历史中的其他路线终点")
		}
		seen[uuid] = true
		if versions[uuid] == 0 {
			return nil, 0, 0, fault.New(fault.Invalid, "来源版本与引用列表不一致")
		}
		if versions[uuid] != node.Version {
			return nil, 0, 0, fault.New(fault.Conflict, "来源版本已变化，请重新核对")
		}
		review, ok := reviews[uuid]
		if !ok {
			return nil, 0, 0, fault.New(fault.Invalid, "来源核对与引用列表不一致")
		}
		kind := "merged"
		if index == 0 {
			kind = "primary"
		}
		status := "unrestricted"
		if node.Agreement.Mode == "update" && strings.TrimSpace(node.Agreement.Markdown) != "" {
			status = "unreviewed"
			if review.Complies != nil {
				if *review.Complies {
					status = "satisfied"
				} else {
					status = "exception"
				}
			}
		}
		sources = append(sources, GenerationSource{GraphID: graph.ID, NodeID: uuid, Kind: kind, Version: node.Version, ExpressionID: node.Expression.ID, AgreementID: node.Agreement.ID, AgreementStatus: status, Complies: review.Complies, ExceptionReason: review.ExceptionReason})
		for ancestor := range known(graph, uuid) {
			history[ancestor] = true
		}
		if node.Level >= level {
			level = node.Level + 1
		}
	}
	return sources, uint32(len(history)), level, nil
}

func sameSources(left, right []GenerationSource) bool {
	if len(left) != len(right) {
		return false
	}
	for i, a := range left {
		b := right[i]
		if a.NodeID != b.NodeID || a.Kind != b.Kind || a.Version != b.Version || a.ExpressionID != b.ExpressionID || a.AgreementID != b.AgreementID || !sameBool(a.Complies, b.Complies) || !sameString(a.ExceptionReason, b.ExceptionReason) {
			return false
		}
	}
	return true
}

func sameBool(a, b *bool) bool { return (a == nil && b == nil) || (a != nil && b != nil && *a == *b) }
func sameString(a, b *string) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && *a == *b)
}
