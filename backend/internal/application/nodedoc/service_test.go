package nodedoc

import "testing"

func TestParseRequiresBothNodeDocuments(t *testing.T) {
	got, err := parse(`{"expression":"这条分支在练习控火。","agreement":"记录实际火候。\n记录食材状态。"}`)
	if err != nil || got.Expression == "" || got.Agreement == "" {
		t.Fatalf("有效文档被拒绝: %+v %v", got, err)
	}
	for _, content := range []string{
		`{"expression":"只有表达","agreement":""}`,
		`{"expression":"","agreement":"只有约定"}`,
		`{"expression":"表达","agreement":"约定","unknown":true}`,
		`not json`,
	} {
		if _, err := parse(content); err == nil {
			t.Fatalf("无效文档被接受: %s", content)
		}
	}
}
