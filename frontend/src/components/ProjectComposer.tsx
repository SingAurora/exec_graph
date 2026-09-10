import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowUpRight, Compass, FolderPlus, ListChecks, Network } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { getCall, type CollaborationCall } from '../lib/collaboration'
import { useExecStore } from '../store/useExecStore'

const projectSchema = z.object({
  title: z.string().trim().min(3, '项目名称至少需要 3 个字符'),
  description: z.string().trim().min(12, '项目描述至少需要 12 个字符'),
  projectType: z.enum(['guided', 'autonomous']),
  projectRules: z.string().trim().optional(),
  aiKeyId: z.string().trim().min(1, '请选择项目审查 AI'),
  visibility: z.enum(['private', 'public']),
}).superRefine((values, context) => {
  if (values.projectType === 'guided' && (!values.projectRules || values.projectRules.length < 12)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['projectRules'], message: '请填写项目规则，至少 12 个字符' })
  }
})

type ProjectForm = z.infer<typeof projectSchema>

type AIKeyOption = {
  id: string
  provider: string
  label: string
  model: string
}

export function ProjectComposer() {
  const navigate = useNavigate()
	const [searchParams] = useSearchParams()
  const createProject = useExecStore((state) => state.createProject)
  const accessToken = useExecStore((state) => state.accessToken)
  const [aiKeys, setAIKeys] = useState<AIKeyOption[]>([])
  const [contributionCall, setContributionCall] = useState<CollaborationCall | null>(null)
  const [contributionError, setContributionError] = useState('')
  const [isLoadingAIKeys, setIsLoadingAIKeys] = useState(Boolean(accessToken))
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { title: '', description: '', projectType: 'guided', projectRules: '', aiKeyId: '', visibility: 'private' },
  })
  const projectType = watch('projectType')
	const contributionCallID = searchParams.get('fromCall')

  useEffect(() => {
    if (!accessToken) {
      setAIKeys([])
      setIsLoadingAIKeys(false)
      return
    }
    let cancelled = false
    const loadAIKeys = async () => {
      setIsLoadingAIKeys(true)
      try {
        const response = await fetch('/api/ai-keys', { headers: { Authorization: `Bearer ${accessToken}` } })
        const data = (await response.json().catch(() => ({}))) as { keys?: AIKeyOption[] }
        if (response.ok && !cancelled) setAIKeys(data.keys ?? [])
      } finally {
        if (!cancelled) setIsLoadingAIKeys(false)
      }
    }
    void loadAIKeys()
    return () => { cancelled = true }
  }, [accessToken])

	useEffect(() => {
		if (!contributionCallID || !accessToken) return
		let cancelled = false
		getCall(accessToken, contributionCallID).then(({ call }) => {
			if (cancelled) return
			setContributionCall(call)
			setValue('title', `贡献：${call.title}`)
			setValue('description', `为「${call.projectTitle}」补充「${call.target.title}」所需的可验证成果。`)
			setValue('projectType', 'autonomous')
			setValue('visibility', 'public')
			setValue('projectRules', '')
		}).catch((reason: Error) => { if (!cancelled) setContributionError(reason.message) })
		return () => { cancelled = true }
	}, [accessToken, contributionCallID, setValue])

  const onSubmit = async (values: ProjectForm) => {
    try {
		const projectId = await createProject({
			...values,
			projectType: contributionCall ? 'autonomous' : values.projectType,
			projectRules: contributionCall ? '' : values.projectRules ?? '',
			visibility: contributionCall ? 'public' : values.visibility,
			contributionCallId: contributionCall?.id,
		})
      if (!projectId) {
        setError('root', { message: '项目创建失败，请检查项目规则和 AI 配置。' })
        return
      }
      navigate(`/projects/${projectId}`)
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : '项目创建失败。' })
      return
    }
  }

  return (
    <form className="rounded-md border border-rail bg-surface/72 p-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-4">
		{contributionCall ? <ContributionBrief call={contributionCall} /> : null}
		{contributionError ? <p className="border-l-2 border-clay py-2 pl-3 text-sm font-semibold text-clay">{contributionError}</p> : null}
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">项目名称</span>
          <input
            className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline"
            placeholder="例如：执行图谱 MVP"
            aria-invalid={errors.title ? 'true' : 'false'}
            {...register('title')}
          />
          {errors.title?.message ? <span className="text-sm font-medium text-clay">{errors.title.message}</span> : null}
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">项目描述</span>
          <textarea
            className="min-h-24 rounded-md border border-rail bg-paper px-3 py-3 text-sm leading-6 outline-none focus:border-signal focus:shadow-focusline"
            placeholder="这个项目准备把哪些行动聚拢到同一个结果？"
            aria-invalid={errors.description ? 'true' : 'false'}
            {...register('description')}
          />
          {errors.description?.message ? <span className="text-sm font-medium text-clay">{errors.description.message}</span> : null}
        </label>
        {!contributionCall ? <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-ink">项目类型</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="cursor-pointer rounded-md border border-rail bg-paper p-4 transition has-[:checked]:border-signal has-[:checked]:bg-surface">
              <input className="sr-only" type="radio" value="guided" {...register('projectType')} />
              <span className="flex items-center gap-2 text-sm font-semibold text-ink"><ListChecks size={16} aria-hidden="true" />规则引导型</span>
              <span className="mt-1 block text-sm leading-6 text-graphite">AI 根据项目规则决定下一步行动。</span>
            </label>
            <label className="cursor-pointer rounded-md border border-rail bg-paper p-4 transition has-[:checked]:border-signal has-[:checked]:bg-surface">
              <input className="sr-only" type="radio" value="autonomous" {...register('projectType')} />
              <span className="flex items-center gap-2 text-sm font-semibold text-ink"><Compass size={16} aria-hidden="true" />自主推进型</span>
              <span className="mt-1 block text-sm leading-6 text-graphite">你决定下一步，节点仍需 AI 审查后锁定。</span>
            </label>
          </div>
        </fieldset> : null}
        {!contributionCall ? <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-ink">项目可见性</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="cursor-pointer rounded-md border border-rail bg-paper p-4 transition has-[:checked]:border-signal has-[:checked]:bg-surface">
              <input className="sr-only" type="radio" value="private" {...register('visibility')} />
              <span className="block text-sm font-semibold text-ink">私人项目</span>
              <span className="mt-1 block text-sm leading-6 text-graphite">只有项目成员可以查看和推进。</span>
            </label>
            <label className="cursor-pointer rounded-md border border-rail bg-paper p-4 transition has-[:checked]:border-signal has-[:checked]:bg-surface">
              <input className="sr-only" type="radio" value="public" {...register('visibility')} />
              <span className="block text-sm font-semibold text-ink">公开项目</span>
              <span className="mt-1 block text-sm leading-6 text-graphite">行动路径和审查记录对外可见。</span>
            </label>
          </div>
        </fieldset> : null}
        {!contributionCall && projectType === 'guided' ? <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">项目规则</span>
          <textarea
            className="min-h-28 rounded-md border border-rail bg-paper px-3 py-3 text-sm leading-6 outline-none focus:border-signal focus:shadow-focusline"
            placeholder="例如：每次只推进一个行动；所有结果都要有证据；遇到缺口时拆出补充行动。"
            aria-invalid={errors.projectRules ? 'true' : 'false'}
            {...register('projectRules')}
          />
          {errors.projectRules?.message ? <span className="text-sm font-medium text-clay">{errors.projectRules.message}</span> : null}
        </label> : null}
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">项目审查 AI</span>
          <select
            className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline"
            aria-invalid={errors.aiKeyId ? 'true' : 'false'}
            disabled={isLoadingAIKeys || aiKeys.length === 0}
            {...register('aiKeyId')}
          >
            <option value="">{isLoadingAIKeys ? '读取 AI 配置...' : aiKeys.length === 0 ? '暂无可用 AI 配置' : '选择 AI 配置'}</option>
            {aiKeys.map((key) => <option key={key.id} value={key.id}>{key.label} · {key.provider} · {key.model}</option>)}
          </select>
          {aiKeys.length === 0 && !isLoadingAIKeys ? <span className="text-sm leading-6 text-graphite">先到 <Link to="/settings" className="font-semibold text-signal hover:text-ink">个人设置</Link> 添加 AI 密钥。</span> : null}
          {errors.aiKeyId?.message ? <span className="text-sm font-medium text-clay">{errors.aiKeyId.message}</span> : null}
        </label>
        {errors.root?.message ? <p className="text-sm font-medium text-clay" role="alert">{errors.root.message}</p> : null}
        <button
          type="submit"
          disabled={aiKeys.length === 0 || isLoadingAIKeys}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-white transition hover:bg-signalStrong focus:outline-none focus-visible:shadow-focusline sm:w-fit"
        >
          <FolderPlus size={17} aria-hidden="true" />
          创建项目
        </button>
      </div>
    </form>
  )
}

