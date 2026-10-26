import { ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PostImage } from '../../../shared/model/content'
import { retainImages, uploadImage } from '../api/media'

/** 草稿只存站内图片身份，恢复时续期；移除的未引用图片交给服务端回收。 */
export function DraftImages({ images, csrfToken, ready, disabled, onChange, onBusyChange }: {
  images: PostImage[]; csrfToken: string; ready: boolean; disabled: boolean
  onChange: (images: PostImage[]) => void; onBusyChange: (busy: boolean) => void
}) {
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const signature = images.map((image) => image.assetId).join(',')
  useEffect(() => {
    if (!ready || !signature) return
    let active = true
    const renew = () => {
      void retainImages(signature.split(','), csrfToken).catch((error: unknown) => {
        if (active) setError(error instanceof Error ? error.message : '草稿图片续期失败，请重试')
      })
    }
    renew()
    const timer = window.setInterval(renew, 12 * 60 * 60 * 1000)
    return () => { active = false; window.clearInterval(timer) }
  }, [signature, csrfToken, ready])
  return (
    <div className="mb-5 grid gap-3" aria-label="行动配图">
      <div className="flex flex-wrap items-center gap-3">
        <button className="quiet-button" type="button" disabled={!ready || disabled || uploading || images.length >= 12} onClick={() => input.current?.click()}><ImagePlus size={15} />{uploading ? '上传中…' : '添加图片'}</button>
        <span className="text-xs text-muted">{images.length}/12</span>
      </div>
      <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" ref={input} aria-label="上传行动配图" disabled={!ready || disabled || uploading} onChange={async (event) => {
        const file = event.target.files?.[0]; event.target.value = ''
        if (!file || images.length >= 12 || uploading) return
        setUploading(true); onBusyChange(true); setError('')
        try {
          const asset = await uploadImage(file, csrfToken)
          await retainImages([asset.assetId], csrfToken)
          onChange([...images, { assetId: asset.assetId, url: asset.url, alt: '' }])
        } catch (error) { setError(error instanceof Error ? error.message : '图片上传失败，请重试') }
        finally { setUploading(false); onBusyChange(false) }
      }} />
      {images.map((image, index) => <div className="flex items-center gap-3" key={image.assetId}>
        <img className="h-16 w-20 flex-none rounded border border-line object-cover" src={image.url} alt={image.alt} />
        <input className="form-input min-w-0 flex-1" aria-label={`图片 ${index + 1} 说明`} placeholder="图片说明" value={image.alt} maxLength={200} disabled={disabled || uploading} onChange={(event) => onChange(images.map((item, at) => at === index ? { ...item, alt: event.target.value } : item))} />
        <button className="icon-button" type="button" aria-label={`移除图片 ${index + 1}`} title="移除图片" disabled={disabled || uploading} onClick={() => { setError(''); onChange(images.filter((_, at) => at !== index)) }}><X size={15} /></button>
      </div>)}
      {error && <p className="text-xs text-coral" role="alert">{error}</p>}
    </div>
  )
}
