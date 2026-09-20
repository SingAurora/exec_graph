import { Archive, ArchiveRestore, Settings2, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useWorkspaceStore as useExecStore } from '@/features/workspace/model/useWorkspaceStore'
import type { Project } from '@/entities/project/model/types'

export function ProjectProfileSettings({
  project,
  isArchived,
  onUpdateProjectProfile,
  onSetProjectSmartContract,
  onArchiveProject,
  onRestoreArchivedProject,
  onDeleteProject,
}: {
  project: Project
  isArchived: boolean
  onUpdateProjectProfile: (input: { title: string; description: string; visibility: Project['visibility'] }) => Promise<{ success: boolean; message?: string }>
  onSetProjectSmartContract: (smartContractUuid: string) => Promise<{ success: boolean; message?: string }>
  onArchiveProject: () => Promise<{ success: boolean; message?: string }>
  onRestoreArchivedProject: () => Promise<{ success: boolean; message?: string }>
  onDeleteProject: () => Promise<void>
}) {
  return (
    <div className="grid max-w-3xl gap-4">
      {isArchived ? (
        <div className="border-l-2 border-graphite py-2 pl-4 text-sm leading-6 text-graphite">项目资料已锁定为只读记录。</div>
      ) : (
        <ProjectDetailsSettings key={project.uuid} project={project} onSave={onUpdateProjectProfile} />
      )}
      {!isArchived && project.projectType === 'autonomous' ? <ProjectContractSettings project={project} onUpgrade={onSetProjectSmartContract} /> : null}
      <ProjectDangerZone isArchived={isArchived} projectTitle={project.title} onArchive={onArchiveProject} onRestore={onRestoreArchivedProject} onDelete={onDeleteProject} />
    </div>
  )
}

function ProjectContractSettings({ project, onUpgrade }: { project: Project; onUpgrade: (smartContractUuid: string) => Promise<{ success: boolean; message?: string }> }) {
  const smartContracts = useExecStore((state) => state.smartContracts)
  const activeRevision = project.contractRevisions.find((revision) => revision.uuid === project.activeContractRevisionUuid) ?? project.contractRevisions[0]
  const [selectedID, setSelectedID] = useState(activeRevision?.smartContractUuid ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const officialContracts = smartContracts.filter((contract) => contract.source === 'official')
  const customContracts = smartContracts.filter((contract) => contract.source === 'custom')
  const selected = smartContracts.find((contract) => contract.uuid === selectedID)

  useEffect(() => {
    setSelectedID(activeRevision?.smartContractUuid ?? '')
  }, [activeRevision?.smartContractUuid])

  const save = async () => {
    if (!selectedID || selectedID === activeRevision?.smartContractUuid) return
    setIsSaving(true)
    setMessage('')
    const result = await onUpgrade(selectedID)
    setMessage(result.success ? '项目智能合约已更新，新行动会使用这套规则。' : (result.message ?? '项目智能合约更新失败。'))
    setIsSaving(false)
  }

  return (
    <section className="rounded-md border border-rail bg-surface/72 p-5">
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><ShieldCheck size={17} aria-hidden="true" />Project contract</div>
      <h2 className="mt-2 font-display text-2xl font-semibold">项目智能合约</h2>
      <p className="mt-3 text-sm leading-6 text-graphite">自主推进型项目可以更换后续行动的审查规则。已经创建的行动保留创建时的合约版本。</p>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">当前使用的规则</span>
          <select value={selectedID} onChange={(event) => { setSelectedID(event.target.value); setMessage('') }} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline">
            <optgroup label="平台规则">
              {officialContracts.map((contract) => <option key={contract.uuid} value={contract.uuid}>{contract.name} · {contract.description}</option>)}
            </optgroup>
            {customContracts.length > 0 ? <optgroup label="我的自定义规则">{customContracts.map((contract) => <option key={contract.uuid} value={contract.uuid}>{contract.name}</option>)}</optgroup> : null}
          </select>
        </label>
        {selected ? <p className="border-l-2 border-signal py-2 pl-3 text-sm leading-6 text-graphite"><span className="font-semibold text-ink">{selected.name}</span>：{selected.description}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={isSaving || !selectedID || selectedID === activeRevision?.smartContractUuid} onClick={() => void save()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:shadow-focusline"><ShieldCheck size={16} aria-hidden="true" />{isSaving ? '正在保存' : '保存智能合约'}</button>
          {message ? <span className={`text-sm font-semibold ${message.includes('失败') || message.includes('不能') ? 'text-clay' : 'text-signal'}`}>{message}</span> : null}
        </div>
      </div>
    </section>
  )
}

function ProjectDetailsSettings({ project, onSave }: { project: Project; onSave: (input: { title: string; description: string; visibility: Project['visibility'] }) => Promise<{ success: boolean; message?: string }> }) {
  const [title, setTitle] = useState(project.title)
  const [description, setDescription] = useState(project.description)
  const [visibility, setVisibility] = useState<Project['visibility']>(project.visibility)
  const [message, setMessage] = useState('')

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) {
      setMessage('项目名称不能为空。')
      return
    }
    const result = await onSave({ title, description, visibility })
    setMessage(result.success ? '项目资料已更新。' : (result.message ?? '项目资料更新失败。'))
  }

  return (
    <section className="rounded-md border border-rail bg-surface/72 p-5">
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
        <Settings2 size={17} aria-hidden="true" />
        Project profile
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold">编辑项目资料</h2>
      <form className="mt-5 grid gap-4" onSubmit={save}>
        <label className="grid gap-2"><span className="text-sm font-semibold text-ink">项目名称</span><input value={title} onChange={(event) => { setTitle(event.target.value); setMessage('') }} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold text-ink">项目描述（可选）</span><textarea value={description} onChange={(event) => { setDescription(event.target.value); setMessage('') }} className="min-h-24 rounded-md border border-rail bg-paper px-3 py-3 text-sm leading-6 outline-none focus:border-signal focus:shadow-focusline" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold text-ink">项目可见性</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as Project['visibility'])} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline"><option value="private">私人项目</option><option value="public">公开项目</option></select></label>
        <div className="flex flex-wrap items-center gap-3"><button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong focus:outline-none focus-visible:shadow-focusline"><Settings2 size={16} aria-hidden="true" />保存项目资料</button>{message ? <span className="text-sm font-semibold text-signal">{message}</span> : null}</div>
      </form>
    </section>
  )
}

