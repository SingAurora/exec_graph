import type { ComponentPropsWithoutRef } from 'react'

type BrandLogoProps = {
  compact?: boolean
  tagline?: string
  className?: string
}

export function BrandMark({ className = 'size-11' }: Pick<ComponentPropsWithoutRef<'svg'>, 'className'>) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="5" fill="rgb(var(--color-inverse))" />
      <path d="M12 14L22 24L12 34" stroke="rgb(var(--color-surface))" strokeWidth="2.75" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M27 33H35" stroke="rgb(var(--color-surface))" strokeWidth="2.75" strokeLinecap="square" />
      <path d="M37 29.5H41V34.5L38.5 37H37V29.5Z" fill="rgb(var(--color-moss))" />
    </svg>
  )
}

export function BrandLogo({ compact = false, tagline = '行为，验证，记录，推进', className = '' }: BrandLogoProps) {
  if (compact) return <BrandMark className={`text-ink ${className}`} />

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <BrandMark className="size-11 shrink-0 text-ink" />
      <span className="min-w-0">
        <span className="block font-mono text-3xl font-semibold leading-none text-ink">ExecG</span>
        {tagline ? <span className="mt-1.5 block text-sm leading-5 text-graphite">{tagline}</span> : null}
      </span>
    </span>
  )
}
