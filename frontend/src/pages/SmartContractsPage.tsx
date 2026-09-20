import { zodResolver } from '@hookform/resolvers/zod'
import { Check, FileText, FolderKanban, Plus, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { MarkdownContent } from '../components/MarkdownContent'
import { getJSON } from '../lib/api'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { useExecStore } from '../store/useExecStore'
import type { SmartContractDefinition, SmartContractSource } from '../types'

const contractSchema = z.object({
  name: z.string().trim().min(3, '请输入至少三个字符的合约名称。').max(32, '合约名称最多 32 个字符。'),
  description: z.string().trim().min(16, '请说明这份合约适用的成果。').max(160, '说明最多 160 个字符。'),
  body: z.string().trim().min(40, '请在合约正文中写清部署规则和 AI 审查原则。').max(12000, '合约正文最多 12000 个字符。'),
})

type ContractForm = z.infer<typeof contractSchema>
type ContractFilter = 'all' | SmartContractSource

type SmartContractEvent = {
  id: string
  contractId: string
  eventType: 'created' | 'deleted'
  smartContract: SmartContractDefinition
  createdAt: string
}

const filterLabels: Array<{ value: ContractFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'official', label: '平台' },
  { value: 'custom', label: '自定' },
]

const inputClass = 'h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline'

