import { MessageSquarePlus, Pencil } from 'lucide-react'

type EditExpressionProps = {
  markdown: string
  onOpen: () => void
}

/** Opens the contextual AI dialogue instead of editing a published expression inline. */
export function EditExpression({ markdown, onOpen }: EditExpressionProps) {
  const hasContent = Boolean(markdown.trim())
  const label = hasContent ? '修改表达' : '补充表达'
  const Icon = hasContent ? Pencil : MessageSquarePlus
  return <button className="quiet-button" type="button" onClick={onOpen}><Icon size={16} />{label}</button>
}
