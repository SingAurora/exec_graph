package action

import "testing"

const (
	testImageOne = "11111111-1111-4111-8111-111111111111"
	testImageTwo = "22222222-2222-4222-8222-222222222222"
)

func TestValidateGenerationImagesMatchesBodyOrder(t *testing.T) {
	markdown := "正文\n\n![成品](asset:" + testImageOne + ")\n\n![过程](asset:" + testImageTwo + ")"
	images := []ImageInput{{AssetID: testImageOne, Alt: "成品"}, {AssetID: testImageTwo, Alt: "过程"}}
	if err := validateGenerationImages(markdown, images); err != nil {
		t.Fatal(err)
	}
	if err := validateGenerationImages(markdown, []ImageInput{{AssetID: testImageTwo, Alt: "过程"}, {AssetID: testImageOne, Alt: "成品"}}); err == nil {
		t.Fatal("图片顺序不一致被接受")
	}
	if err := validateGenerationImages(markdown, images[:1]); err == nil {
		t.Fatal("图片数量不一致被接受")
	}
}
