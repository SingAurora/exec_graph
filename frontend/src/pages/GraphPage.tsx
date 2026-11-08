import { GraphDetail, type GraphDetailProps } from '../widgets/graph-detail/ui/GraphDetail'

/** 图详情页只编排 widget；内容 Tab、节点选择和阅读状态都由 GraphDetail 管理。 */
export function GraphPage(props: GraphDetailProps) {
  return (
    <GraphDetail {...props} />
  )
}
