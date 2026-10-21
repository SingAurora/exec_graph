import type { Project } from '../model/types'
import { findSearchMatch } from '../../../shared/lib/search'

/** Filters supplied graphs by name and introduction without changing their order or scope. */
export function searchProjects(candidates: Project[], query: string): Project[] {
  if (!query.trim()) return candidates
  return candidates.filter((project) => [project.title, project.description].some((field) => findSearchMatch(field, query) !== -1))
}
