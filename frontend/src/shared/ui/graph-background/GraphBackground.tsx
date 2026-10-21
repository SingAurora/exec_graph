import { useId } from 'react'
import type { GraphBackgroundPreferences } from './model'

/** Shared theme-aware canvas texture used by the graph and its appearance previews. */
export function GraphBackground({ preferences }: { preferences: GraphBackgroundPreferences }) {
  const id = useId()
  if (preferences.style === 'plain') return null
  const pattern = preferences[preferences.style]
  const spacing = pattern.spacing
  const center = spacing / 2
  const opacity = { light: 0.12, standard: 0.22, strong: 0.35 }[pattern.intensity]
  return <svg className="pointer-events-none absolute inset-0 size-full text-signal" aria-hidden="true">
    <defs><pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
      {preferences.style === 'dots' && <circle cx={center} cy={center} r={preferences.dots.size / 2} fill="currentColor" />}
      {preferences.style === 'grid' && <path d={`M0 ${spacing} V0 H${spacing}`} fill="none" stroke="currentColor" strokeWidth={preferences.grid.lineWidth} />}
      {preferences.style === 'crosses' && <path d={`M${center - preferences.crosses.size / 2} ${center} h${preferences.crosses.size} M${center} ${center - preferences.crosses.size / 2} v${preferences.crosses.size}`} fill="none" stroke="currentColor" strokeWidth={preferences.crosses.lineWidth} />}
    </pattern></defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
  </svg>
}
