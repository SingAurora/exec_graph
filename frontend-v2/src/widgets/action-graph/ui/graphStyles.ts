import type { StylesheetJson } from 'cytoscape'
import type { GraphPalette } from './useGraphPalette'

/** Keeps authorship, agreement exceptions, main route and selection visually independent. */
export function createGraphStyles(palette: GraphPalette): StylesheetJson {
  return [
    { selector: 'node', style: { width: 34, height: 34, label: 'data(level)',
      'background-color': palette.surface, 'border-color': palette.blue, 'border-width': 1.5,
      color: palette.muted, 'font-size': 10, 'font-weight': 600, 'font-family': 'sans-serif',
      'text-valign': 'center', 'text-halign': 'center', 'overlay-opacity': 0 } },
    { selector: 'node.main', style: { 'background-color': palette.signalSoft, 'border-color': palette.signal, color: palette.signal } },
    { selector: 'node.context', style: { 'border-color': palette.blue, 'background-color': palette.soft, 'border-width': 2 } },
    { selector: 'edge', style: { width: 1.6, 'line-color': palette.blue, 'target-arrow-color': palette.blue,
      'target-arrow-shape': 'triangle', 'arrow-scale': 0.65, 'curve-style': 'bezier',
      'control-point-step-size': 48, 'overlay-opacity': 0 } },
    { selector: 'edge.main', style: { width: 2, 'line-color': palette.signal, 'target-arrow-color': palette.signal } },
    { selector: 'edge.context', style: { width: 2, 'line-color': palette.blue, 'target-arrow-color': palette.blue } },
    { selector: 'edge.incorporated', style: { 'curve-style': 'unbundled-bezier', 'control-point-distances': [45], 'control-point-weights': [0.5] } },
    { selector: 'edge.same-author', style: { 'line-style': 'solid' } },
    { selector: 'edge.other-author', style: { 'line-style': 'dashed', 'line-dash-pattern': [5, 4] } },
    { selector: 'edge.exception', style: { label: '×', color: palette.coral, 'font-size': 18, 'font-weight': 600,
      'text-background-color': palette.surface, 'text-background-opacity': 1, 'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle', 'text-rotation': 'none' } },
    { selector: 'node.outside', style: { opacity: 0.85 } },
    { selector: 'edge.outside', style: { opacity: 0.65 } },
    { selector: 'node.main.outside, edge.main.outside', style: { opacity: 0.9 } },
    { selector: 'edge.inspected', style: { width: 3, opacity: 1 } },
    { selector: 'edge.active', style: { width: 4, opacity: 1, 'arrow-scale': 0.85 } },
    { selector: 'node.source', style: { 'border-width': 2.5 } },
    { selector: 'node.active', style: { 'border-width': 3, 'border-color': palette.signal,
      'underlay-color': palette.signal, 'underlay-opacity': 0.12, 'underlay-padding': 6, 'underlay-shape': 'ellipse' } },
  ]
}