function ContributionBrief({ call }: { call: CollaborationCall }) {
  return (
    <section className="border-l-2 border-signal bg-shell/60 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Network size={15} aria-hidden="true" />协作交接</div>
        <span className="text-xs font-semibold text-graphite">完成后可直接提交回 @{call.ownerUserId}</span>
      </div>
      <h2 className="mt-3 text-lg font-semibold text-ink">{call.title}</h2>
      <p className="mt-2 text-sm leading-6 text-graphite">为「{call.projectTitle}」补上：{call.target.verifiableGoal}</p>
      <div className="mt-4 border-y border-rail py-3">
        <div className="text-xs font-semibold text-ink">这次贡献要满足</div>
        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-graphite">
          {call.target.acceptanceCriteria.map((criterion) => <li key={criterion.id}><span className="font-mono text-xs font-semibold text-signal">{criterion.id.toUpperCase()}</span> {criterion.text}</li>)}
        </ul>
      </div>
      <p className="mt-3 text-xs leading-5 text-graphite">提交材料：{call.target.evidenceRequirement}</p>
		{call.submissionCount > 0 ? <p className="mt-2 text-xs leading-5 text-graphite">已有 {call.submissionCount} 份成果正在等待维护者组合审查；创建后可在原始协作目标查看它们的对应关系。</p> : null}
      <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-signal">这会创建一个公开贡献工作区 <ArrowUpRight size={13} aria-hidden="true" /></div>
    </section>
  )
}
