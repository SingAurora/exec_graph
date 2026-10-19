import type { Position } from 'cytoscape'

/** Allowed canvas magnification, shared by gestures and toolbar controls. */
export const GRAPH_ZOOM = { min: 0.35, max: 2.5, step: 1.25 } as const
const PADDING = 36

type Bounds = { x1: number; y1: number; w: number; h: number }
type Size = { width: number; height: number }

/** Fits the width after panel changes and keeps the focus visible without empty margins. */
export function getGraphViewport(bounds: Bounds, size: Size, focus?: Position, currentZoom = 1) {
  const widthZoom = Math.max(1, size.width - PADDING * 2) / Math.max(1, bounds.w)
  const heightZoom = Math.max(1, size.height - PADDING * 2) / Math.max(1, bounds.h)
  const zoom = Math.max(GRAPH_ZOOM.min, Math.min(GRAPH_ZOOM.max, currentZoom, widthZoom, focus ? Infinity : heightZoom))
  const center = focus ?? { x: bounds.x1 + bounds.w / 2, y: bounds.y1 + bounds.h / 2 }
  const frameAxis = (start: number, length: number, available: number, focusPosition: number) => {
    if (length * zoom <= available - PADDING * 2) return (available - length * zoom) / 2 - start * zoom
    return Math.max(available - PADDING - (start + length) * zoom,
      Math.min(PADDING - start * zoom, available / 2 - focusPosition * zoom))
  }
  return { zoom, pan: { x: frameAxis(bounds.x1, bounds.w, size.width, center.x), y: frameAxis(bounds.y1, bounds.h, size.height, center.y) } }
}
