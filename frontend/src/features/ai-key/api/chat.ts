import { requestAICompletion } from './completion'
import { buildActionAgreementContext, type AIActionSourceAgreement } from '../lib/action-agreement-context'
import type { ActionDocumentUpdateMode, ActionExpressionContext } from '../../../entities/action/model/types'
import { buildActionExpressionContext } from '../lib/action-expression-context'
import { readActionAgreementReviews, type AIActionAgreementReview } from '../lib/action-agreement-review'

export type AIWorkspaceMode = 'planning' | 'completion' | 'action' | 'expression'

export type AIConversationTurn = {
  role: 'user' | 'assistant'
  content: string
}

export type AIDocumentDetails = {
  title: string
  description: string
  points: string[]
  note: string
}

export type AIDocumentResult = {
  reply: string
  document: string
  details: AIDocumentDetails
  expression?: { mode: ActionDocumentUpdateMode; markdown: string }
  agreementReviews?: AIActionAgreementReview[]
}

/** 组合系统规则、引用事实和连续对话，请求 AI 返回结构化文档及约定核对；不负责业务发布。 */
export async function generateAIDocument(input: {
  mode: AIWorkspaceMode
  turns: AIConversationTurn[]
  currentDocument: string
  contextGuide?: string
  sourceAgreements?: AIActionSourceAgreement[]
  downstreamAgreement?: string
  expressionContext?: ActionExpressionContext
  inheritedExpression?: string
  currentExpression?: AIDocumentResult['expression']
  hasParent?: boolean
  historyFacts?: ActionExpressionContext['facts']
  plan?: { title: string; description: string; points: string[] }
  planMarkdown?: string
}): Promise<AIDocumentResult> {
  if (input.mode === 'expression' && !input.expressionContext) throw new Error('缺少表达的行动背景，请返回节点重试。')

  const payload = await requestAICompletion([
      { role: 'system', content: [
        buildSystemPrompt(input.mode, input.currentDocument, input.plan, input.planMarkdown, input.contextGuide),
        input.mode === 'action' || input.mode === 'expression' ? buildActionAgreementContext(input.sourceAgreements, input.downstreamAgreement) : '',
        input.mode === 'expression' && input.expressionContext ? buildActionExpressionContext(input.expressionContext) : '',
        input.mode === 'action' ? `这是同一条连续对话，同时维护行动文档和表达文档。${input.hasParent ? '有承接节点，未要求修改表达时默认继承。' : '没有承接节点，表达默认留空，不可继承。'}\n上游有效表达：\n${input.inheritedExpression || '空'}\n当前表达草稿：${JSON.stringify(input.currentExpression ?? { mode: input.hasParent ? 'inherit' : 'clear', markdown: '' })}\n用户没有表达观点时不要替用户发明观点；保留已有表达选择，明确要求修改或清空时再变更。更新表达时返回完整 Markdown，继承或清空时 markdown 返回空字符串。行动事实与观点分别写入两份文档。` : '',
        input.mode === 'action' ? `引用的已知历史行动：${JSON.stringify(input.historyFacts ?? [])}\n只有这些引用历史和当前用户报告的行动可以作为事实背景。引用背景以本轮提供的列表为准，先前对话或草稿中的已移除来源不能继续作为已知历史事实；相应内容需要重新核实或移除。其他分支不可当作已知事实，不得将其他行动者的经历记为本次用户亲自完成。` : '',
        input.mode === 'action' ? 'agreementReviews 逐项返回本次直接引用来源中非空约定的核对结果，每项为 {"nodeNumber":来源节点编号,"complies":true或false或null,"reason":"不符合的具体原因"}。事实足够且全部符合时为 true；已明确不符合时为 false 且必须说明原因；缺少信息或尚未核对时为 null，不得默认满足。只核对本次直接来源的有效约定，不叠加祖先旧版本。本节点后续约定的修改不影响核对结果。不符合不阻止发布，无需申请同意。没有来源约定时返回空数组。' : '',
      ].filter(Boolean).join('\n\n') },
      ...input.turns,
    ], true)
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 没有返回可用内容，请再试一次。')
  const result = parseDocumentResult(content, input.mode)
  if (input.mode === 'action' && !input.hasParent && result.expression?.mode === 'inherit') throw new Error('首次行动不能继承表达，请重新整理。')
  if (input.mode === 'action') result.agreementReviews = readActionAgreementReviews(result.agreementReviews, input.sourceAgreements ?? [])
  return result
}

