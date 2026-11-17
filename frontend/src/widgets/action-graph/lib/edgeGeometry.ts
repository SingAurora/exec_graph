import type { Core, EdgeSingular } from 'cytoscape'

/** A focusable hit path that follows the renderer's actual edge, including its curve. */
export type EdgeHitPath = { id: string; path: string }

/** Reads canvas geometry to keep accessible SVG hover targets aligned with Cytoscape. */
export function getEdgeHitPaths(graph: Core): EdgeHitPath[] {
  return graph.edges().map((edge) => {
    const edgeElement = edge as EdgeSingular
    const source = edgeElement.sourceEndpoint()
    const target = edgeElement.targetEndpoint()
    const control = edgeElement.controlPoints()?.[0]
    const path = control
      ? `M ${source.x} ${source.y} Q ${control.x} ${control.y} ${target.x} ${target.y}`
      : `M ${source.x} ${source.y} L ${target.x} ${target.y}`
    return { id: edge.id(), path }
  })
}

/** Center points for standard SVG checkmarks on satisfied references. */
export type EdgeMarker = { id: string; x: number; y: number }

/** Reads satisfied edge centers using the same rendered coordinates as the hit path. */
export function getSatisfiedEdgeMarkers(graph: Core): EdgeMarker[] {
  return graph.edges().filter((edge) => edge.hasClass('satisfied')).map((edge) => {
    const edgeElement = edge as EdgeSingular
    const source = edgeElement.sourceEndpoint()
    const target = edgeElement.targetEndpoint()
    const control = edgeElement.controlPoints()?.[0]
    return control
      ? { id: edge.id(), x: source.x * 0.25 + control.x * 0.5 + target.x * 0.25, y: source.y * 0.25 + control.y * 0.5 + target.y * 0.25 }
      : { id: edge.id(), x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 }
  })
}
