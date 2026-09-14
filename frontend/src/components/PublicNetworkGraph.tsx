import cytoscape, { type Core } from 'cytoscape'
import { ArrowRight, Network, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { type PublicNetwork, type PublicNetworkNode } from '../lib/collaboration'
import { graphColor } from '../lib/theme'

export type PublicNetworkView = 'projects' | 'people'

type PublicNetworkGraphProps = {
  network: PublicNetwork
  view: PublicNetworkView
}

const nodeSize = (weight: number) => Math.min(82, 42 + Math.max(0, weight) * 9)

export function PublicNetworkGraph({ network, view }: PublicNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)
  const [selectedID, setSelectedID] = useState('')
  const [themeRevision, setThemeRevision] = useState(0)
  const kind = view === 'projects' ? 'project' : 'person'
  const nodes = useMemo(() => network.nodes.filter((node) => node.kind === kind), [kind, network.nodes])
  const nodeIDs = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes])
  const edges = useMemo(() => network.edges.filter((edge) => nodeIDs.has(edge.source) && nodeIDs.has(edge.target) && (view === 'people' || edge.type !== 'maintains')), [network.edges, nodeIDs, view])
  const selected = useMemo(() => nodes.find((node) => node.id === selectedID) ?? nodes[0], [nodes, selectedID])

  useEffect(() => {
    if (!selectedID || !nodes.some((node) => node.id === selectedID)) setSelectedID(nodes[0]?.id ?? '')
  }, [nodes, selectedID])

  useEffect(() => {
    const refreshGraph = () => setThemeRevision((value) => value + 1)
    window.addEventListener('exec-graph-theme-change', refreshGraph)
    return () => window.removeEventListener('exec-graph-theme-change', refreshGraph)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    cyRef.current?.destroy()
    const colors = { paper: graphColor('paper'), surface: graphColor('surface'), ink: graphColor('ink'), graphite: graphColor('graphite'), rail: graphColor('rail'), signal: graphColor('signal'), moss: graphColor('moss'), amber: graphColor('amber'), edge: graphColor('edge') }
    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map((node) => ({ data: { id: node.id, label: node.label, kind: node.kind, size: nodeSize(node.weight), open: node.hasOpenCall ? 'yes' : 'no', mine: node.isCurrentUser ? 'yes' : 'no' } })),
        ...edges.map((edge) => ({ data: edge })),
      ],
      style: [
        { selector: 'node', style: { label: 'data(label)', color: colors.ink, 'font-family': 'Inter, sans-serif', 'font-size': '11px', 'font-weight': 600, 'text-wrap': 'ellipsis', 'text-max-width': '118px', 'text-valign': 'bottom', 'text-margin-y': 9, 'background-color': colors.surface, 'border-width': 2, 'border-color': colors.rail, width: 'data(size)', height: 'data(size)' } },
        { selector: 'node[kind = "person"]', style: { shape: 'ellipse', 'background-color': colors.signal, 'border-color': colors.signal } },
        { selector: 'node[kind = "project"]', style: { shape: 'round-rectangle', width: 'data(size)', height: 48 } },
        { selector: 'node[open = "yes"]', style: { 'border-width': 5, 'border-color': colors.amber } },
        { selector: 'node[mine = "yes"]', style: { 'border-width': 5, 'border-color': colors.ink } },
        { selector: '.is-focus', style: { opacity: 1, 'z-index': 9 } },
        { selector: '.is-muted', style: { opacity: 0.16 } },
        { selector: 'edge', style: { width: 1.5, 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'target-arrow-color': colors.edge, 'line-color': colors.edge, label: 'data(label)', 'font-family': 'JetBrains Mono, monospace', 'font-size': '9px', color: colors.graphite, 'text-background-color': colors.paper, 'text-background-opacity': 1, 'text-background-padding': '2px' } },
        { selector: 'edge[type = "adopted"]', style: { width: 3, 'line-color': colors.moss, 'target-arrow-color': colors.moss, color: colors.moss } },
        { selector: 'edge[type = "contributing"]', style: { width: 2, 'line-style': 'dashed', 'line-color': colors.amber, 'target-arrow-color': colors.amber, color: colors.amber } },
        { selector: 'edge[type = "workspace"]', style: { width: 2, 'line-style': 'dotted', 'line-color': colors.signal, 'target-arrow-color': colors.signal, color: colors.signal } },
      ],
      layout: { name: 'cose', animate: false, randomize: false, padding: 58, nodeRepulsion: () => 8200, idealEdgeLength: () => 150 },
      minZoom: 0.45,
      maxZoom: 2.4,
    })
    cy.on('tap', 'node', (event) => setSelectedID(event.target.id()))
    cyRef.current = cy
    return () => cy.destroy()
  }, [edges, nodes, themeRevision])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !selectedID) return
    const active = cy.getElementById(selectedID)
    cy.elements().removeClass('is-muted is-focus')
    if (active.empty()) return
    cy.elements().addClass('is-muted')
    active.closedNeighborhood().removeClass('is-muted').addClass('is-focus')
    active.removeClass('is-muted').addClass('is-focus')
  }, [selectedID, nodes, edges])

  const relatedEdges = selected ? edges.filter((edge) => edge.source === selected.id || edge.target === selected.id) : []
  const adoptedCount = relatedEdges.filter((edge) => edge.type === 'adopted').length
  const openContribution = relatedEdges.some((edge) => edge.type === 'contributing' || edge.type === 'workspace')

  if (nodes.length === 0) return <div className="border-l-2 border-rail py-5 pl-4 text-sm leading-6 text-graphite">还没有足够的公开关系形成网络。</div>

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="border border-rail bg-surface p-3"><div ref={containerRef} className="h-[560px] min-h-[420px] w-full" aria-label={view === 'projects' ? '公开项目关系网络' : '公开执行者关系网络'} /></div>
      {selected ? <NetworkDetail node={selected} relatedCount={relatedEdges.length} adoptedCount={adoptedCount} openContribution={openContribution} /> : null}
    </section>
  )
}

function NetworkDetail({ node, relatedCount, adoptedCount, openContribution }: { node: PublicNetworkNode; relatedCount: number; adoptedCount: number; openContribution: boolean }) {
  const Icon = node.kind === 'project' ? Network : UsersRound
  return <aside className="border-l-2 border-ink bg-shell p-5"><div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Icon size={15} aria-hidden="true" />当前聚焦</div><h2 className="mt-3 font-display text-2xl font-semibold leading-tight text-ink">{node.label}</h2><p className="mt-3 text-sm leading-6 text-graphite">{node.detail}</p><div className="mt-5 grid grid-cols-2 border-y border-rail text-sm"><div className="py-3"><div className="text-xs text-graphite">直接关系</div><b className="mt-1 block text-ink">{relatedCount}</b></div><div className="border-l border-rail py-3 pl-4"><div className="text-xs text-graphite">正式采纳</div><b className="mt-1 block text-moss">{adoptedCount}</b></div></div>{node.hasOpenCall || openContribution ? <p className="mt-4 text-sm font-semibold text-signal">{node.hasOpenCall ? '有开放缺口可以参与' : '正在连接新的贡献'}</p> : null}{node.projectId ? <Link to={`/explore/projects/${node.projectId}`} className="mt-6 inline-flex h-10 items-center gap-2 border border-rail bg-surface px-3 text-sm font-semibold text-ink hover:border-signal">进入项目<ArrowRight size={16} aria-hidden="true" /></Link> : null}</aside>
}
