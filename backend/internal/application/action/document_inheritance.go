package action

// inheritedDocumentIDs 返回主要来源的已发布表达/约定版本；合入来源不覆盖主要来源。
func inheritedDocumentIDs(sources []GenerationSource) (string, string) {
	if len(sources) == 0 {
		return "", ""
	}
	return sources[0].ExpressionID, sources[0].AgreementID
}
