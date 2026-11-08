import { ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useId, useState, type ChangeEvent, type ReactNode } from 'react'
import type { Graph } from '../../../entities/graph/model/types'
import { readImageFile } from '../../../shared/lib/image'
import { getPromptDefaults, type PromptDefaults } from '../api/commands'
import { GraphAvatar } from '../../../entities/graph/ui/GraphAvatar'
import { defaultGraphBackground } from '../../../entities/graph/lib/appearance'
import { useToast } from '../../../shared/ui/toast/useToast'
import { ImageCropDialog, type ImageCropSource } from '../../../shared/ui/image-crop/ImageCropDialog'

type GraphSettingsPanelProps = {
  id?: string
  graph: Graph
  canEdit?: boolean
  deletionAction?: ReactNode
  onSave: (patch: Pick<Graph, 'title' | 'description' | 'avatar' | 'backgroundImage'>) => void | Promise<void>
}

/** Edits the identity of an action graph in the page flow. */
export function GraphSettingsPanel({ id, graph, onSave, canEdit = true, deletionAction }: GraphSettingsPanelProps) {
  const { showToast } = useToast()
  const [title, setTitle] = useState(graph.title)
  const [description, setDescription] = useState(graph.description)
  const [avatar, setAvatar] = useState(graph.avatar ?? '')
  const [backgroundImage, setBackgroundImage] = useState(graph.backgroundImage ?? '')
  const [imageLoading, setImageLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [prompts, setPrompts] = useState<PromptDefaults>()
  const [promptError, setPromptError] = useState('')

  useEffect(() => {
    setTitle(graph.title)
    setDescription(graph.description)
    setAvatar(graph.avatar ?? '')
    setBackgroundImage(graph.backgroundImage ?? '')
  }, [graph])

  useEffect(() => {
    let cancelled = false
    getPromptDefaults().then((next) => { if (!cancelled) setPrompts(next) }).catch(() => { if (!cancelled) setPromptError('暂时无法读取默认提示词') })
    return () => { cancelled = true }
  }, [])

  const submit = async () => {
    if (!title.trim() || saving || imageLoading) return
    setSaving(true)
    try {
      await onSave({ title: title.trim(), description: description.trim(), avatar: avatar.trim() || undefined, backgroundImage: backgroundImage.trim() || undefined })
    } catch (error) { showToast({ kind: 'error', message: error instanceof Error ? error.message : '保存失败，请重试' }) }
    finally { setSaving(false) }
  }

  return (
    <section id={id} className="mt-5 rounded-lg border border-line bg-surface px-6 py-5 max-[700px]:px-4">
      <div className="border-b border-line pb-4"><h3 className="text-[16px] font-semibold">图设置</h3></div>
      {canEdit && <form className="mt-5 grid gap-3" onSubmit={(event) => { event.preventDefault(); submit() }}>
        <fieldset className="contents" disabled={saving || imageLoading}>
        <label className="grid gap-1.5 text-xs font-semibold text-ink" htmlFor="graph-title">图标题<input id="graph-title" className="h-10 rounded-md border border-line bg-paper px-3 text-[13px] font-normal outline-none focus:border-signal focus:shadow-[0_0_0_3px_rgb(35_107_89_/_0.1)]" value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="grid gap-1.5 text-xs font-semibold text-ink" htmlFor="graph-description">图简介<textarea id="graph-description" className="min-h-24 resize-y rounded-md border border-line bg-paper px-3 py-2.5 text-[13px] font-normal leading-[1.6] outline-none focus:border-signal focus:shadow-[0_0_0_3px_rgb(35_107_89_/_0.1)]" value={description} maxLength={240} onChange={(event) => setDescription(event.target.value)} /></label>
        <GraphImageField label="图头像" value={avatar} fallback={title} kind="avatar" onChange={setAvatar} onLoadingChange={setImageLoading} />
        <GraphImageField label="背景图" value={backgroundImage} kind="background" onChange={setBackgroundImage} onLoadingChange={setImageLoading} />
        <div className="mt-3 flex justify-end"><button className="primary-button" type="submit" disabled={!title.trim()}>保存</button></div>
        </fieldset>
      </form>}
      <div className="mt-5 grid gap-3 border-t border-line pt-4">
        <div><p className="text-xs font-semibold text-ink">平台默认提示词</p><p className="mt-1 text-[11px] leading-5 text-muted">包含生成目标与核验规则，暂不开放图级编辑；所有用户只读。</p></div>
        {promptError ? <p className="rounded-md border border-line bg-paper px-3 py-2 text-[11px] leading-5 text-muted">{promptError}</p>
          : prompts ? <>
            <DefaultPromptField label="生成目标 · 行动" value={prompts.action} />
            <DefaultPromptField label="生成目标 · 表达" value={prompts.expression} />
            <DefaultPromptField label="生成目标 · 约定" value={prompts.agreement} />
            <details className="rounded-md border border-line bg-paper px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-medium leading-5 text-muted">查看三种核验规则（只读）</summary>
              <div className="mt-3 grid gap-3">
                <DefaultPromptField label="核验规则 · 行动" value={prompts.verificationAction} />
                <DefaultPromptField label="核验规则 · 表达" value={prompts.verificationExpression} />
                <DefaultPromptField label="核验规则 · 约定" value={prompts.verificationAgreement} />
              </div>
            </details>
            <details className="rounded-md border border-line bg-paper px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-medium leading-5 text-muted">查看平台输出契约（只读）</summary>
              <textarea className="mt-2 min-h-28 w-full resize-y rounded-md border border-line bg-soft/50 px-3 py-2 text-[12px] font-normal leading-[1.7] text-muted outline-none" value={prompts.contract} disabled />
            </details>
          </>
            : <p className="text-[11px] leading-5 text-muted">正在读取默认提示词…</p>}
      </div>
      {deletionAction}
    </section>
  )
}

function GraphImageField({ label, value, fallback, kind, onChange, onLoadingChange }: { label: string; value: string; fallback?: string; kind: 'avatar' | 'background'; onChange: (value: string) => void; onLoadingChange: (loading: boolean) => void }) {
  const inputId = useId()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<ImageCropSource>()
  const [cropOpen, setCropOpen] = useState(false)
  const previewImage = value || (kind === 'background' ? defaultGraphBackground : '')

  const selectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? []
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件')
      return
    }
    setLoading(true)
    onLoadingChange(true)
    try {
      setError('')
      setSource({ url: await readImageFile(file), size: file.size })
      setCropOpen(true)
    } catch {
      setError('图片读取失败，请重试')
    } finally {
      setLoading(false)
      onLoadingChange(false)
    }
  }

  return (
    <>
      <div className="grid gap-2">
        <span className="text-xs font-semibold text-ink">{label}</span>
        <div className="flex items-center gap-3">
          <label className={`group relative grid cursor-pointer place-items-center overflow-hidden border border-dashed border-line bg-paper transition hover:border-signal ${kind === 'avatar' ? 'size-16 rounded-[14px]' : 'h-20 min-w-0 flex-1 max-w-[320px] rounded-md'}`} htmlFor={inputId} title={loading ? '正在读取图片' : `编辑${label}`}>
            {kind === 'avatar' ? <GraphAvatar graph={{ title: fallback ?? '', avatar: value }} size="settings" /> : <span className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url("${previewImage}")` }} />}
            <span className="absolute inset-0 grid place-items-center bg-black/45 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"><ImagePlus size={18} /><span className="sr-only">{value ? '更换图片' : '上传图片'}</span></span>
          </label>
          <input id={inputId} className="sr-only" type="file" accept="image/*" title={`上传${label}`} disabled={loading} onChange={selectImage} />
          {value && <button className="text-button shrink-0" type="button" onClick={() => { setError(''); onChange('') }}><Trash2 size={14} />{kind === 'avatar' ? '使用文字头像' : '恢复默认'}</button>}
        </div>
        {error && <span className="text-[11px] text-coral">{error}</span>}
      </div>
      <ImageCropDialog open={cropOpen} image={source} variant={kind === 'avatar' ? 'avatar' : 'graph-cover'} onOpenChange={setCropOpen} onConfirm={onChange} />
    </>
  )
}

function DefaultPromptField({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-ink">
      <span>{label}</span>
      <textarea className="min-h-40 resize-y rounded-md border border-line bg-soft/50 px-3 py-2.5 text-[12px] font-normal leading-[1.7] text-muted outline-none" value={value} readOnly />
    </label>
  )
}
