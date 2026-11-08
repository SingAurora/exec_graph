import { ArrowRight, BookOpen, CheckCircle2, MessageCircle, ScrollText, Sparkles } from 'lucide-react'

type GuideWorkspace = 'action' | 'expression' | 'agreement'

const phrases: Record<GuideWorkspace, { phrase: string; title: string; effect: string; icon: typeof Sparkles }> = {
  action: { phrase: '核验一下', title: '核验当前草稿', effect: '只返回核验结果，不自动改写草稿；通过后才会出现发布按钮。', icon: CheckCircle2 },
  expression: { phrase: '给我一个默认效果的表达', title: '生成默认表达', effect: '2～4 句，只讲一个在意点，用 1～3 个支链行动作例子；不列问题、不写小作文。', icon: MessageCircle },
  agreement: { phrase: '给我一个默认效果的约定', title: '生成默认约定', effect: '两句话：请对方说明一件相关事情的实际做法，以及他认真对待的是哪一点。', icon: ScrollText },
}

/** 低心智负担的快捷说法说明；按钮只填入输入框，不直接发送或发布。 */
export function DefaultEffectGuide({ workspace, onUse }: { workspace: GuideWorkspace; onUse: (phrase: string) => void }) {
  const current = phrases[workspace]
  const Icon = current.icon
  return (
    <div className="mx-auto max-w-[620px]">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink"><BookOpen size={16} className="text-signal" />默认效果</div>
      <p className="mt-2 text-sm leading-6 text-muted">不需要记格式，直接说下面这些话即可。点击会把说法填进输入框，仍由你确认后发送。</p>
      <section className="mt-5 rounded-lg border border-line bg-paper p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-signal-soft text-signal"><Icon size={16} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-ink">{current.title}</h3>
            <code className="mt-2 inline-block rounded bg-surface px-2 py-1 text-[13px] text-signal">“{current.phrase}”</code>
            <p className="mt-2 text-xs leading-5 text-muted">{current.effect}</p>
            <button className="quiet-button mt-3" type="button" onClick={() => onUse(current.phrase)}>填入对话<ArrowRight size={14} /></button>
          </div>
        </div>
      </section>
      <section className="mt-6">
        <h3 className="text-xs font-medium text-muted">其他工作区</h3>
        <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-paper">
          {(['action', 'expression', 'agreement'] as const).filter((key) => key !== workspace).map((key) => {
            const item = phrases[key]
            const OtherIcon = item.icon
            return <div className="flex items-start gap-3 px-4 py-3" key={key}>
              <OtherIcon size={15} className="mt-0.5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{item.title}</p>
                <code className="mt-1 inline-block text-xs text-muted">“{item.phrase}”</code>
              </div>
            </div>
          })}
        </div>
      </section>
      <p className="mt-5 text-xs leading-5 text-muted">所有结果都是待确认草稿：不会自动发布，也不会因为填入说法而跳过你的确认。</p>
    </div>
  )
}
