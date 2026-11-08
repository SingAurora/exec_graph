import { ImagePlus, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'
import { ACTION_IMAGE_NOTE_LIMIT } from '../../../entities/action/model/limits'
import { dataUrlToFile, imageCompressionThreshold, loadImage, readImageFile, renderScaledImage } from '../../../shared/lib/image'
import type { PostImage } from '../../../shared/model/content'
import { ImagePreview } from '../../../shared/ui/ImagePreview'
import { retainImages, uploadImage } from '../api/media'

/** 草稿图片先裁剪压缩再上传；只保存站内图片身份，恢复时续期。 */
export function DraftImages({ images, ready, disabled, onChange, onBusyChange }: {
  images: PostImage[]; ready: boolean; disabled: boolean
  onChange: (images: PostImage[]) => void; onBusyChange: (busy: boolean) => void
}) {
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const signature = images.map((image) => image.assetUuid).join(',')
  useEffect(() => {
    if (!ready || !signature) return
    let active = true
    const renew = () => {
      void retainImages(signature.split(',')).catch((error: unknown) => {
        if (active) setError(error instanceof Error ? error.message : '草稿图片续期失败，请重试')
      })
    }
    renew()
    const timer = window.setInterval(renew, 12 * 60 * 60 * 1000)
    return () => { active = false; window.clearInterval(timer) }
  }, [signature, ready])

  const selectImage = async (file: File) => {
    setError('')
    if (!file.type.startsWith('image/')) { setError('请选择图片文件'); return }
    setUploading(true); onBusyChange(true)
    try {
      // 不假设图片比例：保持完整画面，只按最长边缩放并压缩。
      const source = await readImageFile(file)
      const image = await loadImage(source)
      const compressed = renderScaledImage(image, { maxWidth: 1600, maxHeight: 1600, quality: file.size > imageCompressionThreshold ? .78 : .88 })
      const asset = await uploadImage(dataUrlToFile(compressed, 'action-image.jpg'))
      await retainImages([asset.assetUuid])
      onChange([...images, { assetUuid: asset.assetUuid, url: asset.url, alt: '' }])
    } catch (error) { setError(error instanceof Error ? error.message : '图片处理失败，请选择其他图片') }
    finally { setUploading(false); onBusyChange(false) }
  }

  return (
    <>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button className="quiet-button" type="button" disabled={!ready || disabled || uploading || images.length >= 12} onClick={() => input.current?.click()}><ImagePlus size={15} />{uploading ? '处理中…' : '添加图片'}</button>
          <span className="text-xs text-muted">{images.length}/12</span>
        </div>
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" ref={input} title="上传行动配图" disabled={!ready || disabled || uploading} onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = ''
          if (file && images.length < 12 && !uploading) void selectImage(file)
        }} />
        {images.map((image, index) => {
          const count = [...image.alt].length
          return <div className="flex items-start gap-3" key={image.assetUuid}>
            <button className="h-16 w-20 flex-none overflow-hidden rounded border border-line p-0 transition hover:opacity-90" type="button" title={`查看图片 ${index + 1} 大图`} onClick={() => setPreviewIndex(index)}>
              <img className="size-full object-cover" src={image.url} alt={image.alt || `图片 ${index + 1}`} />
            </button>
            <div className="grid min-w-0 flex-1 gap-1">
              <textarea className="form-input h-[58px] min-w-0 resize-none data-[invalid=true]:border-coral" data-invalid={!image.alt.trim()} title={`图片 ${index + 1} 备注（必填）`} placeholder="图片备注（必填，最多30字，AI 用它决定放在正文哪里）" value={image.alt} maxLength={ACTION_IMAGE_NOTE_LIMIT} rows={2} disabled={disabled || uploading} onChange={(event) => onChange(images.map((item, at) => at === index ? { ...item, alt: event.target.value } : item))} />
              <span className={`justify-self-end text-[11px] leading-4 tabular-nums ${count >= ACTION_IMAGE_NOTE_LIMIT ? 'text-coral' : 'text-muted'}`} title={`最多 ${ACTION_IMAGE_NOTE_LIMIT} 字`}>{count}/{ACTION_IMAGE_NOTE_LIMIT}</span>
            </div>
            <button className="icon-button" type="button" title="移除图片" disabled={disabled || uploading} onClick={() => { setError(''); onChange(images.filter((_, at) => at !== index)) }}><X size={15} /></button>
          </div>
        })}
        {error && <p className="text-xs text-coral">{error}</p>}
      </div>
      <Dialog.Root open={previewIndex !== null} onOpenChange={(open) => { if (!open) setPreviewIndex(null) }}>
        <ImagePreview images={images} selectedIndex={previewIndex} onSelectImage={setPreviewIndex} />
      </Dialog.Root>
    </>
  )
}
