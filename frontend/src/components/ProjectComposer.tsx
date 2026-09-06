import { zodResolver } from '@hookform/resolvers/zod'
import { FolderPlus } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useExecStore } from '../store/useExecStore'

const projectSchema = z.object({
  title: z.string().trim().min(3, '项目名称至少需要 3 个字符'),
  description: z.string().trim().min(12, '项目描述至少需要 12 个字符'),
  smartContractId: z.string().trim().min(1, '请选择项目智能合约'),
  visibility: z.enum(['private', 'public']),
})

type ProjectForm = z.infer<typeof projectSchema>

export function ProjectComposer() {
  const navigate = useNavigate()
  const smartContracts = useExecStore((state) => state.smartContracts)
  const createProject = useExecStore((state) => state.createProject)
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    setValue,
    formState: { errors },
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { title: '', description: '', smartContractId: smartContracts[0]?.id, visibility: 'private' },
  })

  useEffect(() => {
    const selectedContractId = getValues('smartContractId')
    const hasSelectedContract = smartContracts.some((smartContract) => smartContract.id === selectedContractId)
    if (!hasSelectedContract && smartContracts[0]) {
      setValue('smartContractId', smartContracts[0].id, { shouldValidate: true })
    }
  }, [getValues, setValue, smartContracts])

  const onSubmit = (values: ProjectForm) => {
    const projectId = createProject(values)
    if (!projectId) {
      setError('root', { message: '当前没有可用的智能合约，请先创建或恢复一份智能合约。' })
      return
    }
    navigate(`/projects/${projectId}`)
  }

  return (
    <form className="rounded-md border border-rail bg-white/72 p-5" onSubmit={handleSubmit(onSubmit)} noValidate>
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
          <legend className="text-sm font-semibold text-ink">项目可见性</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="cursor-pointer rounded-md border border-rail bg-paper p-4 transition has-[:checked]:border-ink has-[:checked]:bg-white">
              <input className="sr-only" type="radio" value="private" {...register('visibility')} />
              <span className="block text-sm font-semibold text-ink">私人项目</span>
              <span className="mt-1 block text-sm leading-6 text-graphite">一次只闭合一条节点，始终沿项目主线接续。</span>
            </label>
            <label className="cursor-pointer rounded-md border border-rail bg-paper p-4 transition has-[:checked]:border-signal has-[:checked]:bg-white">
              <input className="sr-only" type="radio" value="public" {...register('visibility')} />
              <span className="block text-sm font-semibold text-ink">公开项目</span>
              <span className="mt-1 block text-sm leading-6 text-graphite">可从签名完成记录建立独立分支，审查记录公开可见。</span>
            </label>
          </div>
        </fieldset>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">项目智能合约</span>
          <select
            className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline"
            aria-invalid={errors.smartContractId ? 'true' : 'false'}
            {...register('smartContractId')}
          >
            {smartContracts.length > 0 ? (
              smartContracts.map((smartContract) => (
                <option key={smartContract.id} value={smartContract.id}>
                  {smartContract.name} · {smartContract.source === 'official' ? '平台提供' : '自定义'}
                </option>
              ))
            ) : (
              <option value="">暂无可用智能合约</option>
            )}
          </select>
          {errors.smartContractId?.message ? <span className="text-sm font-medium text-clay">{errors.smartContractId.message}</span> : null}
        </label>
        {errors.root?.message ? <p className="text-sm font-medium text-clay" role="alert">{errors.root.message}</p> : null}
        <button
          type="submit"
          disabled={smartContracts.length === 0}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-graphite focus:outline-none focus-visible:shadow-focusline sm:w-fit"
        >
          <FolderPlus size={17} aria-hidden="true" />
          创建项目
        </button>
      </div>
    </form>
  )
}
