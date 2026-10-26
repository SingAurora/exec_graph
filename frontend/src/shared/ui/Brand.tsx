/** Approved “回应” mark, shared by the application and account entry points. */
export function BrandMark({ size = 'medium', tone = 'default' }: { size?: 'small' | 'medium' | 'large'; tone?: 'default' | 'inverse' }) {
  const sizeClass = { small: 'size-6', medium: 'size-8', large: 'size-10' }[size]
  return (
    <svg className={`${sizeClass} flex-none ${tone === 'inverse' ? 'text-white' : 'text-signal'}`} viewBox="24 24 208 208" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M48 40H108Q128 40 128 60V92C128 124 100 148 68 164L52 136C72 124 88 108 88 96H48Q44 96 44 92V44Q44 40 48 40Z" />
      <path d="M208 216H148Q128 216 128 196V164C128 132 156 108 188 92L204 120C184 132 168 148 168 160H208Q212 160 212 164V212Q212 216 208 216Z" />
    </svg>
  )
}

/** Fixed horizontal brand lockup; navigation belongs to its enclosing link. */
export function Brand({ tone = 'default' }: { tone?: 'default' | 'inverse' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${tone === 'inverse' ? 'text-white' : 'text-ink'}`}><BrandMark tone={tone} /><span className="text-xl font-semibold leading-none tracking-[.12em]">引序</span></span>
  )
}
