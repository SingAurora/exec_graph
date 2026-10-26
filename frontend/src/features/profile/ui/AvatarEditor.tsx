import { ImagePlus } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { getAvatarLabel } from '../../../shared/lib/avatar'
import { readImageFile } from '../../../shared/lib/image'
import { ImageCropDialog, type ImageCropSource } from '../../../shared/ui/image-crop/ImageCropDialog'

type AvatarEditorProps = {
  value: string
  fallback: string
  onChange: (avatar: string) => void
}

/** Provides local avatar selection, square cropping, zooming, and compression. */
export function AvatarEditor({ value, fallback, onChange }: AvatarEditorProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<ImageCropSource>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const openFilePicker = () => {
    if (inputRef.current) inputRef.current.value = ''
    inputRef.current?.click()
  }

  const selectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? []
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) { setError('请选择图片文件'); return }
    setLoading(true)
    try {
      setSource({ url: await readImageFile(file), size: file.size })
      setOpen(true)
    } catch {
      setError('图片无法读取，请选择其他图片')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="grid shrink-0 justify-items-start gap-2">
      <button className="group relative grid size-[88px] flex-none place-items-center overflow-hidden rounded-xl border-0 bg-transparent p-0" type="button" onClick={openFilePicker} aria-label="编辑头像" disabled={loading}>
        <span className={`inline-grid size-[88px] place-items-center overflow-hidden rounded-[11px] bg-signal-soft text-[27px] font-bold text-signal${value ? ' bg-cover bg-center bg-no-repeat' : ''}`} style={value ? { backgroundImage: `url("${value}")` } : undefined}>{value ? '' : getAvatarLabel(fallback)}</span>
        <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/55 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"><ImagePlus size={20} /><span className="sr-only">编辑头像</span></span>
      </button>
      <input ref={inputRef} id={inputId} className="sr-only" type="file" accept="image/*" onChange={selectImage} />
      {value && <button className="text-button text-xs" type="button" onClick={() => onChange('')}>使用文字头像</button>}
      {error && <p className="max-w-48 text-xs text-coral" role="alert">{error}</p>}
      </div>
      <ImageCropDialog open={open} image={source} variant="avatar" onOpenChange={setOpen} onConfirm={onChange} />
    </>
  )
}
