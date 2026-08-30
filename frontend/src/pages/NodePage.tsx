import { zodResolver } from '@hookform/resolvers/zod'
import { Bot, Check, Fingerprint, GitBranchPlus, GitMerge, Scale, Send } from 'lucide-react'
import type { TextareaHTMLAttributes } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { ContractStageRail } from '../components/ContractStageRail'
import { EvidenceCoverage } from '../components/EvidenceCoverage'
import { RelayRail } from '../components/RelayRail'
import { StatusBadge } from '../components/StatusBadge'
import { useExecStore } from '../store/useExecStore'
import type { CompletionRecord, ExecutionContract } from '../types'

const submitSchema = z.object({
  completionClaim: z.string().min(20, '提交足以解释完成结果的说明'),
  evidenceText: z.string().min(20, '必须按 C1、C2… 逐条提供证据对应'),
})

type SubmitForm = z.infer<typeof submitSchema>

const verdictText = {
  pass: '通过',
  partial: '未通过，存在缺口',
  fail: '未通过',
}

const criterionText = {
  met: '满足',
  unclear: '证据不足',
  unmet: '未满足',
}

export function NodePage() {
  const { contractId = '' } = useParams()
  const navigate = useNavigate()
  const contract = useExecStore((state) => state.contracts.find((item) => item.id === contractId))
  const project = useExecStore((state) => state.projects.find((item) => item.id === contract?.projectId))
  const smartContract = useExecStore((state) => state.smartContracts.find((item) => item.id === contract?.smartContractId))
  const allContracts = useExecStore((state) => state.contracts)
  const completionRecords = useExecStore((state) => state.completionRecords)
  const allBranches = useExecStore((state) => state.branches)
  const submitCompletion = useExecStore((state) => state.submitCompletion)
  const confirmCompletion = useExecStore((state) => state.confirmCompletion)
  const createSupplementContract = useExecStore((state) => state.createSupplementContract)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubmitForm>({
    resolver: zodResolver(submitSchema),
    values: {
      completionClaim: contract?.completionClaim ?? '',
      evidenceText: contract?.evidenceText ?? '',
    },
  })

  if (!contract) {
    return (
      <div className="rounded-md border border-rail bg-white/72 p-6">
        <h1 className="font-display text-3xl font-semibold">智能合约不存在</h1>
        <Link className="mt-4 inline-block text-sm font-semibold text-signal" to="/">
          返回智能合约
        </Link>
      </div>
    )
  }

  const onSubmit = (values: SubmitForm) => {
    submitCompletion(contract.id, values)
    navigate(`/contracts/${contract.id}`)
  }

  const branch = allBranches.find((item) => item.id === contract.branchId)
  const isArchived = Boolean(project?.archivedAt)
  const isCurrent = !isArchived && (project?.currentContractId === contract.id || branch?.currentContractId === contract.id)
  const currentContract = allContracts.find((item) => item.id === (branch ? branch.currentContractId : project?.currentContractId))
  const isReviewing = contract.stage === 'frozen' && Boolean(contract.completionClaim) && !contract.aiReview
  const canSubmit = isCurrent && contract.stage === 'frozen' && !isReviewing
  const aiReviewPassed = contract.aiReview?.verdict === 'pass'
  const canLock = isCurrent && (contract.stage === 'verified' || contract.stage === 'needs_supplement') && Boolean(contract.aiReview)
  const supplement = allContracts.find((item) => item.supplementOfContractId === contract.id)
  const sourceIds = contract.sourceContractIds ?? (contract.parentContractId ? [contract.parentContractId] : [])
  const sourceContracts = sourceIds
    .map((sourceId) => allContracts.find((item) => item.id === sourceId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const hasMultipleSources = sourceContracts.length > 1
  const canSupplement =
    isCurrent && contract.stage === 'needs_supplement' && Boolean(contract.aiReview?.suggestedSupplementTitle) && !supplement
  const completionRecord = contract.completionRecordId
    ? completionRecords.find((record) => record.id === contract.completionRecordId)
    : completionRecords.find((record) => record.coveredContractIds.includes(contract.id))
  const canContinue =
    !isArchived &&
    Boolean(completionRecord) &&
    Boolean(project) &&
    (branch ? branch.headContractId === contract.id && !branch.currentContractId : !project?.currentContractId)
  const canFork = !isArchived && Boolean(completionRecord) && Boolean(project) && completionRecord?.closingContractId === contract.id

  return (
    <div className="space-y-7">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge stage={contract.stage} />
            {hasMultipleSources ? <span className="inline-flex items-center gap-1 rounded-full border border-signal/30 bg-signal/10 px-2.5 py-1 font-mono text-[12px] font-semibold text-signal"><GitMerge size={13} aria-hidden="true" />多来源行动</span> : null}
          </div>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-tight text-ink">{contract.title}</h1>
          <p className="mt-3 text-sm font-semibold text-signal">{project?.title}</p>
          {branch ? <p className="mt-2 text-sm font-semibold text-graphite">行为路径 · {branch.title}</p> : null}
        </div>

        <div className="rounded-md border border-rail bg-white/72 p-4">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold text-signal">
            <Bot size={15} aria-hidden="true" />
            智能合约
          </div>
          <div className="mt-3 text-lg font-semibold">{smartContract?.name}</div>
          <div className="mt-1 text-sm text-graphite">{smartContract?.source === 'official' ? '平台提供' : '用户自定义'} · 项目智能合约</div>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-rail bg-paper p-3 font-mono text-xs font-semibold text-graphite">
            <Fingerprint size={14} aria-hidden="true" />
            规则指纹 {contract.ruleHash}
          </div>
          <p className="mt-4 text-sm leading-6 text-graphite">{smartContract?.description}</p>
        </div>
      </section>

      <RelayRail node={contract} />

      <ContractStageRail stage={contract.stage} />

      {isReviewing ? (
        <section className="border-l-2 border-signal bg-white/50 py-3 pl-5">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={15} aria-hidden="true" />智能合约正在审核</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">等待智能合约返回审查结果</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite">推进结果已经提交，正在按照冻结的验收标准处理。审查完成后，这个节点会进入待确认 AI 结果。</p>
        </section>
      ) : null}

      {isArchived ? (
        <section className="border-l-2 border-graphite py-1 pl-5">
          <div className="font-mono text-xs font-semibold uppercase text-graphite">项目已归档</div>
          <p className="mt-2 text-sm leading-6 text-graphite">这项行为及其审查记录仍可查看，但项目不再接受提交、确认或继续。</p>
        </section>
      ) : null}

      {!isArchived && !isCurrent && currentContract ? (
        <section className="border-l-2 border-rail py-1 pl-5">
          <div className="font-mono text-xs font-semibold uppercase text-signal">项目当前行为</div>
          <p className="mt-2 text-sm leading-6 text-graphite">
            这项行为保留为项目记录。现在需要处理的是「{currentContract.title}」。
          </p>
          <Link
            to={`/contracts/${currentContract.id}`}
            className="mt-3 inline-flex text-sm font-semibold text-signal transition hover:text-ink focus:outline-none focus-visible:shadow-focusline"
          >
            打开当前行为
          </Link>
        </section>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-md border border-rail bg-white/72 p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
            <Scale size={15} aria-hidden="true" />
            Frozen rules
          </div>
          <h2 className="mt-3 font-display text-2xl font-semibold">这项行为的验收规则</h2>
          <p className="mt-3 text-sm leading-6 text-graphite">{contract.verifiableGoal}</p>
          <div className="mt-5 grid gap-3">
            {contract.acceptanceCriteria.map((criterion, index) => (
              <div key={criterion.id} className="rounded-md border border-rail bg-paper p-4">
                <div className="font-mono text-xs font-semibold text-signal">C{index + 1}</div>
                <div className="mt-2 text-sm font-semibold text-ink">{criterion.text}</div>
                <p className="mt-2 text-sm leading-6 text-graphite">{criterion.requiredEvidence}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-md border border-rail bg-[#efebe1] p-5">
          <div className="font-mono text-xs font-semibold uppercase text-signal">Deployment draft</div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-graphite">{contract.originalIntent}</p>
          <div className="mt-5 font-mono text-xs font-semibold uppercase text-signal">Required proof</div>
          <p className="mt-3 text-sm leading-6 text-graphite">{contract.evidenceRequirement}</p>
          <div className="mt-5 border-t border-rail pt-4 text-xs leading-5 text-graphite">
            规则已冻结。不能修改目标、验收标准或证据要求来迁就结果。
          </div>
        </aside>
      </section>

      {canSubmit ? (
        <section className="rounded-md border border-rail bg-white/72 p-5">
          <div className="font-mono text-xs font-semibold uppercase text-signal">Submit result</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">提交这次推进结果</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite">
            这次提交会成为节点的推进证据。提交后进入待确认 AI 结果；确认结论后，你可以锁定这次节点，或继续生成补足推进。
          </p>
          <form className="mt-5 grid gap-4" onSubmit={handleSubmit(onSubmit)}>
            <TextArea
              label="本次推进结果"
              placeholder="粘贴这次行动留下的产出、链接、变更说明或结果摘要。"
              error={errors.completionClaim?.message}
              {...register('completionClaim')}
            />
            <TextArea
              label="逐条证据对应"
              placeholder={'C1：对应结果的位置或链接\nC2：对应结果的位置或链接'}
              error={errors.evidenceText?.message}
              {...register('evidenceText')}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:shadow-focusline sm:w-fit"
            >
              <Send size={17} aria-hidden="true" />
              提交证明并审查
            </button>
          </form>
        </section>
      ) : null}

      {contract.completionClaim ? (
        <section className="grid gap-5 lg:grid-cols-2">
          <InfoBlock title="用户提交的推进结果" body={contract.completionClaim} />
          <InfoBlock title="用户提交的逐条证据" body={contract.evidenceText ?? '未提交。'} />
        </section>
      ) : null}

      {contract.aiReview ? (
        <section className="rounded-md border border-clay/30 bg-clay/5 p-5">
          <div className="font-mono text-xs font-semibold uppercase text-clay">AI review</div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">AI 审查：{verdictText[contract.aiReview.verdict]}</h2>
            <span className="rounded-full border border-clay/30 bg-white/70 px-3 py-1 font-mono text-xs font-semibold text-clay">
              AI 结论不可改写
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-graphite">{contract.aiReview.summary}</p>
          <div className="mt-5 grid gap-3">
            {contract.aiReview.criterionReviews.map((review) => {
              const criterion = contract.acceptanceCriteria.find((item) => item.id === review.criterionId)
              return (
                <div key={review.criterionId} className="rounded-md border border-rail bg-white/72 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">{criterion?.text}</div>
                <span className={`font-mono text-xs font-semibold ${review.result === 'met' ? 'text-moss' : 'text-clay'}`}>{criterionText[review.result]}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-graphite">{review.reason}</p>
                </div>
              )
            })}
          </div>

          {canLock ? (
            <div className={`mt-5 rounded-md border p-4 ${aiReviewPassed ? 'border-moss/30 bg-moss/8' : 'border-clay/30 bg-clay/8'}`}>
              <p className="text-sm leading-6 text-graphite">
                {aiReviewPassed
                  ? 'AI 已通过审查。你确认后，这次推进会生成阶段完成记录。'
                  : 'AI 没有通过审查。你仍可以锁定这次推进，记录会明确标注 AI 未通过，审查结论不会被改写。'}
              </p>
              <button
                type="button"
                onClick={() => confirmCompletion(contract.id)}
                className={`mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition focus:outline-none focus-visible:shadow-focusline ${aiReviewPassed ? 'bg-moss hover:bg-[#4c6843]' : 'bg-clay hover:bg-[#8c3f36]'}`}
              >
                <Check size={17} aria-hidden="true" />
                {aiReviewPassed ? '确认并生成完成记录' : '仍然锁定并生成记录'}
              </button>
            </div>
          ) : null}

          {canSupplement ? (
            <div className="mt-5 rounded-md border border-clay/30 bg-white/72 p-4">
              <div className="text-sm font-semibold text-ink">{contract.aiReview.suggestedSupplementTitle}</div>
              <p className="mt-2 text-sm leading-6 text-graphite">
                智能合约没有确认这项行为已经完成。原审查记录会保留；你可以把缺口变成下一项行为继续推进。
              </p>
              <button
                type="button"
                onClick={() => createSupplementContract(contract.id)}
                className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-rail bg-white px-4 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"
              >
                <GitBranchPlus size={17} aria-hidden="true" />
                生成补足行为
              </button>
            </div>
          ) : null}
          {supplement ? (
            <div className="mt-5 rounded-md border border-moss/30 bg-white/72 p-4">
              <div className="text-sm font-semibold text-ink">补足行为已生成</div>
              <p className="mt-2 text-sm leading-6 text-graphite">原行为保留审查结论，缺口将在新的冻结规则中继续推进。</p>
              <Link
                to={`/contracts/${supplement.id}`}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-rail bg-white px-3 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"
              >
                打开补足行为
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {contract.aiReview ? <EvidenceCoverage contract={contract} /> : null}

      {completionRecord ? <CompletionRecordSummary record={completionRecord} contracts={allContracts} closingContractId={completionRecord.closingContractId} currentContractId={contract.id} /> : null}

      {canContinue && project ? (
        <section className="border-l-2 border-signal pl-5">
          <div className="font-mono text-xs font-semibold uppercase text-signal">{branch ? 'Continue path' : 'Continue record'}</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">继续下一项推进</h2>
          <Link
            to={`/projects/${project.id}?parent=${contract.id}${branch ? `&branch=${branch.id}` : ''}#new-node`}
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-graphite focus:outline-none focus-visible:shadow-focusline"
          >
            <GitBranchPlus size={17} aria-hidden="true" />
            {branch ? '沿此路径继续' : '继续下一项'}
          </Link>
        </section>
      ) : null}

      {canFork && project ? (
        <section className="border-l-2 border-signal pl-5">
          <div className="font-mono text-xs font-semibold uppercase text-signal">Split behavior</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">从这条记录拆分新路径</h2>
          <p className="mt-2 text-xs leading-5 text-graphite">把较大的目标拆成另一条推进路径；这条阶段完成记录会作为依据。</p>
          <Link
            to={`/projects/${project.id}?parent=${contract.id}&fork=1#new-node`}
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink bg-white px-4 text-sm font-semibold text-ink transition hover:bg-paper focus:outline-none focus-visible:shadow-focusline"
          >
            <GitBranchPlus size={17} aria-hidden="true" />
            拆分新路径
          </Link>
        </section>
      ) : null}

      <section className="rounded-md border border-rail bg-white/72 p-5">
        <div className="font-mono text-xs font-semibold uppercase text-signal">Review log</div>
        <h2 className="mt-2 font-display text-2xl font-semibold">行为审查记录</h2>
        <div className="mt-5 grid gap-3">
          {contract.reviewMessages.length > 0 ? (
            contract.reviewMessages.map((message) => (
              <div key={message.id} className="rounded-md border border-rail bg-paper p-4">
                <div className="font-mono text-xs font-semibold text-signal">{message.speaker === 'ai' ? 'AI' : '用户'}</div>
                <p className="mt-2 text-sm leading-6 text-graphite">{message.body}</p>
              </div>
            ))
          ) : (
            <p className="text-sm leading-6 text-graphite">行为开始、提交结果、智能合约审查和本人确认都会记录在这里。</p>
          )}
        </div>
      </section>
    </div>
  )
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-rail bg-white/72 p-4">
      <div className="font-mono text-xs font-semibold text-signal">{title}</div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-graphite">{body}</p>
    </div>
  )
}

function CompletionRecordSummary({ record, contracts, closingContractId, currentContractId }: { record: CompletionRecord; contracts: ExecutionContract[]; closingContractId: string; currentContractId: string }) {
  const isClosingNode = closingContractId === currentContractId
  const aiReviewPassed = record.aiReviewVerdict === 'pass'
  return (
    <section className={`rounded-md border p-5 ${aiReviewPassed ? 'border-moss/35 bg-moss/8' : 'border-clay/35 bg-clay/8'}`}>
      <div className={`font-mono text-xs font-semibold uppercase ${aiReviewPassed ? 'text-moss' : 'text-clay'}`}>{aiReviewPassed ? 'Stage record' : 'User lock'}</div>
      <h2 className="mt-2 font-display text-2xl font-semibold">{aiReviewPassed ? '已纳入阶段完成记录' : '已锁定阶段记录'}</h2>
      <p className="mt-3 text-sm leading-6 text-graphite">{record.summary}</p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-graphite">
        <span>覆盖 {record.coveredContractIds.length} 个推进节点</span>
        <span className={aiReviewPassed ? 'text-moss' : 'text-clay'}>{aiReviewPassed ? 'AI 审查通过 · 用户确认' : 'AI 审查未通过 · 用户锁定'}</span>
        <span>{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(record.createdAt))}</span>
      </div>
      <div className={`mt-4 border-t pt-4 ${aiReviewPassed ? 'border-moss/20' : 'border-clay/20'}`}>
        <div className={`font-mono text-xs font-semibold ${aiReviewPassed ? 'text-moss' : 'text-clay'}`}>本次锁定范围</div>
        <div className="mt-2 grid gap-1 text-sm text-graphite">
          {record.coveredContractIds.map((contractId) => <span key={contractId}>{contracts.find((contract) => contract.id === contractId)?.title ?? '推进节点'}</span>)}
        </div>
      </div>
      {!isClosingNode ? <Link to={`/contracts/${closingContractId}`} className="mt-4 inline-flex items-center text-sm font-semibold text-signal hover:text-ink focus:outline-none focus-visible:shadow-focusline">打开收束节点</Link> : null}
    </section>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  error?: string
}

function TextArea({ label, error, ...props }: TextAreaProps) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <textarea
        className="min-h-28 rounded-md border border-rail bg-paper px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-graphite/70 focus:border-signal focus:shadow-focusline"
        {...props}
      />
      {error ? <span className="text-sm font-medium text-clay">{error}</span> : null}
    </label>
  )
}
