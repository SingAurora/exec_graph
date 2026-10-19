import { describe, expect, test } from 'bun:test'
import { getGraphViewport, GRAPH_ZOOM } from './viewport.ts'

describe('action canvas framing', () => {
  const bounds = { x1: 20, y1: 20, w: 300, h: 900 }

  test('keeps the selected node visible when details reduce the available width', () => {
    const focus = { x: 270, y: 760 }
    const frame = getGraphViewport(bounds, { width: 340, height: 600 }, focus, 1.8)
    expect(frame.zoom).toBeLessThan(1)
    expect(focus.x * frame.zoom + frame.pan.x).toBeGreaterThan(36)
    expect(focus.x * frame.zoom + frame.pan.x).toBeLessThan(304)
    expect(focus.y * frame.zoom + frame.pan.y).toBeGreaterThan(36)
    expect(focus.y * frame.zoom + frame.pan.y).toBeLessThan(564)
    expect((bounds.y1 + bounds.h) * frame.zoom + frame.pan.y).toBeCloseTo(564)
  })

  test('avoids half an empty canvas when the selected node is a route endpoint', () => {
    const frame = getGraphViewport(bounds, { width: 340, height: 600 }, { x: 270, y: 40 })
    expect(bounds.y1 * frame.zoom + frame.pan.y).toBeCloseTo(36)
  })

  test('fit includes the full graph with padding on all sides', () => {
    const size = { width: 340, height: 600 }
    const frame = getGraphViewport(bounds, size)
    expect(bounds.x1 * frame.zoom + frame.pan.x).toBeGreaterThanOrEqual(36)
    expect(bounds.y1 * frame.zoom + frame.pan.y).toBeCloseTo(36)
    expect((bounds.y1 + bounds.h) * frame.zoom + frame.pan.y).toBeCloseTo(size.height - 36)
  })

  test('panel resizing never enlarges a manually reduced zoom level', () => {
    expect(getGraphViewport(bounds, { width: 1000, height: 600 }, { x: 90, y: 180 }, 0.5).zoom).toBe(0.5)
  })

  test('keeps the zoom valid for tiny panels and single-node graphs', () => {
    const frame = getGraphViewport(bounds, { width: 20, height: 20 }, { x: 90, y: 180 })
    expect(frame.zoom).toBe(GRAPH_ZOOM.min)
    expect(Number.isFinite(frame.pan.x)).toBe(true)
    expect(getGraphViewport({ x1: 0, y1: 0, w: 0, h: 0 }, { width: 800, height: 600 }).zoom).toBe(1)
  })
})
