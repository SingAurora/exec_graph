import { FileText } from 'lucide-react'
import type { SmartContractDefinition } from '@/entities/smart-contract/model/types'
import { MarkdownContent } from '@/shared/ui/MarkdownContent'

type SmartContractDocumentProps = {
  contract: SmartContractDefinition
  className?: string
  bodyClassName?: string
}

/** 以 Markdown 正文展示智能合约，不对用户自定义结构做固定字段解析。 */
export function SmartContractDocument({ contract, className = '', bodyClassName = '' }: SmartContractDocumentProps) {
  return (
    <article className={`space-y-4 ${className}`}>
      <header className="flex items-start gap-3 border-b border-rail pb-4">
        <FileText size={18} className="mt-0.5 shrink-0 text-signal" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="font-semibold text-ink">{contract.name}</h3>
          <p className="mt-1 text-sm leading-6 text-graphite">{contract.description}</p>
          <p className="mt-2 font-mono text-[11px] font-semibold uppercase text-graphite">
            {contract.source === 'official' ? '平台提供' : '用户自定义'} · v{contract.version}
          </p>
        </div>
      </header>
      <MarkdownContent content={contract.body} className={`grid gap-4 text-sm ${bodyClassName}`} />
    </article>
  )
}
