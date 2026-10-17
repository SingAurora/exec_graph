import type { UserProfile } from '../model'

/** Fixed-size avatar shared by account information and action records. */
export function Avatar({ profile, label, size, tone }: { profile?: UserProfile; label?: string; size: 'tiny' | 'small' | 'medium' | 'large'; tone?: 'blue' | 'coral' }) {
  const sizeClass = { tiny: 'size-6 rounded-[7px] text-[10px]', small: 'size-8 rounded-[9px] text-xs', medium: 'size-10 rounded-[11px] text-sm', large: 'size-[68px] rounded-[11px] text-2xl' }[size]
  const toneClass = tone === 'coral' ? 'bg-[#f1dfdc] text-coral' : tone === 'blue' ? 'bg-[#dfeaf0] text-[#4d7894]' : 'bg-[#dce9e3] text-signal-dark'
  return <span className={`inline-grid flex-none place-items-center overflow-hidden font-bold ${sizeClass} ${toneClass}`} aria-hidden="true">{profile?.avatar ? <img className="size-full object-cover" src={profile.avatar} alt="" /> : label ?? profile?.name.slice(0, 1) ?? 'A'}</span>
}
