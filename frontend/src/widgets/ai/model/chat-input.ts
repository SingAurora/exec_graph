/** AI 对话输入框的字符上限与最大高度，前后端共同保持 500 字口径。 */
export const CHAT_INPUT_LIMIT = 500
export const CHAT_INPUT_MAX_HEIGHT = 128

/** 输入框随内容增高，到上限后固定高度并由 overflow-y 显示滚动条。 */
export function resizeChatInput(element: Pick<HTMLTextAreaElement, 'scrollHeight' | 'style'> | null): void {
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${Math.min(element.scrollHeight, CHAT_INPUT_MAX_HEIGHT)}px`
}
