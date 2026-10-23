import { MessageSquarePlus, Pencil } from 'lucide-react'

type EditExpressionProps = {
  markdown: string
  onOpen: () => void
}

/** 打开带行动背景的 AI 对话来修改表达，保留形成过程，不直接在详情中改写正文。 */
export function EditExpression({ markdown, onOpen }: EditExpressionProps) {
  const hasContent = Boolean(markdown.trim())
  const label = hasContent ? '修改表达' : '补充表达'
  const Icon = hasContent ? Pencil : MessageSquarePlus
  return <button className="quiet-button" type="button" onClick={onOpen}><Icon size={16} />{label}</button>
}
