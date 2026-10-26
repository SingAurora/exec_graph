package storage

import (
	"context"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestManagedObjectBoundaryAndDisabledStorage(t *testing.T) {
	s, err := New(config.ObjectStorage{MediaPrefix: "exec-graph/test/media"}, config.Credentials{})
	if err != nil {
		t.Fatal(err)
	}
	uuid := id.New()
	for _, key := range []string{"demo/v1/demo-cycling.jpg", "avatars/old.jpg", "exec-graph/test/media/../" + uuid + ".jpg", "exec-graph/test/media/nested/" + uuid + ".jpg", "exec-graph/test/media/" + uuid + ".svg", "exec-graph/test/media/" + uuid + ".jpg?x=1"} {
		if s.managed(key) {
			t.Fatalf("越界键被允许: %s", key)
		}
		if err := s.Delete(context.Background(), key); err == nil {
			t.Fatal("禁用存储仍允许删除")
		}
	}
	if !s.managed("exec-graph/test/media/" + uuid + ".webp") {
		t.Fatal("有效键被拒绝")
	}
	if _, err := s.Key(uuid, "png"); err == nil {
		t.Fatal("禁用存储仍允许上传")
	}
	if _, err := s.Read(context.Background(), "demo/v1/demo-cycling.jpg"); err != nil {
		t.Fatal(err)
	}
	if _, err := New(config.ObjectStorage{MediaPrefix: "demo/v1"}, config.Credentials{}); err == nil {
		t.Fatal("上传前缀与演示目录重叠")
	}
}
