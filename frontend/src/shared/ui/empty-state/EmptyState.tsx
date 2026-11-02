import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/** 公共空状态：统一的轻量 SVG 插画、标题和可选操作，供列表、图栏目和搜索结果复用。 */
export function EmptyState({ title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`}>
      <EmptyStateIllustration />
      <div className="grid max-w-sm gap-1">
        <p className="text-[15px] font-medium text-ink">{title}</p>
        {description && <p className="text-xs leading-5 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** 空状态公共插画；使用主题变量，随明暗主题变化，不依赖外部图片资源。 */
export function EmptyStateIllustration() {
  return (
    <svg className="h-auto w-[148px]" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="80" cy="101" rx="46" ry="7" fill="var(--soft)" />
      <circle cx="78" cy="62" r="15" stroke="var(--signal)" strokeWidth="1" strokeDasharray="3 4" opacity=".35" />
      <path d="M42 84C58 80 61 67 78 62C93 57 98 45 108 36" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 6" />
      <path d="M75 63C83 70 94 73 104 71" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 6" />
      <circle cx="42" cy="84" r="8" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
      <circle cx="78" cy="62" r="9" fill="var(--signal-soft)" stroke="var(--signal)" strokeWidth="1.5" />
      <circle cx="109" cy="36" r="7" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
      <path d="M125 55L128 62L135 65L128 68L125 75L122 68L115 65L122 62L125 55Z" fill="var(--signal)" opacity=".55" />
      <path d="M50 41L52 46L57 48L52 50L50 55L48 50L43 48L48 46L50 41Z" fill="var(--line)" opacity=".35" />
    </svg>
  )
}
