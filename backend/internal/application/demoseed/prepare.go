package demoseed

import (
	"fmt"
	"sort"
	"strings"

	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// Prepare 在任何数据库写入前校验关联并计算 UUID、继承及背景。
func Prepare(source Dataset, digest, mainPassword string, passwords Passwords) (Prepared, error) {
	out := Prepared{Dataset: source.Dataset, Digest: digest, Assets: source.Assets}
	if source.Dataset != "frontend-demo-v1" || len(source.Users) == 0 || len(source.Graphs) == 0 {
		return out, fmt.Errorf("演示数据集不合法")
	}
	if mainPassword != "" && (len(mainPassword) < 8 || len(mainPassword) > 128) {
		return out, fmt.Errorf("测试账号密码长度应为 8～128 字节")
	}
	users, graphs, nodes := map[string]string{}, map[string]string{}, map[string]string{}
	for _, u := range source.Users {
		if u.ID == "" || users[u.ID] != "" {
			return out, fmt.Errorf("演示用户标识重复或为空")
		}
		users[u.ID] = id.Demo("user", u.ID)
		out.Aliases = append(out.Aliases, Alias{"user", u.ID, users[u.ID]})
	}
	for _, g := range source.Graphs {
		if g.ID == "" || graphs[g.ID] != "" {
			return out, fmt.Errorf("演示图标识重复或为空")
		}
		graphs[g.ID] = id.Demo("graph", g.ID)
		out.Aliases = append(out.Aliases, Alias{"graph", g.ID, graphs[g.ID]})
	}
	for _, n := range source.Actions {
		if n.ID == "" || nodes[n.ID] != "" {
			return out, fmt.Errorf("演示行动标识重复或为空")
		}
		nodes[n.ID] = id.Demo("action", n.ID)
		out.Aliases = append(out.Aliases, Alias{"action", n.ID, nodes[n.ID]})
	}
	assetNames := map[string]bool{}
	for _, a := range source.Assets {
		if a.Key == "" || strings.ContainsAny(a.Key, "/\\") || assetNames[a.Key] {
			return out, fmt.Errorf("演示配图键不合法")
		}
		assetNames[a.Key] = true
	}
	media := func(value string) (string, error) {
		if !strings.HasPrefix(value, "seed-asset:") {
			return value, nil
		}
		key := strings.TrimPrefix(value, "seed-asset:")
		if !assetNames[key] {
			return "", fmt.Errorf("配图不在清单中")
		}
		return "/api/commands/media/file?assetId=" + id.Demo("asset", key), nil
	}
	optionalMedia := func(value *string) (*string, error) {
		if value == nil {
			return nil, nil
		}
		text, err := media(*value)
		return &text, err
	}
	for _, u := range source.Users {
		u.Highlights.ExpressionNodeIDs = append([]string{}, u.Highlights.ExpressionNodeIDs...)
		alias := u.ID
		u.ID = users[u.ID]
		u.Email = strings.ToLower(strings.TrimSpace(u.Email))
		if !strings.HasSuffix(u.Email, "@example.com") {
			return out, fmt.Errorf("演示用户只能使用 example.com 测试邮箱")
		}
		if strings.TrimSpace(u.Name) == "" || len([]rune(u.Name)) > 30 {
			return out, fmt.Errorf("演示昵称不合法")
		}
		password := passwords.Token()
		if alias == "jo" && mainPassword != "" {
			password = mainPassword
		}
		hash, err := passwords.Hash(password)
		if err != nil {
			return out, err
		}
		u.PasswordHash = hash
		u.Avatar, err = media(u.Avatar)
		if err != nil {
			return out, err
		}
		u.BackgroundImage, err = optionalMedia(u.BackgroundImage)
		if err != nil {
			return out, err
		}
		for i, n := range u.Highlights.ExpressionNodeIDs {
			if nodes[n] == "" {
				return out, fmt.Errorf("精选引用不存在的行动")
			}
			u.Highlights.ExpressionNodeIDs[i] = nodes[n]
		}
		out.Users = append(out.Users, u)
	}
	graphByID := map[string]catalogue.GraphView{}
	for _, g := range source.Graphs {
		if users[g.OwnerID] == "" {
			return out, fmt.Errorf("图创建者不存在")
		}
		g.ID = graphs[g.ID]
		g.OwnerID = users[g.OwnerID]
		g.ParticipantIDs = []string{}
		g.Version = 1
		g.CreatedAt = g.CreatedAt.UTC()
		g.UpdatedAt = g.UpdatedAt.UTC()
		var err error
		g.Avatar, err = optionalMedia(g.Avatar)
		if err != nil {
			return out, err
		}
		g.BackgroundImage, err = optionalMedia(g.BackgroundImage)
		if err != nil {
			return out, err
		}
		out.Graphs = append(out.Graphs, g)
		graphByID[g.ID] = g
	}
	source.Actions = append([]catalogue.ActionView{}, source.Actions...)
	sort.Slice(source.Actions, func(i, j int) bool {
		a, b := source.Actions[i], source.Actions[j]
		if a.GraphID != b.GraphID {
			return a.GraphID < b.GraphID
		}
		return a.Number < b.Number
	})
	prepared := map[string]Node{}
	histories := map[string]map[string]bool{}
	numbers := map[string]map[uint32]bool{}
	for _, view := range source.Actions {
		view.MergedParentIDs = append([]string{}, view.MergedParentIDs...)
		view.Conversation = append([]catalogue.Message{}, view.Conversation...)
		view.Images = append([]catalogue.Image{}, view.Images...)
		originalID := view.ID
		if graphs[view.GraphID] == "" || users[view.AuthorID] == "" {
			return out, fmt.Errorf("行动的图或作者不存在")
		}
		view.ID = nodes[view.ID]
		view.GraphID = graphs[view.GraphID]
		view.AuthorID = users[view.AuthorID]
		view.Version = 1
		view.CreatedAt = view.CreatedAt.UTC()
		if numbers[view.GraphID] == nil {
			numbers[view.GraphID] = map[uint32]bool{}
		}
		if view.Number == 0 || numbers[view.GraphID][view.Number] {
			return out, fmt.Errorf("行动编号重复或为空")
		}
		numbers[view.GraphID][view.Number] = true
		if view.ExpressionSupplement != nil || view.AgreementSupplement != nil || len(view.ExpressionConversation) > 0 {
			return out, fmt.Errorf("源数据含发布后修订，须扩展导入器后再导入，不能静默丢弃")
		}
		if view.ParentID != "" {
			if nodes[view.ParentID] == "" {
				return out, fmt.Errorf("主要来源不存在")
			}
			view.ParentID = nodes[view.ParentID]
		}
		for i, parent := range view.MergedParentIDs {
			if nodes[parent] == "" {
				return out, fmt.Errorf("合入来源不存在")
			}
			view.MergedParentIDs[i] = nodes[parent]
		}
		sources := append([]string{}, view.MergedParentIDs...)
		if view.ParentID != "" {
			sources = append([]string{view.ParentID}, sources...)
		}
		if view.ParentID == "" && (view.Number != 1 || len(sources) > 0) {
			return out, fmt.Errorf("非起点必须指定主要来源")
		}
		history := map[string]bool{}
		seen := map[string]bool{}
		level := uint32(1)
		for _, sourceID := range sources {
			parent, ok := prepared[sourceID]
			if !ok || seen[sourceID] || parent.View.GraphID != view.GraphID || parent.View.Number >= view.Number {
				return out, fmt.Errorf("来源重复、跨图或不是更早行动")
			}
			seen[sourceID] = true
			history[sourceID] = true
			for key := range histories[sourceID] {
				history[key] = true
			}
			if parent.Level >= level {
				level = parent.Level + 1
			}
		}
		guide := graphByID[view.GraphID].ContextGuide
		if view.ContextSnapshot != nil {
			guide = view.ContextSnapshot.Guide
		}
		view.ContextSnapshot = &catalogue.ContextSnapshot{DirectNodeIDs: sources, HistoryNodeCount: uint32(len(history)), Guide: guide}
		if view.ObjectiveMarkdown == "" {
			view.ObjectiveMarkdown = view.Markdown
		}
		if strings.TrimSpace(view.ObjectiveMarkdown) == "" || strings.TrimSpace(view.Title) == "" {
			return out, fmt.Errorf("行动事实或标题为空")
		}
		view.Markdown = view.ObjectiveMarkdown
		if len(view.Conversation) < 2 || view.Conversation[len(view.Conversation)-1].Speaker != "ai" {
			return out, fmt.Errorf("演示行动缺少原始形成对话")
		}
		hasUser := false
		for i, m := range view.Conversation {
			if m.Speaker != "user" && m.Speaker != "ai" {
				return out, fmt.Errorf("对话角色不合法")
			}
			if m.Speaker == "user" {
				hasUser = true
			}
			view.Conversation[i].ID = id.Demo("message", originalID+"/"+m.ID)
		}
		if !hasUser {
			return out, fmt.Errorf("形成对话没有用户消息")
		}
		for i, image := range view.Images {
			address, err := media(image.URL)
			if err != nil {
				return out, err
			}
			view.Images[i].URL = address
		}
		assessments := map[string]catalogue.Assessment{}
		for _, a := range view.ReferenceAgreements {
			sourceID := nodes[a.SourceID]
			if sourceID == "" || !seen[sourceID] {
				return out, fmt.Errorf("约定核对不属于直接来源")
			}
			a.SourceID = sourceID
			assessments[sourceID] = a
		}
		node := Node{View: view, Level: level}
		parent := prepared[view.ParentID]
		for _, kind := range []string{"expression", "agreement"} {
			text := view.ExpressionMarkdown
			previous := parent.EffectiveExpressionUUID
			if kind == "agreement" {
				text = view.AgreementMarkdown
				previous = parent.EffectiveAgreementUUID
			}
			if text == nil && view.ParentID == "" {
				empty := ""
				text = &empty
			}
			mode, effective, local := "inherit", previous, (*string)(nil)
			if text != nil {
				mode = "update"
				if strings.TrimSpace(*text) == "" {
					mode = "clear"
					empty := ""
					text = &empty
				}
				uuid := id.Demo("document", originalID+"/"+kind+"/1")
				local = &uuid
				effective = local
				node.Documents = append(node.Documents, Document{uuid, kind, mode, *text, previous})
			}
			if kind == "expression" {
				node.ExpressionMode = mode
				node.LocalExpressionUUID = local
				node.EffectiveExpressionUUID = effective
				node.View.ExpressionMarkdown = text
			} else {
				node.AgreementMode = mode
				node.LocalAgreementUUID = local
				node.EffectiveAgreementUUID = effective
				node.View.AgreementMarkdown = text
			}
		}
		node.View.ReferenceAgreements = []catalogue.Assessment{}
		for i, sourceID := range sources {
			parent := prepared[sourceID]
			agreement := parent.EffectiveAgreementUUID
			status := "unreviewed"
			kind := "merged"
			if i == 0 {
				kind = "primary"
			}
			var reason *string
			assessment := assessments[sourceID]
			assessment.SourceID = sourceID
			if agreement == nil || documentIsClear(prepared, *agreement) {
				status = "unrestricted"
				assessment.Complies = nil
			} else if assessment.Complies != nil {
				if *assessment.Complies {
					status = "satisfied"
				} else {
					status = "exception"
					reason = assessment.ExceptionReason
					if reason == nil || strings.TrimSpace(*reason) == "" {
						return out, fmt.Errorf("不满足约定必须说明原因")
					}
				}
			}
			out.References = append(out.References, Reference{id.Demo("reference", sourceID+"/"+view.ID), view.GraphID, sourceID, view.ID, kind, agreement, status, reason})
			node.View.ReferenceAgreements = append(node.View.ReferenceAgreements, assessment)
		}
		prepared[view.ID] = node
		histories[view.ID] = history
		out.Nodes = append(out.Nodes, node)
	}
	for _, u := range out.Users {
		if len(u.Highlights.ExpressionNodeIDs) > 5 {
			return out, fmt.Errorf("精选超过五个")
		}
		selected := map[string]bool{}
		for _, uuid := range u.Highlights.ExpressionNodeIDs {
			node, ok := prepared[uuid]
			if !ok || selected[uuid] || node.View.AuthorID != u.ID || node.EffectiveExpressionUUID == nil {
				return out, fmt.Errorf("精选不是本人分支的有效表达")
			}
			selected[uuid] = true
			owned := false
			for _, origin := range prepared {
				for _, doc := range origin.Documents {
					if doc.UUID == *node.EffectiveExpressionUUID {
						owned = origin.View.AuthorID == u.ID && doc.Mode == "update"
					}
				}
			}
			if !owned {
				return out, fmt.Errorf("精选表达来源不属于本人或已清空")
			}
		}
	}
	out.Following = catalogue.FollowingView{UserIDs: []string{}, GraphIDs: []string{}}
	for _, value := range source.Following.UserIDs {
		if users[value] == "" {
			return out, fmt.Errorf("关注用户不存在")
		}
		out.Following.UserIDs = append(out.Following.UserIDs, users[value])
	}
	for _, value := range source.Following.GraphIDs {
		if graphs[value] == "" {
			return out, fmt.Errorf("关注图不存在")
		}
		out.Following.GraphIDs = append(out.Following.GraphIDs, graphs[value])
	}
	return out, nil
}

func documentIsClear(nodes map[string]Node, uuid string) bool {
	for _, n := range nodes {
		for _, d := range n.Documents {
			if d.UUID == uuid {
				return d.Mode == "clear"
			}
		}
	}
	return false
}
