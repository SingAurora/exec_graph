import { getGraphActivity } from '../../../entities/project/lib/activity'
import type { GraphActivity } from '../../../entities/project/model/types'
import type { ActionNode } from '../../../entities/action/model/types'
import type { Project } from '../../../shared/model'
import { findSearchMatch } from '../../../shared/lib/search'

/** Searches every public graph by name or introduction, ordered by real activity then creation. */
export function searchPublicGraphs(projects: Project[], actions: ActionNode[], keyword: string): GraphActivity[] {
  const query = keyword.trim()
  if (!query) return []
  return projects.filter((project) => findSearchMatch(project.title, query) !== -1 || findSearchMatch(project.description, query) !== -1)
    .map((project) => getGraphActivity(project, actions))
    .sort((left, right) => Date.parse(right.lastActionAt ?? right.project.createdAt) - Date.parse(left.lastActionAt ?? left.project.createdAt)
      || left.project.id.localeCompare(right.project.id))
}
