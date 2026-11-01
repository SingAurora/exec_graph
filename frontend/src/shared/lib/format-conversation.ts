/** 复制对话时使用的最小消息结构；不绑定具体实体或完整业务模型。 */
export type ConversationCopyMessage = {
  speaker: 'ai' | 'user'
  body: string
  model?: string
  authorId?: string
}

/**
 * 按“名称：\n正文”拼接对话。AI 名称优先使用该条回复实际使用的模型名，
 * 旧记录没有模型时回退到通用名称；用户名称由调用方按当前页面数据解析。
 */
export function formatConversationForCopy(
  messages: readonly ConversationCopyMessage[],
  options: { resolveUserName: (message: ConversationCopyMessage) => string; fallbackAIName?: string },
): string {
  const fallbackAIName = options.fallbackAIName?.trim() || '引序 AI'
  return messages.map((message) => {
    const name = message.speaker === 'user'
      ? options.resolveUserName(message)
      : message.model?.trim() || fallbackAIName
    return `${name}：\n${message.body}`
  }).join('\n\n')
}
