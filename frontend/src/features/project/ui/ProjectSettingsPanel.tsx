import { ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useId, useState, type ChangeEvent, type ReactNode } from 'react'
import type { Project } from '../../../entities/project/model/types'
import { readImageFile } from '../../../shared/lib/image'
import { ProjectAvatar } from '../../../entities/project/ui/ProjectAvatar'
import { defaultProjectBackground } from '../../../entities/project/lib/appearance'
import { useToast } from '../../../shared/ui/toast/useToast'

type ProjectSettingsPanelProps = {
  id?: string
  project: Project
  canEdit?: boolean
  deletionAction?: ReactNode
  onSave: (patch: Pick<Project, 'title' | 'description' | 'avatar' | 'backgroundImage'>) => void
}

/** Edits the identity of an action graph in the page flow. */
export function ProjectSettingsPanel({ id, project, onSave, canEdit = true, deletionAction }: ProjectSettingsPanelProps) {
  const { showToast } = useToast()
  const [title, setTitle] = useState(project.title)
  const [description, setDescription] = useState(project.description)
  const [avatar, setAvatar] = useState(project.avatar ?? '')
  const [backgroundImage, setBackgroundImage] = useState(project.backgroundImage ?? '')

  useEffect(() => {
    setTitle(project.title)
    setDescription(project.description)
    setAvatar(project.avatar ?? '')
    setBackgroundImage(project.backgroundImage ?? '')
  }, [project])

  const submit = () => {
    if (!title.trim()) return
    onSave({ title: title.trim(), description: description.trim(), avatar: avatar.trim() || undefined, backgroundImage: backgroundImage.trim() || undefined })
    showToast({ kind: 'info', message: '已保存' })
  }

  return <section id={id} className="mt-5 rounded-lg border border-line bg-surface px-6 py-5 max-[700px]:px-4" aria-label="图设置">
    <div className="border-b border-line pb-4"><h3 className="text-[16px] font-semibold">图设置</h3></div>
    {canEdit && <form className="mt-5 grid gap-3" onSubmit={(event) => { event.preventDefault(); submit() }}>
      <label className="grid gap-1.5 text-xs font-semibold text-ink" htmlFor="graph-title">图标题<input id="graph-title" className="h-10 rounded-md border border-line bg-paper px-3 text-[13px] font-normal outline-none focus:border-signal focus:shadow-[0_0_0_3px_rgb(35_107_89_/_0.1)]" value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="grid gap-1.5 text-xs font-semibold text-ink" htmlFor="graph-description">图简介<textarea id="graph-description" className="min-h-24 resize-y rounded-md border border-line bg-paper px-3 py-2.5 text-[13px] font-normal leading-[1.6] outline-none focus:border-signal focus:shadow-[0_0_0_3px_rgb(35_107_89_/_0.1)]" value={description} maxLength={240} onChange={(event) => setDescription(event.target.value)} /></label>
      <ProjectImageField label="图头像" value={avatar} fallback={title} kind="avatar" onChange={setAvatar} />
      <ProjectImageField label="背景图" value={backgroundImage} kind="background" onChange={setBackgroundImage} />
      <div className="mt-3 flex justify-end"><button className="primary-button" type="submit" disabled={!title.trim()}>保存</button></div>
    </form>}
    {deletionAction}
  </section>
}

function ProjectImageField({ label, value, fallback, kind, onChange }: { label: string; value: string; fallback?: string; kind: 'avatar' | 'background'; onChange: (value: string) => void }) {
  const inputId = useId()
  const [error, setError] = useState('')
  const previewImage = value || (kind === 'background' ? defaultProjectBackground : '')

  const selectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? []
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件')
      return
    }
    try {
      setError('')
      onChange(await readImageFile(file))
    } catch {
      setError('图片读取失败，请重试')
    }
  }

  return <div className="grid gap-2">
    <span className="text-xs font-semibold text-ink">{label}</span>
    <div className="flex items-center gap-3">
      <label className={`group relative grid cursor-pointer place-items-center overflow-hidden border border-dashed border-line bg-paper transition hover:border-signal ${kind === 'avatar' ? 'size-16 rounded-[14px]' : 'h-20 min-w-0 flex-1 max-w-[320px] rounded-md'}`} htmlFor={inputId}>
        {kind === 'avatar' ? <ProjectAvatar project={{ title: fallback ?? '', avatar: value }} size="settings" /> : <span className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url("${previewImage}")` }} aria-hidden="true" />}
        <span className="absolute inset-0 grid place-items-center bg-black/45 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"><ImagePlus size={18} /><span className="sr-only">{value ? '更换图片' : '上传图片'}</span></span>
      </label>
      <input id={inputId} className="sr-only" type="file" accept="image/*" aria-label={`上传${label}`} onChange={selectImage} />
      {value && <button className="text-button shrink-0" type="button" onClick={() => { setError(''); onChange('') }}><Trash2 size={14} />{kind === 'avatar' ? '使用文字头像' : '恢复默认'}</button>}
    </div>
    {error && <span className="text-[11px] text-coral">{error}</span>}
  </div>
}
