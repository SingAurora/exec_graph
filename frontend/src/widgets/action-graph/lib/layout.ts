import cytoscape, { type ElementDefinition, type Position } from 'cytoscape'
import dagre from 'cytoscape-dagre'
import type { ActionNode } from '../../../entities/action/model/types'
import { getActionReferences, type ActionReference } from '../../../entities/action/lib/references'
import { getActionLevels } from '../../../entities/action/lib/levels'
import { getActionContextIds } from '../../../entities/action/lib/graph'

cytoscape.use(dagre)

/** 图按固定宽度排布，节点尺寸固定，历史增多时只向纵向延伸。 */
export const GRAPH_WIDTH = 340
const PADDING = 42
const ROW_GAP = 56

/** 布局结果包含坐标、层级和引用关系，不混入悬浮或选中状态。 */
export type ActionGraphLayout = {
  elements: ElementDefinition[]
  positions: Map<string, Position>
  levels: Map<string, number>
  references: ActionReference[]
  height: number
}

/** 使用 Dagre 计算分支布局，旧来源在下、新行动在上；独立分支可以处于同层。 */
export function createActionLayout(actions: ActionNode[], mainPath: ActionNode[]): ActionGraphLayout {
  const references = getActionReferences(actions)
  const levels = getActionLevels(actions)
  if (!actions.length) return { elements: [], positions: new Map(), levels, references, height: 460 }
  const mainIds = new Set(mainPath.map((node) => node.id))
  const tip = mainPath.at(-1)
  const contextIds = tip ? getActionContextIds(actions, tip.id) : new Set<string>()
  const elements: ElementDefinition[] = [...actions].sort((a, b) => b.number - a.number).map((node) => ({
    data: { id: node.id, level: String(levels.get(node.id)) }, classes: mainIds.has(node.id) ? 'main' : contextIds.has(node.id) ? 'context' : 'branch',
  }))
  for (const reference of references) {
    elements.push({
      data: { id: reference.id, source: reference.source.id, target: reference.target.id },
      classes: [reference.sameAuthor ? 'same-author' : 'other-author',
        reference.incorporated ? 'incorporated' : 'continuation',
        mainIds.has(reference.source.id) && mainIds.has(reference.target.id) && !reference.incorporated ? 'main'
          : contextIds.has(reference.source.id) && contextIds.has(reference.target.id) ? 'context' : 'branch',
        reference.agreementStatus === 'exception' ? 'exception' : ''].join(' '),
    })
  }
  // headless 实例只计算坐标，不绑定 DOM；最终坐标交给可见画布使用，计算后立即销毁。
  const graph = cytoscape({ headless: true, styleEnabled: true, elements,
    style: [{ selector: 'node', style: { width: 36, height: 36 } }],
  })
  try {
    const options: dagre.DagreLayoutOptions = { name: 'dagre', rankDir: 'TB', rankSep: ROW_GAP,
      nodeSep: 34, edgeSep: 16, fit: false, animate: false, ranker: 'network-simplex' }
    graph.layout(options).run()
    const coordinates = graph.nodes().map((node) => node.position())
    const minX = Math.min(...coordinates.map((p) => p.x))
    const maxX = Math.max(...coordinates.map((p) => p.x))
    const maxY = Math.max(...coordinates.map((p) => p.y))
    const positions = new Map<string, Position>()
    graph.nodes().forEach((node) => {
      const p = node.position()
      positions.set(node.id(), {
        x: maxX === minX ? GRAPH_WIDTH / 2 : PADDING + (p.x - minX) / (maxX - minX) * (GRAPH_WIDTH - 2 * PADDING),
        y: maxY - p.y + PADDING,
      })
    })
    return { elements, positions, levels, references,
      height: Math.max(460, ...[...positions.values()].map((p) => p.y + PADDING)) }
  } finally { graph.destroy() }
}
