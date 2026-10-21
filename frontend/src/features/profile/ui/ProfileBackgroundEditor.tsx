import { ImagePlus, RotateCcw } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { ProfileCover } from '../../../entities/profile/ui/ProfileCover'
import { readImageFile } from '../../../shared/lib/image'
import { ImageCropDialog, type ImageCropSource } from '../../../shared/ui/image-crop/ImageCropDialog'

/** Crops and compresses a local profile cover before updating the profile form draft. */
export function ProfileBackgroundEditor({ value, onChange, onLoadingChange }: {
  value?: string
  onChange: (image: string | undefined) => void
  onLoadingChange: (loading: boolean) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<ImageCropSource>()
  const [open, setOpen] = useState(false)
  const selectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? []
    event.target.value = ''
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) { setError('请选择图片文件'); return }
    setLoading(true)
    onLoadingChange(true)
    try {
      setSource({ url: await readImageFile(file), size: file.size })
      setOpen(true)
    } catch {
      setError('图片无法读取，请选择其他图片')
    } finally {
      setLoading(false)
      onLoadingChange(false)
    }
  }
  return <div className="grid gap-2.5" role="group" aria-label="主页背景图">
    <span className="text-sm font-medium">主页背景图</span>
    <ProfileCover image={value} size="preview" />
    <div className="flex items-center gap-3">
      <button className="quiet-button" type="button" disabled={loading} aria-describedby={error ? errorId : undefined} onClick={() => input.current?.click()}><ImagePlus size={15} />{loading ? '读取中…' : value ? '更换背景图' : '上传背景图'}</button>
      {value && <button className="text-button" type="button" disabled={loading} onClick={() => { setError(''); onChange(undefined) }}><RotateCcw size={14} />恢复默认</button>}
    </div>
    <input className="sr-only" ref={input} type="file" accept="image/*" aria-label="上传主页背景图" disabled={loading} onChange={selectImage} />
    {error && <p className="text-xs text-coral" id={errorId} role="alert">{error}</p>}
    <ImageCropDialog open={open} image={source} variant="cover" onOpenChange={setOpen} onConfirm={onChange} />
  </div>
}
