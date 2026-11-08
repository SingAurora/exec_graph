/** AI 对话输入框的字符上限与最大高度，前后端共同保持 1000 字口径。 */
export const CHAT_INPUT_LIMIT = 1000
export const CHAT_INPUT_MAX_HEIGHT = 128

/** 输入框随内容增高，到上限后固定高度并由 overflow-y 显示滚动条。 */
export function resizeChatInput(element: Pick<HTMLTextAreaElement, 'scrollHeight' | 'style'> | null): void {
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${Math.min(element.scrollHeight, CHAT_INPUT_MAX_HEIGHT)}px`
}

/** 回车发送，Shift+回车换行；输入法组合中的回车不发送。 */
export function shouldSendChatOnEnter(key: string, shiftKey: boolean, composing = false): boolean {
  return key === 'Enter' && !shiftKey && !composing
}
