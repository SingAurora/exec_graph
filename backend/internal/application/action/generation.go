package action

import "github.com/singaurora/exec-graph/backend/internal/shared/fault"

func validateGeneration(g Generation, actorID string) error {
	if g.RequesterID != actorID {
		return fault.New(fault.Forbidden, "不能确认他人的生成结果")
	}
	if g.Status != "succeeded" || g.Confirmed || !g.Completed || !g.HasExpression || g.Output == nil || g.ConversationGraphID != g.GraphID {
		return fault.New(fault.Conflict, "生成尚未成功、已确认或数据不完整")
	}
	for _, source := range g.Sources {
		if source.GraphID != g.GraphID {
			return fault.New(fault.Conflict, "生成来源跨越图边界")
		}
	}
	bad := func() error {
		return fault.New(fault.Conflict, "生成对话不连续或已有新消息，请重新生成")
	}
	output := g.Output
	if output.ConversationID != g.ConversationID || output.Speaker != "ai" || output.Sequence != g.InputThroughSequence+1 || g.NextMessageSequence != output.Sequence+1 || output.Confirmed {
		return bad()
	}
	if len(g.Messages) == 0 || len(g.Messages) != len(g.UsedMessages) {
		return bad()
	}
	last := g.Messages[len(g.Messages)-1]
	if last.Speaker != "user" || last.AuthorID != actorID || last.Sequence != g.InputThroughSequence {
		return bad()
	}
	for i, message := range g.Messages {
		used := g.UsedMessages[i]
		if message.Sequence != uint32(i+1) || used.ConversationID != g.ConversationID || used.MessageID != message.ID || used.Position != uint32(i+1) {
			return bad()
		}
	}
	return nil
}
