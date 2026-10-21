import { ProjectDetail, type ProjectDetailProps } from '../widgets/project-detail/ui/ProjectDetail'

/** Composes the graph workspace without owning its business or reading state. */
export function ProjectPage(props: ProjectDetailProps) {
  return <ProjectDetail {...props} />
}
