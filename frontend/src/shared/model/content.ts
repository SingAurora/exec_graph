/** An image URL and its accompanying description, shared by previews and Markdown. */
export type PostImage = {
  url: string
  alt: string
}

/** A single user or AI turn, independent from the document it helps create. */
export type ChatMessage = {
  id: string
  speaker: 'ai' | 'user'
  body: string
}
