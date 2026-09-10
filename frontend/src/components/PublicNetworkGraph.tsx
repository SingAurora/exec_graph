import cytoscape, { type Core } from 'cytoscape'
import { useEffect, useMemo, useRef, useState } from 'react'
import { graphColor } from '../lib/theme'

type NetworkItem = {
  id: string
  label: string
  kind: 'person' | 'project'
  detail: string
}

const items: NetworkItem[] = [
  { id: 'person-lin', label: '林舟', kind: 'person', detail: '其锁定的阅读索引成果已被其他项目申请采用。' },
  { id: 'person-mori', label: '森', kind: 'person', detail: '维护 AI 产品审查研究图谱，并采纳外部案例成果。' },
  { id: 'person-qiao', label: '乔野', kind: 'person', detail: '其校准记录为后续项目提供实践证据。' },
  { id: 'project-reading', label: '可复查阅读系统', kind: 'project', detail: '一条完成记录正作为公开协作征集的来源材料。' },
  { id: 'project-research', label: 'AI 审查研究图谱', kind: 'project', detail: '通过成果采用与阅读系统形成跨项目关系。' },
  { id: 'project-lab', label: '一人家庭实验室', kind: 'project', detail: '锁定的校准方法已被其他项目引用为证据。' },
]

const relations = [
  { id: 'r1', source: 'person-lin', target: 'project-reading', label: '维护' },
  { id: 'r2', source: 'person-mori', target: 'project-research', label: '维护' },
  { id: 'r3', source: 'person-qiao', target: 'project-lab', label: '维护' },
  { id: 'r4', source: 'project-reading', target: 'project-research', label: '成果采用' },
  { id: 'r5', source: 'project-lab', target: 'project-reading', label: '路径接续' },
  { id: 'r6', source: 'person-lin', target: 'person-mori', label: '共同收束' },
]

export function PublicNetworkGraph() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)
  const [selectedID, setSelectedID] = useState('project-research')
  const [themeRevision, setThemeRevision] = useState(0)
  const selected = useMemo(() => items.find((item) => item.id === selectedID) ?? items[0], [selectedID])

  useEffect(() => {
    const refreshGraph = () => setThemeRevision((value) => value + 1)
    window.addEventListener('exec-graph-theme-change', refreshGraph)
    return () => window.removeEventListener('exec-graph-theme-change', refreshGraph)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    cyRef.current?.destroy()
    const colors = {
      paper: graphColor('paper'),
      surface: graphColor('surface'),
      ink: graphColor('ink'),
      graphite: graphColor('graphite'),
      rail: graphColor('rail'),
      signal: graphColor('signal'),
      moss: graphColor('moss'),
      amber: graphColor('amber'),
      edge: graphColor('edge'),
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...items.map((item) => ({ data: { id: item.id, label: item.label, kind: item.kind } })),
        ...relations.map((relation) => ({ data: relation })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: colors.ink,
            'font-family': 'Inter, sans-serif',
            'font-size': '11px',
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'background-color': colors.surface,
            'border-width': 2,
            'border-color': colors.rail,
            width: 56,
            height: 56,
          },
        },
        { selector: 'node[kind = "person"]', style: { shape: 'ellipse', 'background-color': colors.signal, 'border-color': colors.signal, color: colors.ink } },
        { selector: 'node[kind = "project"]', style: { shape: 'round-rectangle', width: '86px', height: '48px', 'text-max-width': '100px', 'text-wrap': 'ellipsis' } },
        { selector: 'node:selected', style: { 'border-color': colors.ink, 'border-width': 4 } },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': colors.edge,
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-family': 'JetBrains Mono, monospace',
            'font-size': '9px',
            color: colors.graphite,
            'text-background-color': colors.paper,
            'text-background-opacity': 1,
            'text-background-padding': '2px',
          },
        },
        { selector: 'edge[label = "成果采用"]', style: { width: 2.5, 'line-color': colors.moss, color: colors.moss } },
        { selector: 'edge[label = "共同收束"]', style: { width: 2.5, 'line-color': colors.amber, color: colors.amber, 'line-style': 'dashed' } },
      ],
      layout: {
        name: 'cose',
        animate: false,
        padding: 42,
        nodeRepulsion: () => 7200,
        idealEdgeLength: () => 120,
      },
      minZoom: 0.65,
      maxZoom: 1.8,
    })

    cy.on('tap', 'node', (event) => setSelectedID(event.target.id()))
    cyRef.current = cy
    return () => cy.destroy()
  }, [themeRevision])

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="border border-rail bg-surface p-3">
        <div ref={containerRef} className="h-[460px] w-full" aria-label="执行网络图谱" />
      </div>
      <aside className="border-l-2 border-ink bg-shell p-5">
        <div className="font-mono text-xs font-semibold uppercase text-signal">当前聚焦</div>
        <h3 className="mt-3 font-display text-2xl font-semibold text-ink">{selected.label}</h3>
        <p className="mt-3 text-sm leading-6 text-graphite">{selected.detail}</p>
        <div className="mt-6 border-t border-rail pt-4 text-xs leading-5 text-graphite">圆形为执行者，方形为公开项目。连线只表示由锁定记录或采纳申请产生的事实关系。</div>
      </aside>
    </section>
  )
}
