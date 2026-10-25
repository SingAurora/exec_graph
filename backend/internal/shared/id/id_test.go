package id

import "testing"

func TestPublicAndDemoIdentities(t *testing.T) {
	if !Valid(New()) {
		t.Fatal("新 UUID 不合法")
	}
	if Demo("user", "jo") != Demo("user", "jo") {
		t.Fatal("重跑导入不能改变身份")
	}
	if Demo("user", "jo") == Demo("graph", "jo") {
		t.Fatal("资源领域必须隔离")
	}
	if !Valid(Demo("action", "cooking-13")) {
		t.Fatal("演示映射不是合法 UUID")
	}
	if Valid("cooking-13") || Valid("1") {
		t.Fatal("短 ID 不能成为公开 UUID")
	}
}
