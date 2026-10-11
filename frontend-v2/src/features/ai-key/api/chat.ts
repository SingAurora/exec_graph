import type { AIKeyConfig } from '../../../entities/ai-key/model/types'
import { postJSON } from '../../../shared/api/client'

export type AIWorkspaceMode = 'planning' | 'completion'

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
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>
}

type ChatCompletionRequest = {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature: number
  response_format: { type: 'json_object' }
}

/** Uses the active OpenAI-compatible configuration to update an AI-owned document. */
export async function generateAIDocument(input: {
  config: AIKeyConfig
  mode: AIWorkspaceMode
  turns: AIConversationTurn[]
  currentDocument: string
  plan?: { title: string; description: string; points: string[] }
}): Promise<AIDocumentResult> {
  if (input.config.provider !== 'deepseek') throw new Error('演示页目前只接入了固定的 DeepSeek 配置。')

  const payload = await postJSON<ChatCompletionResponse, ChatCompletionRequest>('/deepseek-api/v1/chat/completions', {
    model: input.config.model,
    messages: [
      { role: 'system', content: buildSystemPrompt(input.mode, input.currentDocument, input.plan) },
      ...input.turns,
    ],
    temperature: 0.35,
    response_format: { type: 'json_object' },
  }, { headers: input.config.apiKey ? { Authorization: `Bearer ${input.config.apiKey}` } : undefined })
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 没有返回可用内容，请再试一次。')
  return parseDocumentResult(content)
}

function buildSystemPrompt(mode: AIWorkspaceMode, currentDocument: string, plan?: { title: string; description: string; points: string[] }) {
  const task = mode === 'planning'
    ? '帮助用户理清要做的事情，并生成一份可执行的计划 Markdown。你不是裁判，不评价用户是否做得好。'
    : '帮助用户如实整理实际完成的事情，并生成一份完成记录 Markdown。你不是裁判，不替用户证明完成，也不要把未发生的事情写成已完成。'
  const shape = mode === 'planning'
    ? '{"reply":"给用户的简短回应","document":"# 标题\\n\\n## 目标...","details":{"title":"标题","description":"目标描述","points":["重点一"],"note":""}}'
    : '{"reply":"给用户的简短回应","document":"# 标题：完成记录\\n\\n## 原计划...","details":{"title":"标题","description":"原计划描述","points":["原计划重点"],"note":"实际发生的事情"}}'
  const context = [
    plan ? `原计划：${JSON.stringify(plan)}` : '',
    currentDocument ? `当前文档：\n${currentDocument}` : '',
  ].filter(Boolean).join('\n\n')

  return `${task}\n每轮都要根据完整对话返回更新后的整份文档。只输出合法 JSON，不要使用 Markdown 代码围栏。JSON 结构必须是：${shape}\nreply 应简短自然；document 必须是完整 Markdown；details 必须与 document 内容一致。不要编造用户没有表达的事实。\n\n${context}`
}

function parseDocumentResult(content: string): AIDocumentResult {
  const clean = content.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('AI 返回的文档格式不完整，请重新发送。')
  }
  if (!isDocumentResult(parsed)) throw new Error('AI 返回的文档缺少必要内容，请重新发送。')
  return parsed
}

function isDocumentResult(value: unknown): value is AIDocumentResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<AIDocumentResult>
  const details = result.details as Partial<AIDocumentDetails> | undefined
  return typeof result.reply === 'string'
    && typeof result.document === 'string'
    && Boolean(result.document.trim())
    && typeof details?.title === 'string'
    && typeof details.description === 'string'
    && Array.isArray(details.points)
    && details.points.every((point) => typeof point === 'string')
    && typeof details.note === 'string'
}
