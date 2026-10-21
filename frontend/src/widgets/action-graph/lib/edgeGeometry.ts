import type { Core } from 'cytoscape'

/** A focusable hit path that follows the renderer's actual edge, including its curve. */
export type EdgeHitPath = { id: string; path: string }

/** Reads canvas geometry to keep accessible SVG hover targets aligned with Cytoscape. */
export function getEdgeHitPaths(graph: Core): EdgeHitPath[] {
  return graph.edges().map((edge) => {
    const source = edge.sourceEndpoint()
    const target = edge.targetEndpoint()
    const control = edge.controlPoints()?.[0]
    const path = control
      ? `M ${source.x} ${source.y} Q ${control.x} ${control.y} ${target.x} ${target.y}`
      : `M ${source.x} ${source.y} L ${target.x} ${target.y}`
    return { id: edge.id(), path }
  })
}