function buildSystemPrompt(mode: AIWorkspaceMode, currentDocument: string, plan?: { title: string; description: string; points: string[] }, planMarkdown?: string, contextGuide?: string) {
  const task = mode === 'expression'
    ? '通过与用户对话，基于当前节点及引用历史中的行动事实更新表达 Markdown。只整理表达，不生成或改写行动记录。'
    : mode === 'action'
    ? '在一条连续的对话中，帮助用户如实整理已经发生的一次行动，并基于当前行动与引用背景整理用户的表达，分别生成行动和表达两份 Markdown。不要把聊天拆成两个阶段或要求用户重新开始；可以一起讨论事实和看法，缺少信息时追问。不要替用户设定目标，也不要要求行动必须成功。保留过程、结果、失败和观察。'
    : mode === 'planning'
    ? '帮助用户理清要做的事情，并生成一份可执行的计划 Markdown。你不是裁判，不评价用户是否做得好。'
    : '基于计划 Markdown 和前面的连续对话，帮助用户如实整理实际完成的事情，并生成一份完成记录 Markdown。保留计划作为上下文，再补充实际结果、未完成部分和后续观察。你不是裁判，不替用户证明完成，也不要把未发生的事情写成已完成。'
  const shape = mode === 'expression'
    ? '{"reply":"给用户的简短回应","document":"完整表达 Markdown，明确清空时为空字符串","details":{"title":"表达标题","description":"表达摘要","points":[],"note":""}}'
    : mode === 'action'
    ? '{"reply":"给用户的简短回应","document":"# 行动标题\\n\\n行动经过和结果...","expression":{"mode":"inherit 或 update 或 clear","markdown":"更新时为完整表达 Markdown，继承或清空时为空字符串"},"agreementReviews":[],"details":{"title":"行动标题","description":"行动摘要","points":["实际发生的一点"],"note":""}}'
    : mode === 'planning'
    ? '{"reply":"给用户的简短回应","document":"# 标题\\n\\n## 目标...","details":{"title":"标题","description":"目标描述","points":["重点一"],"note":""}}'
    : '{"reply":"给用户的简短回应","document":"# 标题：完成记录\\n\\n## 原计划...","details":{"title":"标题","description":"原计划描述","points":["原计划重点"],"note":"实际发生的事情"}}'
  const context = [
    plan ? `原计划：${JSON.stringify(plan)}` : '',
    planMarkdown ? `计划 Markdown：\n${planMarkdown}` : '',
    currentDocument ? `当前文档：\n${currentDocument}` : '',
    contextGuide ? `行动图指引（只约束整理方向，不得改写用户未表达的事实）：\n${contextGuide}` : '',
  ].filter(Boolean).join('\n\n')

  return `${task}\n每轮都要根据完整对话返回更新后的整份文档。只输出合法 JSON，不要使用 Markdown 代码围栏。JSON 结构必须是：${shape}\nreply 应简短自然；document 必须是完整 Markdown；details 必须与 document 内容一致。不要编造用户没有表达的事实。\n\n${context}`
}

function parseDocumentResult(content: string, mode: AIWorkspaceMode): AIDocumentResult {
  const clean = content.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('AI 返回的文档格式不完整，请重新发送。')
  }
  if (!isDocumentResult(parsed, mode === 'expression')) throw new Error('AI 返回的文档缺少必要内容，请重新发送。')
  if (mode === 'action') {
    const expression = parsed.expression
    if (!expression || !['inherit', 'update', 'clear'].includes(expression.mode) || typeof expression.markdown !== 'string'
      || (expression.mode === 'update' ? !expression.markdown.trim() : Boolean(expression.markdown.trim()))) {
      throw new Error('AI 返回的表达格式不完整，请重新发送。')
    }
  }
  return parsed
}

function isDocumentResult(value: unknown, allowEmptyDocument: boolean): value is AIDocumentResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<AIDocumentResult>
  const details = result.details as Partial<AIDocumentDetails> | undefined
  return typeof result.reply === 'string'
    && typeof result.document === 'string'
    && (allowEmptyDocument || Boolean(result.document.trim()))
    && typeof details?.title === 'string'
    && typeof details.description === 'string'
    && Array.isArray(details.points)
    && details.points.every((point) => typeof point === 'string')
    && typeof details.note === 'string'
}
