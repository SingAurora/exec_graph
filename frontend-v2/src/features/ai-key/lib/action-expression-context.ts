import type { ActionExpressionContext } from '../../../entities/action/model/types'

/** Constrains expression revision to the existing action context instead of inventing another action. */
export function buildActionExpressionContext(context: ActionExpressionContext): string {
  return [
    `正在修改节点 #${context.nodeNumber} 的表达，不是记录新行动。行动正文、节点关系和约定均不可修改。`,
    '已知执行事实只有以下当前行动和已引用的历史行动。没有引用的其他分支不属于背景；表达和聊天中的看法不能当作已验证事实。用户提及新的行动事实时应建议另行接续行动，不得写成本节点已经完成的事情。',
    '基于这些事实、当前有效表达和连续对话整理用户的看法，不替用户发明观点，不为了满足约定编造事实。缺少信息时先询问。只有用户明确要求清空表达时，document 才可返回空字符串；否则返回完整表达 Markdown。',
    '各节点保留各自的行动者，不能把他人的行动改写为本节点作者亲自完成。',
    ...context.facts.map((fact) => `节点 #${fact.number}（行动者 ${fact.authorId}）：${fact.title}\n${fact.markdown}`),
  ].join('\n\n')
}
