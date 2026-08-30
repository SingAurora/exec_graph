import { zodResolver } from '@hookform/resolvers/zod'
import { Check, FileText, FolderKanban, Plus, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { MarkdownContent } from '../components/MarkdownContent'
import { useExecStore } from '../store/useExecStore'
import type { SmartContractDefinition, SmartContractSource } from '../types'

const contractSchema = z.object({
  name: z.string().trim().min(3, '请输入至少三个字符的合约名称。').max(32, '合约名称最多 32 个字符。'),
  description: z.string().trim().min(16, '请说明这份合约适用的成果。').max(160, '说明最多 160 个字符。'),
  body: z.string().trim().min(40, '请在合约正文中写清部署规则和 AI 审查原则。').max(12000, '合约正文最多 12000 个字符。'),
})

type ContractForm = z.infer<typeof contractSchema>
type ContractFilter = 'all' | SmartContractSource

const filterLabels: Array<{ value: ContractFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'official', label: '平台提供' },
  { value: 'custom', label: '自定义' },
]

const inputClass = 'h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline'

export function SmartContractsPage() {
  const smartContracts = useExecStore((state) => state.smartContracts)
  const projects = useExecStore((state) => state.projects)
  const createSmartContract = useExecStore((state) => state.createSmartContract)
  const [filter, setFilter] = useState<ContractFilter>('all')
  const [isCreating, setIsCreating] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContractForm>({
    resolver: zodResolver(contractSchema),
    defaultValues: { name: '', description: '', body: '' },
  })

  const visibleContracts = smartContracts.filter((contract) => filter === 'all' || contract.source === filter)
  const onSubmit = (values: ContractForm) => {
    createSmartContract({
      name: values.name,
      description: values.description,
      body: values.body,
    })
    reset()
    setIsCreating(false)
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-5 border-b border-rail pb-7">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">Smart contracts</div>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink">智能合约</h1>
        </div>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-graphite focus:outline-none focus-visible:shadow-focusline"
        >
          <Plus size={17} aria-hidden="true" />
          新建自定义合约
        </button>
      </section>

      {isCreating ? (
        <form className="border-y border-rail py-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-xs font-semibold uppercase text-signal">Custom contract</div>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">新建自定义智能合约</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                reset()
                setIsCreating(false)
              }}
              className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-white/70 hover:text-ink focus:outline-none focus-visible:shadow-focusline"
              aria-label="关闭新建智能合约"
              title="关闭"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">合约名称</span>
              <input className={inputClass} {...register('name')} />
              {errors.name?.message ? <span className="text-sm font-medium text-clay">{errors.name.message}</span> : null}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">适用成果</span>
              <input className={inputClass} {...register('description')} />
              {errors.description?.message ? <span className="text-sm font-medium text-clay">{errors.description.message}</span> : null}
            </label>
            <label className="grid gap-2 xl:col-span-2">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                合约正文
                <span className="font-mono text-[11px] font-semibold uppercase text-signal">Markdown</span>
              </span>
              <textarea
                className="min-h-72 rounded-md border border-rail bg-paper px-3 py-3 font-mono text-sm leading-6 outline-none focus:border-signal focus:shadow-focusline"
                placeholder={'## 部署规则\n\n- 写明可验证目标\n- 列出验收标准和证据要求\n\n## AI 审查原则\n\n只按冻结的验收标准审查，不临时提高标准。'}
                {...register('body')}
              />
              {errors.body?.message ? <span className="text-sm font-medium text-clay">{errors.body.message}</span> : null}
            </label>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:shadow-focusline"
          >
            <Check size={17} aria-hidden="true" />
            创建智能合约
          </button>
        </form>
      ) : null}

      <section className="space-y-5" aria-labelledby="contract-library-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="contract-library-title" className="font-display text-2xl font-semibold text-ink">合约库</h2>
          <div className="grid grid-cols-3 overflow-hidden rounded-md border border-rail bg-paper" aria-label="合约来源筛选">
            {filterLabels.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`h-10 border-r border-rail text-sm font-semibold last:border-r-0 focus:outline-none focus-visible:shadow-focusline ${filter === item.value ? 'bg-ink text-paper' : 'text-graphite hover:bg-white/70 hover:text-ink'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleContracts.map((smartContract) => (
            <SmartContractCard key={smartContract.id} smartContract={smartContract} projectIds={projects.filter((project) => project.contractRevisions.some((revision) => revision.id === project.activeContractRevisionId && revision.smartContractId === smartContract.id)).map((project) => project.id)} />
          ))}
        </div>
      </section>
    </div>
  )
}

function SmartContractCard({ smartContract, projectIds }: { smartContract: SmartContractDefinition; projectIds: string[] }) {
  const projects = useExecStore((state) => state.projects)
  const activeProjects = projects.filter((project) => projectIds.includes(project.id))
  const isOfficial = smartContract.source === 'official'

  return (
    <article className="rounded-md border border-rail bg-white/72 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-2 font-mono text-xs font-semibold ${isOfficial ? 'text-signal' : 'text-moss'}`}>
            {isOfficial ? <ShieldCheck size={16} aria-hidden="true" /> : <SlidersHorizontal size={16} aria-hidden="true" />}
            {isOfficial ? '平台提供' : '自定义'}
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-6 text-ink">{smartContract.name}</h3>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-graphite">{smartContract.description}</p>
      <details className="mt-5 border-t border-rail pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink marker:hidden focus:outline-none focus-visible:shadow-focusline">
          <FileText size={16} className="text-signal" aria-hidden="true" />
          查看合约正文
        </summary>
        <MarkdownContent content={smartContract.body} className="mt-4 grid gap-4 text-sm" />
      </details>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-rail pt-4 text-sm">
        <FolderKanban size={16} className="text-signal" aria-hidden="true" />
        {activeProjects.length > 0 ? activeProjects.map((project) => <Link key={project.id} to={`/projects/${project.id}`} className="font-semibold text-signal transition hover:text-ink focus:outline-none focus-visible:shadow-focusline">{project.title}</Link>) : <span className="text-graphite">尚未采用</span>}
      </div>
    </article>
  )
}
