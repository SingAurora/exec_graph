import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ClipboardPaste, GitBranch, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { z } from 'zod'
import { useExecStore } from '../store/useExecStore'
import type { DraftReview } from '../types'

const composerSchema = z.object({
  draft: z.string().min(60, '请粘贴完整的行为草案'),
  projectId: z.string().min(1),
})

type ComposerForm = z.infer<typeof composerSchema>

const draftFormat = `契约标题：为产品首页建立智能合约入口
可验证目标：完成一个可演示的首页，使用户能按项目智能合约规则部署、审查并签名结果。
验收标准：
- 首页明确展示 AI 审查结论和用户锁定动作，未通过时也保留警示记录。
- 页面显示项目智能合约和冻结后的验收标准。
证据要求：提交可访问的页面和与两条标准逐项对应的截图或实现说明。`

type ContractComposerProps = {
  projectId?: string
  lockProject?: boolean
  parentContractId?: string
  sourceContractIds?: string[]
  branchId?: string
  fork?: boolean
}

export function ContractComposer({ projectId, lockProject = false, parentContractId, sourceContractIds, branchId, fork = false }: ContractComposerProps) {
  const navigate = useNavigate()
  const projects = useExecStore((state) => state.projects)
  const parentContract = useExecStore((state) => state.contracts.find((contract) => contract.id === parentContractId))
  const smartContracts = useExecStore((state) => state.smartContracts)
  const contracts = useExecStore((state) => state.contracts)
  const createContract = useExecStore((state) => state.createContract)
  const [draftReview, setDraftReview] = useState<DraftReview | null>(null)
  const defaultProject = projects.find((project) => project.isDefault) ?? projects[0]
  const {
    register,
    watch,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ComposerForm>({
    resolver: zodResolver(composerSchema),
    defaultValues: {
      draft: '',
      projectId: projectId ?? defaultProject?.id,
    },
  })

  const selectedProject = projects.find((project) => project.id === watch('projectId')) ?? defaultProject
  const activeRevision = selectedProject?.contractRevisions.find(
    (revision) => revision.id === selectedProject.activeContractRevisionId,
  )
  const selectedContract = smartContracts.find((contract) => contract.id === activeRevision?.smartContractId)

  const onSubmit = (values: ComposerForm) => {
    const result = createContract({ projectId: values.projectId, draft: values.draft, parentContractId, sourceContractIds, branchId, fork })
    setDraftReview(result.draftReview)
    if (result.contractId) navigate(`/contracts/${result.contractId}`)
  }

  return (
    <form className="rounded-md border border-rail bg-white/72 p-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
        <LockKeyhole size={15} aria-hidden="true" />
        New action
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold">开始一项推进</h2>
      <p className="mt-3 text-sm leading-6 text-graphite">
        粘贴由 Skill 生成的草案。通过部署校验后，这个节点会继承并固定项目当前版本的智能合约。
      </p>

      <div className="mt-5 grid gap-4">
        {lockProject && selectedProject ? (
          <div className="flex items-center justify-between gap-3 border-b border-rail pb-3">
            <span className="text-sm font-semibold text-ink">归属项目</span>
            <span className="text-sm font-semibold text-signal">{selectedProject.title}</span>
          </div>
        ) : (
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">归属项目</span>
            <select
              className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline"
              {...register('projectId')}
            >
              {projects.filter((project) => !project.archivedAt).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.isDefault ? '默认项目 · ' : ''}
                  {project.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {selectedProject && selectedContract && activeRevision ? (
          <div className="rounded-md border border-rail bg-paper p-4">
            <div className="font-mono text-xs font-semibold text-signal">
              {selectedProject.isDefault ? '默认项目合约' : '当前项目合约'}
            </div>
            <div className="mt-2 text-sm font-semibold text-ink">{selectedContract.name}</div>
            <p className="mt-2 text-sm leading-6 text-graphite">{selectedContract.description}</p>
            <div className="mt-3 flex items-start gap-2 border-t border-rail pt-3 text-xs leading-5 text-graphite">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-signal" aria-hidden="true" />
              新行为只能使用当前项目合约；要调整审查规则，需要进入项目设置修改合约。
            </div>
          </div>
        ) : null}

        {sourceContractIds && sourceContractIds.length > 1 ? (
          <div className="border-y border-rail py-3">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-signal">
              <GitBranch size={15} aria-hidden="true" />
              依据记录
            </div>
            <div className="mt-3 grid gap-2">
              {sourceContractIds.map((sourceId) => {
                const source = contracts.find((contract) => contract.id === sourceId)
                return source ? <div key={source.id} className="text-sm font-semibold text-ink">{source.title}</div> : null
              })}
            </div>
            <p className="mt-2 text-sm leading-6 text-graphite">这是一项普通推进，只是同时引用多条已经锁定的完成记录。提交结果后，智能合约仍按本节点的规则审查。</p>
          </div>
        ) : null}

        {!(sourceContractIds && sourceContractIds.length > 1) && parentContract ? (
          <div className="border-y border-rail py-3">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-signal">
              <GitBranch size={15} aria-hidden="true" />
              依据记录
            </div>
            <div className="mt-2 text-sm font-semibold text-ink">{parentContract.title}</div>
            <p className="mt-1 text-sm leading-6 text-graphite">
              {fork ? '这项行为会从这条完成记录拆出一条独立路径。' : '这项行为会从这条完成记录继续。'}
            </p>
          </div>
        ) : null}

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">Skill 生成的行为草案</span>
          <textarea
            className="min-h-56 rounded-md border border-rail bg-paper px-3 py-3 font-mono text-sm leading-6 outline-none focus:border-signal focus:shadow-focusline"
            placeholder={draftFormat}
            {...register('draft')}
          />
          {errors.draft?.message ? <span className="text-sm font-medium text-clay">{errors.draft.message}</span> : null}
        </label>

        <button
          type="button"
          onClick={() => setValue('draft', draftFormat, { shouldValidate: true })}
          className="inline-flex h-9 w-fit items-center gap-2 text-sm font-semibold text-graphite transition hover:text-ink focus:outline-none focus-visible:shadow-focusline"
        >
          <ClipboardPaste size={16} aria-hidden="true" />
          填入行为格式示例
        </button>

        {draftReview?.verdict === 'fail' ? (
          <div className="rounded-md border border-clay/35 bg-clay/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-clay">
              <AlertTriangle size={16} aria-hidden="true" />
              部署校验未通过
            </div>
            <p className="mt-2 text-sm leading-6 text-graphite">{draftReview.summary}</p>
            <ul className="mt-3 grid gap-1 text-sm leading-6 text-graphite">
              {draftReview.missingRequirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-graphite focus:outline-none focus-visible:shadow-focusline sm:w-fit"
        >
          <LockKeyhole size={17} aria-hidden="true" />
          校验并开始推进
        </button>
      </div>
    </form>
  )
}
