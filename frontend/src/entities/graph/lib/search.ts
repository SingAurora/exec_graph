import type { Graph } from '../model/types'
import { findSearchMatch } from '../../../shared/lib/search'

/** Filters supplied graphs by name and introduction without changing their order or scope. */
export function searchGraphs(candidates: Graph[], query: string): Graph[] {
  if (!query.trim()) return candidates
  return candidates.filter((graph) => [graph.title, graph.description].some((field) => findSearchMatch(field, query) !== -1))
}
