import { zodResolver } from '@hookform/resolvers/zod'
import { FolderPlus, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useExecStore } from '../store/useExecStore'

const projectSchema = z.object({
  title: z.string().min(3, '请输入项目名称'),
  description: z.string().min(12, '请填写项目描述'),
  smartContractId: z.string().min(1),
  visibility: z.enum(['private', 'public']),
})

type ProjectForm = z.infer<typeof projectSchema>

export function ProjectComposer({ openByDefault = false }: { openByDefault?: boolean }) {
  const [open, setOpen] = useState(openByDefault)
  const navigate = useNavigate()
  const smartContracts = useExecStore((state) => state.smartContracts)
  const createProject = useExecStore((state) => state.createProject)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { title: '', description: '', smartContractId: smartContracts[0]?.id, visibility: 'private' },
  })

  const close = () => {
    reset()
    setOpen(false)
  }

  const onSubmit = (values: ProjectForm) => {
    const projectId = createProject(values)
    navigate(`/projects/${projectId}`)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rail bg-white/72 px-3 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"
      >
        <FolderPlus size={16} aria-hidden="true" />
        新建项目
      </button>
    )
  }

  return (
    <form className="rounded-md border border-rail bg-white/72 p-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs font-semibold uppercase text-signal">New project</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">建立一个长期执行项目</h2>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="关闭新建项目"
          className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-paper hover:text-ink focus:outline-none focus-visible:shadow-focusline"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-graphite">
        项目决定后续所有节点使用哪一份智能合约。节点创建后不能自行换约，项目升级只作用于新节点。
      </p>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">项目名称</span>
          <input
            className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline"
            placeholder="例如：执行图谱 MVP"
            {...register('title')}
          />
          {errors.title?.message ? <span className="text-sm font-medium text-clay">{errors.title.message}</span> : null}
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">项目描述</span>
          <textarea
            className="min-h-24 rounded-md border border-rail bg-paper px-3 py-3 text-sm leading-6 outline-none focus:border-signal focus:shadow-focusline"
            placeholder="这个项目准备把哪些行动聚拢到同一个结果？"
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
            {...register('smartContractId')}
          >
            {smartContracts.map((smartContract) => (
              <option key={smartContract.id} value={smartContract.id}>
                {smartContract.name} · {smartContract.source === 'official' ? '平台提供' : '自定义'}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-graphite focus:outline-none focus-visible:shadow-focusline sm:w-fit"
        >
          <FolderPlus size={17} aria-hidden="true" />
          创建项目并冻结首个版本
        </button>
      </div>
    </form>
  )
}
