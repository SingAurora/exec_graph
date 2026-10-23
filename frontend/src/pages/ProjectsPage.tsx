import type { ComponentProps } from 'react'
import { GraphDirectory } from '../widgets/graphs/GraphDirectory'

/** 图目录页面入口，列表、搜索和创建入口交给 GraphDirectory。 */
export function ProjectsPage(props: ComponentProps<typeof GraphDirectory>) {
  return <GraphDirectory {...props} />
}
