/** A direct source's effective conditions supplied to an action-generation conversation. */
export type AIActionSourceAgreement = { nodeNumber: number; markdown: string }

/** Keeps incoming obligations distinct from the agreement this action passes to future references. */
export function buildActionAgreementContext(sources: AIActionSourceAgreement[] = [], downstreamAgreement?: string): string {
  const conditions = sources.filter((source) => source.markdown.trim())
  return [
    conditions.length ? `本次引用需要核对的来源约定（继承后的有效版本）：\n${conditions.map((source) => `节点 #${source.nodeNumber}：\n${source.markdown}`).join('\n\n')}\n在对话中核对这些要求，并用于整理行动记录和表达。缺少的信息应询问或明确保留为未知，不得为了满足约定编造行动事实；没有核对不能宣称满足。不满足约定仍可引用，记录不符合的原因并在引用连线上标记 ×，无需申请或等待来源作者同意。` : '',
    downstreamAgreement !== undefined ? `本节点向后传递的约定：\n${downstreamAgreement.trim() || '无约定'}\n这项设置用于后续引用，不会替代或取消本次引用的来源约定。` : '',
  ].filter(Boolean).join('\n\n')
}
