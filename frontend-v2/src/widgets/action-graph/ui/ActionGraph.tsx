import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type MouseEvent } from 'react'
import cytoscape, { type Core } from 'cytoscape'
import { LocateFixed, Maximize2, Network } from 'lucide-react'
import type { ActionNode } from '../../../entities/action/model/types'
import { getActionContextIds, getActionParentIds } from '../../../entities/action/lib/graph'
import type { UserProfile } from '../../../shared/model'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { createActionLayout, GRAPH_WIDTH } from '../lib/layout'
import { getEdgeHitPaths, type EdgeHitPath } from '../lib/edgeGeometry'
import { createGraphStyles } from './graphStyles'
import { useGraphPalette } from './useGraphPalette'
import { GraphTooltip, type GraphHover } from './GraphTooltip'
import './action-graph.css'

type Props = {
  actions: ActionNode[]
  mainPath: ActionNode[]
  users: UserProfile[]
  selectedId?: string
  selectedReferenceId?: string
  showLegend: boolean
  onSelect: (id: string) => void
  onSelectReference: (id: string) => void
  onFitViewport: () => void
}

/** Fixed-width action graph; line style shows authorship and crosses show agreement exceptions. */
export function ActionGraph({ actions, mainPath, users, selectedId, selectedReferenceId, showLegend, onSelect, onSelectReference, onFitViewport }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Core | null>(null)
  const tooltipId = useId()
  const [hover, setHover] = useState<GraphHover | null>(null)
  const [hitPaths, setHitPaths] = useState<EdgeHitPath[]>([])
  const layout = useMemo(() => createActionLayout(actions, mainPath), [actions, mainPath])
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])
  const referenceById = useMemo(() => new Map(layout.references.map((reference) => [reference.id, reference])), [layout])
  const palette = useGraphPalette()
  const hoveredNode = hover?.kind === 'node' ? actions.find((node) => node.id === hover.id) : undefined
  const hoveredReference = hover?.kind === 'reference' ? referenceById.get(hover.id) : undefined
  const historyCount = hoveredNode ? getActionContextIds(actions, hoveredNode.id).size - 1 : 0

  useEffect(() => {
    if (!container.current) return
    const graph = cytoscape({
      container: container.current,
      elements: layout.elements.map((element) => ({ ...element, position: layout.positions.get(element.data.id!) })),
      layout: { name: 'preset', fit: false }, style: createGraphStyles(palette),
      zoom: 1, minZoom: 1, maxZoom: 1, pan: { x: 0, y: 0 },
      userZoomingEnabled: false, userPanningEnabled: false, boxSelectionEnabled: false,
      autoungrabify: true, autounselectify: true,
    })
    graphRef.current = graph
    graph.ready(() => setHitPaths(getEdgeHitPaths(graph)))
    return () => { graphRef.current = null; graph.destroy() }
  }, [layout, palette])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    const reference = selectedReferenceId ? referenceById.get(selectedReferenceId) : undefined
    const contextId = reference?.source.id ?? selectedId
    const context = contextId ? getActionContextIds(actions, contextId) : new Set<string>()
    if (reference) context.add(reference.target.id)
    const selected = actions.find((node) => node.id === selectedId)
    const sources = new Set(reference ? [reference.source.id, reference.target.id] : selected ? getActionParentIds(selected) : [])
    graph.batch(() => {
      graph.elements().removeClass('active source outside')
      graph.nodes().forEach((node) => {
        if (contextId && !context.has(node.id())) node.addClass('outside')
        if (sources.has(node.id())) node.addClass('source')
      })
      graph.edges().forEach((edge) => {
        if (reference ? edge.id() !== reference.id : contextId && (!context.has(edge.source().id()) || !context.has(edge.target().id()))) edge.addClass('outside')
      })
      const activeId = reference?.id ?? selectedId
      if (activeId) graph.getElementById(activeId).addClass('active')
    })
    const focusId = reference?.target.id ?? selectedId
    const position = focusId ? layout.positions.get(focusId) : undefined
    const scroll = viewport.current
    if (position && scroll && (position.y < scroll.scrollTop + 30 || position.y > scroll.scrollTop + scroll.clientHeight - 30)) {
      scroll.scrollTo({ top: Math.max(0, position.y - scroll.clientHeight / 2), behavior: 'instant' })
    }
  }, [selectedId, selectedReferenceId, referenceById, actions, layout, palette])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    graph.elements().removeClass('inspected')
    if (hover) {
      const element = graph.getElementById(hover.id)
      if (hover.kind === 'reference') element.addClass('inspected')
      else element.connectedEdges().addClass('inspected')
    }
  }, [hover, layout, palette])

  function showHover(kind: GraphHover['kind'], id: string, event: MouseEvent<Element> | FocusEvent<Element>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const graphRect = container.current?.getBoundingClientRect()
    setHover({ kind, id, left: graphRect?.right ?? rect.right,
      top: 'clientY' in event ? event.clientY : rect.top + rect.height / 2 })
  }

  function selectNode(id: string) { setHover(null); onSelect(id) }
  function selectReference(id: string) { setHover(null); onSelectReference(id) }
  function locateLatestMainNode() {
    const tip = mainPath.at(-1)
    if (!tip) return
    const position = layout.positions.get(tip.id)
    const scroll = viewport.current
    if (position && scroll) scroll.scrollTo({ top: Math.max(0, position.y - scroll.clientHeight / 2), behavior: 'instant' })
    selectNode(tip.id)
  }

  return <aside className="action-graph-panel" aria-label="节点关系">
    <header className="action-graph-heading"><div><div className="flex items-center gap-1"><h3><Network size={15} />节点关系</h3><HelpPopover title="节点关系">
      <p>圆点数字表示层级：起点为 1，后续节点为所有直接来源中最高层级加 1。节点编号用于区分具体行动。</p>
      <p>实线表示自己引用自己，虚线表示引用他人。满足约定没有额外标记；× 表示不满足来源约定，例外获同意后仍保留。</p>
      <p>绿色路线为主线，节点外圈标记当前选择。主线会随后续行动变化，切换选择不会改变主线。</p>
      <p>悬浮查看摘要，点击节点阅读文档，点击连线查看引用详情。“定位主链”会选中并显示当前帖子的主链；“重新铺满”将节点图与详情对齐当前窗口。</p>
    </HelpPopover></div><p>{actions.length} 个节点</p></div>
      <div className="action-graph-heading-actions">
        <button className="action-graph-icon-button" type="button" title="重新铺满" aria-label="重新铺满" onClick={onFitViewport}><Maximize2 size={15} aria-hidden="true" /></button>
        <button className="action-graph-icon-button" type="button" title="定位主链" aria-label="定位主链" onClick={locateLatestMainNode}><LocateFixed size={15} aria-hidden="true" /></button>
      </div>
    </header>
    {showLegend && <div className="action-graph-legend" aria-label="节点关系图例">
      <span><i className="is-solid" aria-hidden="true" />自己引用</span>
      <span><i className="is-dashed" aria-hidden="true" />引用他人</span>
      <span><b aria-hidden="true">×</b>不满足约定</span>
      <span><b className="is-level" aria-hidden="true">2</b>节点层级</span>
    </div>}
    <div className="action-graph-scroll" ref={viewport} tabIndex={0} role="region" aria-label="浏览节点关系" onScroll={() => setHover(null)}>
      <div className="action-graph-canvas" style={{ width: GRAPH_WIDTH, height: layout.height }}>
        {/* Cytoscape injects an unlayered relative-position rule; keep the canvas frame absolute. */}
        <div className="action-graph-surface" style={{ position: 'absolute' }} ref={container} aria-hidden="true" />
        <svg className="action-graph-edge-targets" width={GRAPH_WIDTH} height={layout.height} role="group" aria-label="节点引用关系">
          {hitPaths.map((edge) => {
            const reference = referenceById.get(edge.id)!
            const label = `节点 #${reference.source.number} → #${reference.target.number}，${reference.sameAuthor ? '同一作者引用' : '跨作者引用'}${reference.agreementStatus === 'exception' ? '，不满足约定' : ''}`
            return <path key={edge.id} d={edge.path} tabIndex={0} role="button" aria-label={label} aria-pressed={selectedReferenceId === edge.id}
              aria-describedby={hover?.id === edge.id ? tooltipId : undefined}
              onClick={() => selectReference(edge.id)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectReference(edge.id) } }}
              onMouseEnter={(event) => showHover('reference', edge.id, event)} onMouseLeave={() => setHover(null)}
              onFocus={(event) => showHover('reference', edge.id, event)} onBlur={() => setHover(null)} />
          })}
        </svg>
        {[...actions].sort((a, b) => b.number - a.number).map((node) => {
          const position = layout.positions.get(node.id)!
          return <button key={node.id} className="action-graph-node-target" style={{ left: position.x, top: position.y }} type="button"
            aria-label={`第 ${layout.levels.get(node.id)} 层，节点 #${node.number}：${node.title}`} aria-pressed={selectedId === node.id}
            aria-describedby={hover?.id === node.id ? tooltipId : undefined} data-action-id={node.id}
            onClick={() => selectNode(node.id)} onMouseEnter={(event) => showHover('node', node.id, event)} onMouseLeave={() => setHover(null)}
            onFocus={(event) => showHover('node', node.id, event)} onBlur={() => setHover(null)} />
        })}
      </div>
    </div>
    {hover && <GraphTooltip id={tooltipId} hover={hover} node={hoveredNode} reference={hoveredReference} users={userById} historyCount={historyCount} levels={layout.levels} />}
  </aside>
}
