import { useState } from 'react'
import type { UserProfile } from '../model'
import { getAvatarLabel } from '../lib/avatar'

/** Fixed-size avatar shared by account information and action records. */
export function Avatar({ profile, label, size, tone, shape = 'rounded' }: { profile?: UserProfile; label?: string; size: 'tiny' | 'compact' | 'small' | 'medium' | 'large'; tone?: 'blue' | 'coral'; shape?: 'rounded' | 'circle' }) {
  const [failedImage, setFailedImage] = useState<string>()
  const image = profile?.avatar.trim()
  const sizeClass = { tiny: 'size-6 text-[10px]', compact: 'size-7 text-xs', small: 'size-8 text-xs', medium: 'size-10 text-sm', large: 'size-[68px] text-2xl' }[size]
  const shapeClass = shape === 'circle' ? 'rounded-full' : { tiny: 'rounded-[7px]', compact: 'rounded-lg', small: 'rounded-[9px]', medium: 'rounded-[11px]', large: 'rounded-[11px]' }[size]
  const toneClass = tone === 'coral' ? 'bg-[#f1dfdc] text-coral dark:bg-[#44312d]' : tone === 'blue' ? 'bg-[#dfeaf0] text-[#4d7894] dark:bg-[#293c49] dark:text-[#8cb6d1]' : 'bg-signal-soft text-signal'
  return <span className={`inline-grid flex-none place-items-center overflow-hidden font-bold ${sizeClass} ${shapeClass} ${toneClass}`} aria-hidden="true">{image && failedImage !== image ? <img className="size-full object-cover" src={image} alt="" onError={() => setFailedImage(image)} /> : getAvatarLabel(label?.trim() || profile?.name)}</span>
}
