import { zodResolver } from '@hookform/resolvers/zod'
import { Compass, FolderPlus, ListChecks } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
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
  const createProject = useExecStore((state) => state.createProject)
  const accessToken = useExecStore((state) => state.accessToken)
  const [aiKeys, setAIKeys] = useState<AIKeyOption[]>([])
  const [isLoadingAIKeys, setIsLoadingAIKeys] = useState(Boolean(accessToken))
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { title: '', description: '', projectType: 'guided', projectRules: '', aiKeyId: '', visibility: 'private' },
  })
  const projectType = watch('projectType')

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

  const onSubmit = async (values: ProjectForm) => {
    try {
      const projectId = await createProject({ ...values, projectRules: values.projectRules ?? '' })
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
        <fieldset className="grid gap-2">
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
        </fieldset>
        <fieldset className="grid gap-2">
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
        </fieldset>
        {projectType === 'guided' ? <label className="grid gap-2">
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