function ProjectDangerZone({
  isArchived,
  projectTitle,
  onArchive,
  onRestore,
  onDelete,
}: {
  isArchived: boolean
  projectTitle: string
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <section className="rounded-md border border-clay/35 bg-clay/5 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-clay">
        <Settings2 size={17} aria-hidden="true" />
        危险操作
      </div>
      <div className="mt-4 divide-y divide-clay/15 border-y border-clay/15">
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <div className="text-sm font-semibold text-ink">{isArchived ? '撤销归档' : '归档项目'}</div>
            <p className="mt-1 text-sm leading-6 text-graphite">{isArchived ? '恢复后可以继续推进节点、提交审查和修改项目设置。' : '归档后项目进入只读，之后可以恢复。'}</p>
          </div>
          {isArchived ? (
            <button type="button" onClick={onRestore} className="inline-flex h-10 items-center gap-2 rounded-md border border-rail bg-surface px-3 text-sm font-semibold text-ink transition hover:border-graphite/50 focus:outline-none focus-visible:shadow-focusline"><ArchiveRestore size={16} aria-hidden="true" />恢复项目</button>
          ) : confirmingArchive ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={onArchive} className="inline-flex h-10 items-center gap-2 rounded-md bg-clay px-3 text-sm font-semibold text-white transition hover:bg-clayStrong focus:outline-none focus-visible:shadow-focusline"><Archive size={16} aria-hidden="true" />确认归档</button>
              <button type="button" onClick={() => setConfirmingArchive(false)} className="inline-flex h-10 items-center px-3 text-sm font-semibold text-graphite transition hover:text-ink focus:outline-none focus-visible:shadow-focusline">取消</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingArchive(true)} className="inline-flex h-10 items-center gap-2 rounded-md border border-clay/40 bg-surface px-3 text-sm font-semibold text-clay transition hover:border-clay focus:outline-none focus-visible:shadow-focusline"><Archive size={16} aria-hidden="true" />归档项目</button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <div className="text-sm font-semibold text-ink">删除项目</div>
            <p className="mt-1 text-sm leading-6 text-graphite">删除「{projectTitle}」以及它的节点、关系和完成记录。</p>
          </div>
          {confirmingDelete ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={onDelete} className="inline-flex h-10 items-center gap-2 rounded-md bg-clay px-3 text-sm font-semibold text-white transition hover:bg-clayStrong focus:outline-none focus-visible:shadow-focusline"><Trash2 size={16} aria-hidden="true" />确认删除</button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="inline-flex h-10 items-center px-3 text-sm font-semibold text-graphite transition hover:text-ink focus:outline-none focus-visible:shadow-focusline">取消</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="inline-flex h-10 items-center gap-2 rounded-md border border-clay/40 bg-surface px-3 text-sm font-semibold text-clay transition hover:border-clay focus:outline-none focus-visible:shadow-focusline"><Trash2 size={16} aria-hidden="true" />删除项目</button>
          )}
        </div>
      </div>
    </section>
  )
}
