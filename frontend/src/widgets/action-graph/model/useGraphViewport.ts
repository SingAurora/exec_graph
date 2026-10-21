import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Core, SingularElementReturnValue } from 'cytoscape'
import { getGraphViewport, GRAPH_ZOOM } from '../lib/viewport'

type Props = {
  graphRef: RefObject<Core | null>
  container: RefObject<HTMLDivElement | null>
  targets: RefObject<HTMLDivElement | null>
  active: boolean
  focusId?: string
  selectionId?: string
  focusRequest: number
  locateRequest: number
  generation: unknown
  onMove: () => void
}

function focusPosition(element: SingularElementReturnValue) {
  if (element.group() === 'nodes') return element.position()
  const bounds = element.boundingBox({ includeLabels: false })
  return { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 }
}

/** Synchronizes accessible targets with the canvas and reframes on actual size changes. */
export function useGraphViewport({ graphRef, container, targets, active, focusId, selectionId, focusRequest, locateRequest, generation, onMove }: Props) {
  const [zoom, setZoom] = useState(1)
  const latest = useRef({ focusId, onMove })
  const lastSize = useRef<{ graph: Core | null; width: number; height: number }>({ graph: null, width: 0, height: 0 })
  const lastSelection = useRef<string | undefined>(undefined)
  const requests = useRef({ focusRequest: -1, locateRequest: -1 })
  useEffect(() => { latest.current = { focusId, onMove } }, [focusId, onMove])

  function center(id?: string, fitAll = false) {
    const graph = graphRef.current
    if (!graph || !graph.width() || !graph.height()) return
    const node = id ? graph.getElementById(id) : undefined
    if (node?.length && !fitAll) {
      const position = focusPosition(node)
      graph.pan({ x: graph.width() / 2 - position.x * graph.zoom(), y: graph.height() / 2 - position.y * graph.zoom() })
    } else graph.viewport(getGraphViewport(graph.elements().boundingBox(), { width: graph.width(), height: graph.height() }))
  }

  useEffect(() => {
    const graph = graphRef.current
    const element = container.current
    if (!graph || !element || !active) return
    const updateTargets = () => {
      const pan = graph.pan()
      if (targets.current) targets.current.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${graph.zoom()})`
      setZoom(graph.zoom())
      latest.current.onMove()
    }
    const resize = () => {
      const { width, height } = element.getBoundingClientRect()
      if (!width || !height) return
      graph.resize()
      if (lastSize.current.graph === graph && width === lastSize.current.width && height === lastSize.current.height) {
        updateTargets()
        return
      }
      lastSize.current = { graph, width, height }
      const node = latest.current.focusId ? graph.getElementById(latest.current.focusId) : undefined
      graph.viewport(getGraphViewport(graph.elements().boundingBox(), { width, height }, node?.length ? focusPosition(node) : undefined, Math.min(1, graph.zoom())))
      updateTargets()
    }
    graph.on('viewport', updateTargets)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => { observer.disconnect(); graph.off('viewport', updateTargets) }
  }, [graphRef, container, targets, active, generation])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph || !active) return
    const force = requests.current.focusRequest !== focusRequest || requests.current.locateRequest !== locateRequest
    const changed = lastSelection.current !== selectionId
    requests.current = { focusRequest, locateRequest }
    lastSelection.current = selectionId
    const node = focusId ? graph.getElementById(focusId) : undefined
    if (!node?.length) return
    const center = focusPosition(node)
    const pan = graph.pan()
    const position = { x: center.x * graph.zoom() + pan.x, y: center.y * graph.zoom() + pan.y }
    const outside = position.x < 36 || position.x > graph.width() - 36 || position.y < 36 || position.y > graph.height() - 36
    if (force || changed && outside) {
      graph.pan({ x: graph.width() / 2 - center.x * graph.zoom(), y: graph.height() / 2 - center.y * graph.zoom() })
    }
  }, [graphRef, focusId, selectionId, focusRequest, locateRequest, active, generation])

  function changeZoom(direction: 1 | -1) {
    const graph = graphRef.current
    if (!graph) return
    graph.zoom({ level: Math.max(GRAPH_ZOOM.min, Math.min(GRAPH_ZOOM.max, graph.zoom() * GRAPH_ZOOM.step ** direction)),
      renderedPosition: { x: graph.width() / 2, y: graph.height() / 2 } })
  }

  return { zoom, changeZoom, locate: (id?: string) => center(id), fit: () => center(undefined, true) }
}
