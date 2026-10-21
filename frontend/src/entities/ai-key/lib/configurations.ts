import type { AIKeyConfig } from '../model/types'

function creationTime(config: AIKeyConfig) {
  const timestamp = Date.parse(config.createdAt ?? '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

/** Pins platform configurations, then the active personal key, followed by newest personal keys. */
export function sortAIKeyConfigs(configs: readonly AIKeyConfig[]): AIKeyConfig[] {
  return [...configs].sort((left, right) => {
    const leftPlatform = left.source === 'platform'
    const rightPlatform = right.source === 'platform'
    if (leftPlatform !== rightPlatform) return leftPlatform ? -1 : 1
    if (leftPlatform) return 0
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
    return creationTime(right) - creationTime(left)
  })
}
