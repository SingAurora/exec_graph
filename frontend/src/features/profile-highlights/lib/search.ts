import type { ProfileHighlightEntry } from '../../../entities/action/lib/profile-highlights'
import type { Project } from '../../../entities/project/model/types'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'
import { findSearchMatch } from '../../../shared/lib/search'

/** 在完整候选集中搜索表达、行动标题、分支约定及图名，保留原有顺序和节点身份。 */
export function searchHighlightCandidates(candidates: ProfileHighlightEntry[], projects: Project[], keyword: string): ProfileHighlightEntry[] {
  if (!keyword.trim()) return candidates
  const titles = new Map(projects.map((project) => [project.id, project.title]))
  return candidates.filter(({ node, markdown, agreement }) => [
    node.title, `#${node.number}`, titles.get(node.projectId) ?? '', getMarkdownSummary(markdown), getMarkdownSummary(agreement.markdown),
  ].some((text) => findSearchMatch(text, keyword) !== -1))
}
