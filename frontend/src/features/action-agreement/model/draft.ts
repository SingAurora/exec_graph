/** 约定的本地编辑内容，与已发布或继承的正文分开保存。 */
export type AgreementDraft = { markdown: string; clearing: boolean; baseMarkdown: string }

/** 恢复时校验完整草稿结构，允许尚待提交的主动清空。 */
export function isAgreementDraft(value: unknown): value is AgreementDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<AgreementDraft>
  return typeof draft.markdown === 'string' && typeof draft.clearing === 'boolean' && typeof draft.baseMarkdown === 'string'
}
