/** Available presentation styles for graph canvases. */
export type GraphBackgroundStyle = 'plain' | 'dots' | 'grid' | 'crosses'

/** Theme-relative pattern contrast. */
export type GraphPatternIntensity = 'light' | 'standard' | 'strong'

type PatternSettings = { spacing: number; intensity: GraphPatternIntensity }

/** Personal canvas appearance; each pattern retains its own settings. */
export type GraphBackgroundPreferences = {
  style: GraphBackgroundStyle
  dots: PatternSettings & { size: number }
  grid: PatternSettings & { lineWidth: number }
  crosses: PatternSettings & { size: number; lineWidth: number }
}

/** Returns independent defaults so resets never mutate another preference snapshot. */
export function createDefaultGraphBackground(): GraphBackgroundPreferences {
  return {
    style: 'dots',
    dots: { spacing: 24, intensity: 'light', size: 2 },
    grid: { spacing: 24, intensity: 'light', lineWidth: 1 },
    crosses: { spacing: 24, intensity: 'light', size: 4, lineWidth: 1 },
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function bounded(value: unknown, fallback: number, min: number, max: number, step = 1) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.max(min, Math.min(max, value)) / step) * step : fallback
}

function intensity(value: unknown): GraphPatternIntensity {
  return value === 'standard' || value === 'strong' ? value : 'light'
}

/** Validates saved preferences and restores missing or unsupported values safely. */
export function normalizeGraphBackground(value: unknown): GraphBackgroundPreferences {
  const saved = asRecord(value)
  const dots = asRecord(saved.dots)
  const grid = asRecord(saved.grid)
  const crosses = asRecord(saved.crosses)
  return {
    style: saved.style === 'plain' || saved.style === 'grid' || saved.style === 'crosses' ? saved.style : 'dots',
    dots: { spacing: bounded(dots.spacing, 24, 16, 40), intensity: intensity(dots.intensity), size: bounded(dots.size, 2, 1, 3, 0.5) },
    grid: { spacing: bounded(grid.spacing, 24, 16, 40), intensity: intensity(grid.intensity), lineWidth: bounded(grid.lineWidth, 1, 0.5, 1.5, 0.5) },
    crosses: { spacing: bounded(crosses.spacing, 24, 16, 40), intensity: intensity(crosses.intensity), size: bounded(crosses.size, 4, 4, 8), lineWidth: bounded(crosses.lineWidth, 1, 0.5, 1.5, 0.5) },
  }
}
