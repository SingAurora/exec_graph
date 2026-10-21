/** Local edits remain separate from the published or inherited agreement. */
export type AgreementDraft = { markdown: string; clearing: boolean; baseMarkdown: string }

/** Accepts only complete agreement drafts, including a pending explicit clear. */
export function isAgreementDraft(value: unknown): value is AgreementDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<AgreementDraft>
  return typeof draft.markdown === 'string' && typeof draft.clearing === 'boolean' && typeof draft.baseMarkdown === 'string'
}
