import { ProjectDetail, type ProjectDetailProps } from '../widgets/project-detail/ui/ProjectDetail'

/** 图详情页只编排 widget；内容 Tab、节点选择和阅读状态都由 ProjectDetail 管理。 */
export function ProjectPage(props: ProjectDetailProps) {
  return (
    <ProjectDetail {...props} />
  )
}
