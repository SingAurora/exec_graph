package action

import "testing"

func completeGeneration() Generation {
	return Generation{ID: "generation", GraphID: "graph", RequesterID: "actor", Status: "succeeded", Completed: true, HasExpression: true, ConversationID: "conversation", ConversationGraphID: "graph", NextMessageSequence: 3, InputThroughSequence: 1,
		Output:       &ConversationMessage{ID: "reply", ConversationID: "conversation", Sequence: 2, Speaker: "ai"},
		Messages:     []ConversationMessage{{ID: "input", ConversationID: "conversation", Sequence: 1, Speaker: "user", AuthorID: "actor"}},
		UsedMessages: []GenerationInput{{MessageID: "input", ConversationID: "conversation", Position: 1}},
		Sources:      []GenerationSource{{GraphID: "graph", NodeID: "source"}},
	}
}

func TestGenerationConfirmationRejectsChangedOrIncompleteEvidence(t *testing.T) {
	if err := validateGeneration(completeGeneration(), "actor"); err != nil {
		t.Fatal(err)
	}
	for name, mutate := range map[string]func(*Generation){
		"other requester":          func(g *Generation) { g.RequesterID = "other" },
		"not completed":            func(g *Generation) { g.Completed = false },
		"already confirmed":        func(g *Generation) { g.Confirmed = true },
		"pending output":           func(g *Generation) { g.Status = "pending" },
		"different graph":          func(g *Generation) { g.Sources[0].GraphID = "other" },
		"different input author":   func(g *Generation) { g.Messages[0].AuthorID = "other" },
		"missing original input":   func(g *Generation) { g.UsedMessages = nil },
		"replaced input":           func(g *Generation) { g.UsedMessages[0].MessageID = "forged" },
		"later dialogue":           func(g *Generation) { g.NextMessageSequence++ },
		"wrong output":             func(g *Generation) { g.Output.Speaker = "user" },
		"output already published": func(g *Generation) { g.Output.Confirmed = true },
	} {
		t.Run(name, func(t *testing.T) {
			g := completeGeneration()
			mutate(&g)
			if err := validateGeneration(g, "actor"); err == nil {
				t.Fatal("不完整或已变化的生成不应确认为公开事实")
			}
		})
	}
}
