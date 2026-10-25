package bootstrap

import (
	"sync"
	"testing"

	app "github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/graph"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func concurrent(t *testing.T, requests ...func() (commandResponse, error)) []commandResponse {
	t.Helper()
	var group sync.WaitGroup
	results, errors := make([]commandResponse, len(requests)), make([]error, len(requests))
	start := make(chan struct{})
	for i, request := range requests {
		group.Add(1)
		go func(i int, request func() (commandResponse, error)) {
			defer group.Done()
			<-start
			results[i], errors[i] = request()
		}(i, request)
	}
	close(start)
	group.Wait()
	for _, err := range errors {
		if err != nil {
			t.Fatal(err)
		}
	}
	return results
}

func statuses(t *testing.T, results []commandResponse, ok, conflict int) {
	t.Helper()
	for _, result := range results {
		if result.status == 200 {
			ok--
		} else if result.status == 409 {
			conflict--
		} else {
			t.Fatalf("并发请求返回 HTTP %d code=%d", result.status, result.code)
		}
	}
	if ok != 0 || conflict != 0 {
		t.Fatal("并发成功与冲突数量错误")
	}
}

func TestRealConcurrentWrites(t *testing.T) {
	s := writeFixture(t)
	joID, linID := id.Demo("user", "jo"), id.Demo("user", "lin")
	jo, lin := s.as(t, joID), s.as(t, linID)
	clear, inherit := app.DocumentUpdate{Mode: "clear"}, app.DocumentUpdate{Mode: "inherit"}
	key := id.New()
	create := graph.CreateGraphInput{Title: "并发幂等", Description: ""}
	results := concurrent(t,
		func() (commandResponse, error) { return jo.send("POST", "graphs/create", create, key) },
		func() (commandResponse, error) { return jo.send("POST", "graphs/create", create, key) },
	)
	statuses(t, results, 2, 0)
	first, second := decode[catalogue.GraphView](t, results[0].data), decode[catalogue.GraphView](t, results[1].data)
	if first.ID != second.ID {
		t.Fatal("并发同提交创建了两个图")
	}
	rootJo := s.draft(t, joID, first.ID, "", nil, clear, clear)
	rootLin := s.draft(t, linID, first.ID, "", nil, clear, clear)
	joKey, linKey := id.New(), id.New()
	results = concurrent(t,
		func() (commandResponse, error) { return jo.send("POST", "actions/create", rootJo, joKey) },
		func() (commandResponse, error) { return lin.send("POST", "actions/create", rootLin, linKey) },
	)
	statuses(t, results, 1, 1)
	var root catalogue.ActionView
	for _, result := range results {
		if result.status == 200 {
			root = decode[catalogue.ActionView](t, result.data)
		}
	}
	var count int64
	mustDB(t, s.deps.DB.Model(&model.ActionNode{}).Where("graph_uuid = ?", first.ID).Count(&count))
	if count != 1 || root.Number != 1 {
		t.Fatal("并发首次行动突破单起点约束")
	}
	updateJo := app.UpdateAgreementInput{NodeID: root.ID, ExpectedVersion: 1, Document: app.DocumentUpdate{Mode: "update", Markdown: str("乔关心的条件")}}
	updateLin := app.UpdateAgreementInput{NodeID: root.ID, ExpectedVersion: 1, Document: app.DocumentUpdate{Mode: "update", Markdown: str("林关心的条件")}}
	results = concurrent(t,
		func() (commandResponse, error) { return jo.send("POST", "agreements/update", updateJo, "") },
		func() (commandResponse, error) { return lin.send("POST", "agreements/update", updateLin, "") },
	)
	statuses(t, results, 1, 1)
	root = decode[catalogue.ActionView](t, jo.call(t, "GET", "actions/detail?nodeId="+root.ID, nil, 200, ""))
	if root.Version != 2 {
		t.Fatal("并发更新导致版本丢失")
	}
	child := s.draft(t, joID, first.ID, "", []string{root.ID}, inherit, inherit)
	childKey := id.New()
	edit := app.UpdateAgreementInput{NodeID: root.ID, ExpectedVersion: 2, Document: clear}
	results = concurrent(t,
		func() (commandResponse, error) { return jo.send("POST", "actions/create", child, childKey) },
		func() (commandResponse, error) { return lin.send("POST", "agreements/update", edit, "") },
	)
	statuses(t, results, 1, 1)
	// 发布先赢则终点修改拒绝；修改先赢则来源版本过期，二者不能同时提交。
	if results[0].status == 200 {
		published := decode[catalogue.ActionView](t, results[0].data)
		if published.Number != 2 {
			t.Fatal("并发引用分配编号错误")
		}
	} else {
		assertUnpublished(t, s, child.GenerationID, first.ID, 2)
	}
}
