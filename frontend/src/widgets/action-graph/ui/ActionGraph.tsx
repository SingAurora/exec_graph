import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type MouseEvent } from 'react'
import cytoscape, { type Core } from 'cytoscape'
import { GitBranch, LocateFixed, Maximize2, Minus, Network, Plus, Scan, X } from 'lucide-react'
import type { ActionNode } from '../../../entities/action/model/types'
import { getActionContextIds, getActionParentIds } from '../../../entities/action/lib/graph'
import { ActionGraphLegend } from '../../../entities/action/ui/ActionGraphLegend'
import type { UserProfile } from '../../../entities/profile/model/types'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { GraphBackground } from '../../../shared/ui/graph-background/GraphBackground'
import type { GraphBackgroundPreferences } from '../../../shared/ui/graph-background/model'
import { createActionLayout, GRAPH_WIDTH } from '../lib/layout'
import { getEdgeHitPaths, type EdgeHitPath } from '../lib/edgeGeometry'
import { GRAPH_ZOOM } from '../lib/viewport'
import { useGraphViewport } from '../model/useGraphViewport'
import { createGraphStyles } from './graphStyles'
import { useGraphPalette } from './useGraphPalette'
import { GraphTooltip, type GraphHover } from './GraphTooltip'
import './action-graph.css'

type Props = {
  actions: ActionNode[]
  highlightedPath: ActionNode[]
  users: UserProfile[]
  selectedId?: string
  selectedReferenceId?: string
  showLegend: boolean
  background: GraphBackgroundPreferences
  active?: boolean
  focusRequest?: number
  locateRequest?: number
  detailsVisible?: boolean
  onSelect: (id: string) => void
  onSelectReference: (id: string) => void
  onFitViewport: () => void
  onClearHighlight: () => void
}

