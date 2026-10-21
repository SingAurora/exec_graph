import type { ComponentProps } from 'react'
import { GraphDirectory } from '../widgets/graphs/GraphDirectory'

/** Composes the public graph directory. */
export function ProjectsPage(props: ComponentProps<typeof GraphDirectory>) {
  return <GraphDirectory {...props} />
}
