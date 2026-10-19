import { useState } from 'react'
import type { UserProfile } from '../model'
import { getAvatarLabel } from '../lib/avatar'

/** Fixed-size avatar shared by account information and action records. */
export function Avatar({ profile, label, size, tone }: { profile?: UserProfile; label?: string; size: 'tiny' | 'compact' | 'small' | 'medium' | 'large'; tone?: 'blue' | 'coral' }) {
  const [failedImage, setFailedImage] = useState<string>()
  const image = profile?.avatar.trim()
  const sizeClass = { tiny: 'size-6 rounded-[7px] text-[10px]', compact: 'size-7 rounded-lg text-xs', small: 'size-8 rounded-[9px] text-xs', medium: 'size-10 rounded-[11px] text-sm', large: 'size-[68px] rounded-[11px] text-2xl' }[size]
  const toneClass = tone === 'coral' ? 'bg-[#f1dfdc] text-coral dark:bg-[#44312d]' : tone === 'blue' ? 'bg-[#dfeaf0] text-[#4d7894] dark:bg-[#293c49] dark:text-[#8cb6d1]' : 'bg-signal-soft text-signal'
  return <span className={`inline-grid flex-none place-items-center overflow-hidden font-bold ${sizeClass} ${toneClass}`} aria-hidden="true">{image && failedImage !== image ? <img className="size-full object-cover" src={image} alt="" onError={() => setFailedImage(image)} /> : getAvatarLabel(label?.trim() || profile?.name)}</span>
}
