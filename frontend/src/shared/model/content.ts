/** An image URL and its accompanying description, shared by previews and Markdown. */
export type PostImage = {
  assetId?: string
  url: string
  alt: string
}

/** A single user or AI turn, independent from the document it helps create. */
export type ChatMessage = {
  id: string
  speaker: 'ai' | 'user'
  body: string
  /** AI 回复实际使用的平台模型名；旧记录或非模型提示没有该字段。 */
  model?: string
}
