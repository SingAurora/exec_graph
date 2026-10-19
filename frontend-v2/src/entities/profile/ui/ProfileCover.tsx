import { useState } from 'react'

/** Theme-aware profile cover shared by the public header and settings preview. */
export function ProfileCover({ image, size }: { image?: string; size: 'header' | 'preview' }) {
  const [failedImage, setFailedImage] = useState<string>()
  const height = { header: 'h-44', preview: 'h-28' }[size]
  return <div className={`relative overflow-hidden rounded-lg bg-linear-to-br from-signal-soft via-soft to-paper ${height}`} aria-label="主页背景">
    {image && image !== failedImage && <img className="absolute inset-0 size-full object-cover" src={image} alt="" onError={() => setFailedImage(image)} />}
  </div>
}