export function SmartContractsPage({ compact = false }: { compact?: boolean }) {
  const smartContracts = useExecStore((state) => state.smartContracts)
  const projects = useExecStore((state) => state.projects)
  const createSmartContract = useExecStore((state) => state.createSmartContract)
  const deleteSmartContract = useExecStore((state) => state.deleteSmartContract)
  const accessToken = useExecStore((state) => state.accessToken)
  const [filter, setFilter] = useState<ContractFilter>('all')
  const [isCreating, setIsCreating] = useState(false)
  const [events, setEvents] = useState<SmartContractEvent[]>([])
  const [message, setMessage] = useState('')
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
  useEffect(() => {
    if (!accessToken) {
      setEvents([])
      return
    }
    let cancelled = false
    const loadEvents = async () => {
      try {
		const data = await getJSON<{ events?: SmartContractEvent[] }>('/api/commands/contracts/history', accessToken)
		if (!cancelled) setEvents(data.events ?? [])
      } catch {
        // The active contract library remains usable if the history request fails.
      }
    }
    void loadEvents()
    return () => { cancelled = true }
  }, [accessToken, smartContracts])

  const onSubmit = async (values: ContractForm) => {
    setMessage('')
    const contractID = await createSmartContract({
      name: values.name,
      description: values.description,
      body: values.body,
    })
    if (!contractID) {
      setMessage('创建智能合约失败。')
      return
    }
    reset()
    setIsCreating(false)
  }

  const onDelete = async (contractId: string) => {
    setMessage('')
    const result = await deleteSmartContract(contractId)
    if (!result.success) {
      setMessage(result.message ?? '删除智能合约失败。')
      return false
    }
    return true
  }

  return (
    <div className="space-y-8">
      <section className={`flex flex-wrap justify-between gap-5 border-b border-rail ${compact ? 'items-start pb-5' : 'items-end pb-7'}`}>
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
            <ShieldCheck size={16} aria-hidden="true" />
            Smart contracts
          </div>
          {compact ? <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-ink">智能合约</h2> : <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink">智能合约</h1>}
        </div>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className={`inline-flex items-center justify-center gap-2 rounded-md bg-signal text-sm font-semibold text-white transition hover:bg-signalStrong focus:outline-none focus-visible:shadow-focusline ${compact ? 'h-10 px-3' : 'h-11 px-4'}`}
        >
          <Plus size={17} aria-hidden="true" />
          新建自定义合约
        </button>
      </section>

      <Dialog open={isCreating} onOpenChange={(open) => {
        setIsCreating(open)
        if (!open) reset()
      }}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)] max-w-3xl">
          <DialogHeader>
            <DialogTitle>新建自定义智能合约</DialogTitle>
            <DialogDescription>用 Markdown 编写部署规则和 AI 审查原则。</DialogDescription>
          </DialogHeader>
          <form className="grid max-h-[calc(100dvh-12rem)] gap-5 overflow-y-auto px-6 py-6 xl:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
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
            <div className="flex items-center gap-3 border-t border-rail pt-5 xl:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:shadow-focusline"
              >
                <Check size={17} aria-hidden="true" />
                创建智能合约
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <section className="space-y-5" aria-labelledby="contract-library-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {compact ? <span id="contract-library-title" className="text-sm font-medium text-graphite">{visibleContracts.length} 份可用合约</span> : <h2 id="contract-library-title" className="font-display text-2xl font-semibold text-ink">合约库</h2>}
          <div className="grid w-[216px] grid-cols-3 overflow-hidden rounded-md border border-rail bg-paper" aria-label="合约来源筛选">
            {filterLabels.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`h-10 px-3 text-sm font-semibold focus:outline-none focus-visible:shadow-focusline ${item.value !== 'custom' ? 'border-r border-rail' : ''} ${filter === item.value ? 'bg-signal/10 text-signal' : 'text-graphite hover:bg-shell/70 hover:text-ink'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className={compact ? 'divide-y divide-rail border-y border-rail' : 'grid gap-4 xl:grid-cols-2'}>
          {visibleContracts.map((smartContract) => (
            <SmartContractCard key={smartContract.id} compact={compact} smartContract={smartContract} projectIds={projects.filter((project) => project.contractRevisions.some((revision) => revision.id === project.activeContractRevisionId && revision.smartContractId === smartContract.id)).map((project) => project.id)} onDelete={onDelete} />
          ))}
        </div>
      </section>

      {message ? <p className="text-sm font-semibold text-clay">{message}</p> : null}

      <section className="border-t border-rail pt-6" aria-labelledby="contract-history-title">
        <div className="flex items-center justify-between gap-4">
          <h2 id="contract-history-title" className="font-display text-2xl font-semibold text-ink">合约记录</h2>
          <span className="font-mono text-xs font-semibold text-graphite">{events.length} 条</span>
        </div>
        <div className="mt-5 grid gap-3">
          {events.length === 0 ? <p className="text-sm text-graphite">新的自定义合约会在这里记录创建与删除。</p> : events.map((event) => <SmartContractEventRow key={event.id} event={event} />)}
        </div>
      </section>
    </div>
  )
}

function SmartContractCard({ compact = false, smartContract, projectIds, onDelete }: { compact?: boolean; smartContract: SmartContractDefinition; projectIds: string[]; onDelete: (contractId: string) => Promise<boolean> }) {
  const projects = useExecStore((state) => state.projects)
  const activeProjects = projects.filter((project) => projectIds.includes(project.id))
  const isOfficial = smartContract.source === 'official'
  const [isBodyOpen, setIsBodyOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState('')

  const remove = async () => {
    setIsDeleting(true)
    setDeleteMessage('')
    const deleted = await onDelete(smartContract.id)
    if (deleted) setIsDeleteOpen(false)
    else setDeleteMessage('当前不能删除这份合约。')
    setIsDeleting(false)
  }

  return (
    <article className={compact ? 'py-5 first:pt-0 last:pb-0' : 'rounded-md border border-rail bg-surface/72 p-5'}>
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
      <div className={compact ? 'mt-4' : 'mt-5 border-t border-rail pt-4'}>
        <button
          type="button"
          onClick={() => setIsBodyOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal focus:outline-none focus-visible:shadow-focusline"
        >
          <FileText size={16} className="text-signal" aria-hidden="true" />
          查看合约正文
        </button>
      </div>
      <Dialog open={isBodyOpen} onOpenChange={setIsBodyOpen}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)]">
          <DialogHeader>
            <DialogTitle>{smartContract.name}</DialogTitle>
            <DialogDescription>{smartContract.description}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-6 py-6">
            <MarkdownContent content={smartContract.body} className="grid gap-4 text-sm" />
          </div>
        </DialogContent>
      </Dialog>
      <div className={`flex flex-wrap items-center gap-2 text-sm ${compact ? 'mt-3' : 'mt-5 border-t border-rail pt-4'}`}>
        <FolderKanban size={16} className="text-signal" aria-hidden="true" />
        {activeProjects.length > 0 ? activeProjects.map((project) => <Link key={project.id} to={`/projects/${project.id}`} className="font-semibold text-signal transition hover:text-ink focus:outline-none focus-visible:shadow-focusline">{project.title}</Link>) : <span className="text-graphite">尚未采用</span>}
        {!isOfficial ? <button type="button" onClick={() => setIsDeleteOpen(true)} className="ml-auto grid size-9 place-items-center rounded-md text-graphite transition hover:bg-clay/10 hover:text-clay focus:outline-none focus-visible:shadow-focusline" title="删除智能合约" aria-label={`删除 ${smartContract.name}`}><Trash2 size={16} aria-hidden="true" /></button> : null}
      </div>
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>删除智能合约</DialogTitle><DialogDescription>删除后不会出现在可选合约库中，但正文和操作记录会保留以供追溯。</DialogDescription></DialogHeader>
          <div className="flex flex-wrap justify-end gap-3 px-6 py-5">
            <DialogClose className="inline-flex h-10 items-center rounded-md border border-rail bg-surface px-3 text-sm font-semibold text-ink transition hover:bg-paper focus:outline-none focus-visible:shadow-focusline">取消</DialogClose>
            <button type="button" onClick={() => void remove()} disabled={isDeleting} className="inline-flex h-10 items-center rounded-md bg-clay px-3 text-sm font-semibold text-white transition hover:bg-clayStrong disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline">{isDeleting ? '删除中' : '删除合约'}</button>
            {deleteMessage ? <p className="w-full text-sm font-semibold text-clay">{deleteMessage}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </article>
  )
}

function SmartContractEventRow({ event }: { event: SmartContractEvent }) {
  const [isOpen, setIsOpen] = useState(false)
  const isDeleted = event.eventType === 'deleted'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-rail py-2 pl-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink"><span>{event.smartContract.name}</span><span className={isDeleted ? 'text-clay' : 'text-moss'}>{isDeleted ? '已删除' : '已创建'}</span></div>
        <div className="mt-1 text-xs text-graphite">{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(event.createdAt))}</div>
      </div>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal focus:outline-none focus-visible:shadow-focusline"><FileText size={15} aria-hidden="true" />查看正文</button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}><DialogContent className="grid-rows-[auto_minmax(0,1fr)]"><DialogHeader><DialogTitle>{event.smartContract.name}</DialogTitle><DialogDescription>{event.smartContract.description}</DialogDescription></DialogHeader><div className="min-h-0 overflow-y-auto px-6 py-6"><MarkdownContent content={event.smartContract.body} className="grid gap-4 text-sm" /></div></DialogContent></Dialog>
    </div>
  )
}
