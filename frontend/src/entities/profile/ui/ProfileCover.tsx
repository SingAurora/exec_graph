import { useState } from 'react'
import defaultProfileBackground from '../../../../assets/profile-cover-landscape.jpg'
import { ImagePreviewTrigger } from '../../../shared/ui/ImagePreviewTrigger'

/** Profile cover with a landscape fallback shared by the public header and settings preview. */
export function ProfileCover({ image, size, preview = false }: { image?: string; size: 'header' | 'preview' | 'sidebar'; preview?: boolean }) {
  const [failedImage, setFailedImage] = useState<string>()
  const sizeClass = { header: 'aspect-[5/1] rounded-lg', preview: 'aspect-[5/1] rounded-lg', sidebar: 'h-16' }[size]
  const source = image && image !== failedImage ? image : defaultProfileBackground
  return <div className={`relative overflow-hidden bg-soft ${sizeClass}`} aria-label="主页背景">
    {source !== failedImage && <img className="absolute inset-0 size-full object-cover" src={source} alt="" onError={() => setFailedImage(source)} />}
    {preview && source !== failedImage && <ImagePreviewTrigger image={{ url: source, alt: '主页背景' }} className="absolute inset-0 size-full rounded-lg" />}
  </div>
}