/** Cytoscape 行动图：实虚线表示作者关系，叉号表示不满足约定；React 管理选择和工具栏。 */
export function ActionGraph({ actions, highlightedPath, users, selectedId, selectedReferenceId, showLegend, background, active = true, focusRequest = 0, locateRequest = 0, detailsVisible = true, onSelect, onSelectReference, onFitViewport, onClearHighlight }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const targets = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Core | null>(null)
  const tooltipId = useId()
  const [hover, setHover] = useState<GraphHover | null>(null)
  const [hitPaths, setHitPaths] = useState<EdgeHitPath[]>([])
  // 高亮和选择只改样式；布局仅随行动数据变化，避免点击节点时整个图重新排列。
  const layout = useMemo(() => createActionLayout(actions, []), [actions])
  const highlightTip = highlightedPath.at(-1)
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])
  const referenceById = useMemo(() => new Map(layout.references.map((reference) => [reference.id, reference])), [layout])
  const palette = useGraphPalette()
  const hoveredNode = hover?.kind === 'node' ? actions.find((node) => node.id === hover.id) : undefined
  const hoveredReference = hover?.kind === 'reference' ? referenceById.get(hover.id) : undefined

  useEffect(() => {
    // Cytoscape 直接管理画布 DOM，放入 effect 创建；清理时销毁实例，避免重复监听和资源泄漏。
    if (!container.current) return
    const graph = cytoscape({
      container: container.current,
      elements: layout.elements.map((element) => ({ ...element, position: layout.positions.get(element.data.id!) })),
      layout: { name: 'preset', fit: false }, style: [],
      zoom: 1, minZoom: GRAPH_ZOOM.min, maxZoom: GRAPH_ZOOM.max, pan: { x: 0, y: 0 },
      userZoomingEnabled: true, userPanningEnabled: true, boxSelectionEnabled: false,
      autoungrabify: true, autounselectify: true,
    })
    graphRef.current = graph
    return () => { graphRef.current = null; graph.destroy() }
  }, [layout])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    graph.style(createGraphStyles(palette))
    setHitPaths(getEdgeHitPaths(graph))
  }, [palette, layout])

  const { zoom, changeZoom, locate, fit } = useGraphViewport({ graphRef, container, targets, active,
    focusId: selectedReferenceId ?? selectedId, selectionId: selectedReferenceId ?? selectedId,
    focusRequest, locateRequest, generation: layout, onMove: () => setHover(null) })

  useEffect(() => {
    const graph = graphRef.current
    if (!graph || !active) return
    const reference = selectedReferenceId ? referenceById.get(selectedReferenceId) : undefined
    const contextId = highlightedPath.at(-1)?.id
    const context = contextId ? getActionContextIds(actions, contextId) : new Set<string>()
    const pathIds = new Set(highlightedPath.map((node) => node.id))
    const selected = actions.find((node) => node.id === selectedId)
    const sources = new Set(reference ? [reference.source.id, reference.target.id] : selected ? getActionParentIds(selected) : [])
    // 批量更新视觉类；承接主链、合入背景、来源和当前选择各自独立，颜色不表示路线优劣。
    graph.batch(() => {
      graph.elements().removeClass('active source outside main context')
      graph.nodes().forEach((node) => {
        if (pathIds.has(node.id())) node.addClass('main')
        else if (context.has(node.id())) node.addClass('context')
        if (contextId && !context.has(node.id())) node.addClass('outside')
        if (sources.has(node.id())) node.addClass('source')
      })
      graph.edges().forEach((edge) => {
        const sourceId = edge.source().id()
        const targetId = edge.target().id()
        if (pathIds.has(sourceId) && pathIds.has(targetId) && !edge.hasClass('incorporated')) edge.addClass('main')
        else if (context.has(sourceId) && context.has(targetId)) edge.addClass('context')
        if (contextId && (!context.has(sourceId) || !context.has(targetId))) edge.addClass('outside')
      })
      const activeId = reference?.id ?? selectedId
      if (activeId) graph.getElementById(activeId).addClass('active')
    })
  }, [selectedId, selectedReferenceId, referenceById, actions, layout, palette, active, highlightedPath])

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
  function locateNode(id?: string) {
    locate(id)
    setHover(null)
  }

  return (
    <aside className={`action-graph-panel ${detailsVisible ? '' : 'border-r-0'}`}>
      <header className="action-graph-heading"><div><div className="flex items-center gap-1"><h3><Network size={16} />节点关系</h3><HelpPopover title="节点关系">
        <p>圆点数字表示层级：起点为 1，后续节点为所有直接来源中最高层级加 1。节点编号用于区分具体行动。</p>
        <p>实线表示自己引用自己，虚线表示引用他人。满足约定没有额外标记；× 表示不满足来源约定，仍可引用。</p>
        <p>绿色节点和连线表示高亮链路的承接路径，蓝灰色填充节点表示合入背景。节点外圈标记当前选择，查看其他节点不会改变高亮链路。</p>
        <p>从表达、行动或搜索结果进入时自动高亮对应链路。点击链路状态右侧的 × 取消，在节点详情点击“高亮链路”重新开启。定位仅移动图的位置，不切换右侧文档。</p>
        <p>悬浮查看摘要，点击节点阅读文档，点击连线查看引用详情。“重新铺满”将节点图与详情对齐当前窗口。</p>
        <p>详情右上角可定位当前节点或隐藏详情。隐藏后点击任意节点或连线重新打开，同一文档恢复阅读位置。</p>
        <p>拖动空白区域平移画布，滚轮或触控板缩放，也可使用缩放按钮。详情展开或隐藏时自动适配画布，让当前节点保持可见；“适应画布”查看全图。</p>
      </HelpPopover></div></div>
        <div className="action-graph-heading-actions">
          <button className="action-graph-icon-button" type="button" title="重新铺满" onClick={onFitViewport}><Maximize2 size={16} /></button>
          {!highlightTip && <button className="action-graph-icon-button" type="button" title={selectedReferenceId ? '定位选中关系' : '定位选中节点'} onClick={() => locateNode(selectedReferenceId ?? selectedId)}><LocateFixed size={16} /></button>}
        </div>
      </header>
      <div className="action-graph-toolbar">
      {highlightTip ? <div className="action-graph-highlight">
        <span className="inline-flex min-w-0 items-center gap-1.5" title={highlightTip.title}><GitBranch size={14} />链路 #{highlightTip.number}</span>
        <div className="flex items-center gap-1">
          <button className="action-graph-icon-button border-0 text-signal" type="button" title="定位链路终点" onClick={() => locateNode(highlightTip.id)}><LocateFixed size={15} /></button>
          <button className="action-graph-icon-button border-0 text-signal" type="button" title="取消链路高亮" onClick={() => { setHover(null); onClearHighlight() }}><X size={15} /></button>
        </div>
      </div> : <span className="text-xs text-muted">{actions.length} 个节点</span>}
      <div className="action-graph-zoom-controls">
        <button className="action-graph-icon-button" type="button" title="缩小画布" disabled={zoom <= GRAPH_ZOOM.min} onClick={() => changeZoom(-1)}><Minus size={14} /></button>
        <output className="action-graph-zoom-value">{Math.round(zoom * 100)}%</output>
        <button className="action-graph-icon-button" type="button" title="放大画布" disabled={zoom >= GRAPH_ZOOM.max} onClick={() => changeZoom(1)}><Plus size={14} /></button>
        <button className="action-graph-icon-button" type="button" title="适应画布" onClick={fit}><Scan size={14} /></button>
      </div>
      </div>
      {showLegend && <div className="px-3.5 pb-2"><ActionGraphLegend /></div>}
      <div className="action-graph-viewport" tabIndex={0} onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        const graph = graphRef.current
        if (!graph) return
        const movement: Record<string, { x: number; y: number }> = { ArrowUp: { x: 0, y: 48 }, ArrowDown: { x: 0, y: -48 }, ArrowLeft: { x: 48, y: 0 }, ArrowRight: { x: -48, y: 0 } }
        if (movement[event.key]) { event.preventDefault(); graph.panBy(movement[event.key]) }
        else if (event.key === '+' || event.key === '=') { event.preventDefault(); changeZoom(1) }
        else if (event.key === '-') { event.preventDefault(); changeZoom(-1) }
        else if (event.key === '0') { event.preventDefault(); fit() }
      }}>
          <GraphBackground preferences={background} />
          {/* Cytoscape 会注入 relative 定位，这里显式保持画布绝对定位，避免改变容器布局。 */}
          <div className="action-graph-surface" style={{ position: 'absolute' }} ref={container} />
        <div className="action-graph-targets" ref={targets} style={{ width: GRAPH_WIDTH, height: layout.height }}>
          <svg className="action-graph-edge-targets" width={GRAPH_WIDTH} height={layout.height}>
            {hitPaths.map((edge) => {
              const reference = referenceById.get(edge.id)!
              const label = `节点 #${reference.source.number} → #${reference.target.number}，${reference.sameAuthor ? '同一作者引用' : '跨作者引用'}${reference.agreementStatus === 'exception' ? '，不满足约定' : ''}`
              return (
                <path key={edge.id} d={edge.path} tabIndex={0}
                  onClick={() => selectReference(edge.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectReference(edge.id) } }}
                  onMouseEnter={(event) => showHover('reference', edge.id, event)} onMouseLeave={() => setHover(null)}
                  onFocus={(event) => showHover('reference', edge.id, event)} onBlur={() => setHover(null)}><title>{label}</title></path>
              )
            })}
          </svg>
          {[...actions].sort((a, b) => b.number - a.number).map((node) => {
            const position = layout.positions.get(node.id)!
            return (
              <button key={node.id} className="action-graph-node-target" style={{ left: position.x, top: position.y }} type="button"
                title={`第 ${layout.levels.get(node.id)} 层，节点 #${node.number}：${node.title}`}
                data-action-id={node.id}
                onClick={() => selectNode(node.id)} onMouseEnter={(event) => showHover('node', node.id, event)} onMouseLeave={() => setHover(null)}
                onFocus={(event) => showHover('node', node.id, event)} onBlur={() => setHover(null)} />
            )
          })}
        </div>
      </div>
      {hover && <GraphTooltip id={tooltipId} hover={hover} node={hoveredNode} reference={hoveredReference} users={userById} levels={layout.levels} />}
    </aside>
  )
}
