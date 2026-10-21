import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { guessTitle, inferFocusPoints } from '../../features/action/lib/planning'
import type { Action } from '../../shared/model'

type ActionComposerProps = { onCreate: (action: Action) => void }

export function ActionComposer({ onCreate }: ActionComposerProps) {
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<{ title: string; points: string[] } | null>(null)

  const review = (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    setDraft({ title: guessTitle(text), points: inferFocusPoints(text) })
  }

  const create = () => {
    if (!draft) return
    onCreate({ id: `action-${Date.now()}`, title: draft.title, description: text.trim(), points: draft.points, createdAt: '刚刚' })
    setText('')
    setDraft(null)
  }

  return <section className="pt-[38px]" aria-labelledby="composer-title">
    <div className="section-kicker">现在</div><h2 id="composer-title" className="mt-[7px] text-[23px] tracking-[-.03em]">今天想推进什么？</h2>
    <p className="mt-2 text-[13px] text-muted">说一件具体的事，AI 只帮你抓住最重要的几个重点。</p>
    <form className="mt-[22px] rounded-lg border border-line bg-surface p-3.5" onSubmit={review}>
      <label className="sr-only" htmlFor="actionInput">描述想推进的事情</label>
      <textarea className="min-h-20 w-full resize-y border-0 bg-transparent p-1 text-sm leading-[1.7] text-ink outline-none" id="actionInput" rows={2} value={text} onChange={(event) => setText(event.target.value)} placeholder="例如：我想把房间整理一下，让晚上回来的时候舒服一点。" />
      <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] text-muted">自然地说就好，不需要填写表格。</span><button className="primary-button" type="submit">和 AI 抓重点 <ArrowRight size={15} aria-hidden="true" /></button></div>
    </form>
    {draft && <div className="mt-5 rounded-lg border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-xs font-bold text-signal"><span className="grid size-6 place-items-center rounded-full bg-signal-soft text-[10px]">AI</span>行动重点</div>
      <p className="mt-3 text-[13px] leading-[1.7] text-ink">这次先把「{draft.title}」做好，我帮你关注三个地方：</p>
      <ol className="mt-3 grid gap-2 pl-5 text-[13px] leading-[1.6] text-muted">{draft.points.map((point) => <li key={point}>{point}</li>)}</ol>
      <div className="mt-[17px] flex items-center gap-4"><button className="primary-button" type="button" onClick={create}>开始行动</button><button className="text-button" type="button" onClick={() => document.getElementById('actionInput')?.focus()}>继续说说</button></div>
    </div>}
  </section>
}
