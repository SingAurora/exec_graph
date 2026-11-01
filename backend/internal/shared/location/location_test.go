package location

import "testing"

func TestLookupMainlandDistrict(t *testing.T) {
	value, ok := Lookup("350206")
	if !ok {
		t.Fatal("厦门市湖里区应该存在")
	}
	if value.Province != "福建省" || value.City != "厦门市" || value.District != "湖里区" {
		t.Fatalf("地址解析错误: %+v", value)
	}
	if _, ok := Lookup("810001"); ok {
		t.Fatal("香港地址不应出现在中国大陆行政区划中")
	}
	if _, ok := Lookup(""); ok {
		t.Fatal("空地址代码不应通过校验")
	}
}
