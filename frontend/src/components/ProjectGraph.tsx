import cytoscape, { type Core } from 'cytoscape'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { graphColor } from '../lib/theme'
import { useExecStore } from '../store/useExecStore'

type ProjectGraphProps = {
  projectId: string
  heightClassName?: string
  visibleContractIds?: string[]
}

export function ProjectGraph({ projectId, heightClassName = 'h-[360px] min-h-[280px]', visibleContractIds }: ProjectGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)
  const [themeRevision, setThemeRevision] = useState(0)
  const navigate = useNavigate()
  const allContracts = useExecStore((state) => state.contracts)
  const allEdges = useExecStore((state) => state.edges)
  const contracts = useMemo(
    () => {
      const selectedIds = visibleContractIds ? new Set(visibleContractIds) : undefined
      return allContracts.filter((contract) => contract.projectId === projectId && (!selectedIds || selectedIds.has(contract.id)))
    },
    [allContracts, projectId, visibleContractIds],
  )
  const contractIds = useMemo(() => new Set(contracts.map((contract) => contract.id)), [contracts])
  const edges = useMemo(
    () => allEdges.filter((edge) => contractIds.has(edge.sourceContractId) && contractIds.has(edge.targetContractId)),
    [allEdges, contractIds],
  )
  const rootIds = useMemo(() => {
    const targetIds = new Set(edges.map((edge) => edge.targetContractId))
    return contracts.filter((contract) => !targetIds.has(contract.id)).map((contract) => contract.id)
  }, [contracts, edges])

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
      rail: graphColor('rail'),
      signal: graphColor('signal'),
      moss: graphColor('moss'),
      clay: graphColor('clay'),
      mossSurface: graphColor('moss-surface'),
      claySurface: graphColor('clay-surface'),
      edge: graphColor('edge'),
    }
    const isCompact = containerRef.current.clientWidth < 520
    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...contracts.map((contract) => ({
          data: {
            id: contract.id,
            label: contract.title,
            stage: contract.stage,
            record: Boolean(contract.completionRecordId),
          },
        })),
        ...edges.map((edge) => ({
          data: {
            id: edge.id,
            source: edge.sourceContractId,
            target: edge.targetContractId,
            type: edge.type,
          },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            width: '52px',
            height: '52px',
            label: isCompact ? '' : 'data(label)',
            'font-size': '10px',
            'font-family': 'Inter, sans-serif',
            'text-wrap': 'ellipsis',
            'text-max-width': '92px',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            color: colors.ink,
            'background-color': colors.paper,
            'border-width': '2px',
            'border-color': colors.rail,
          },
        },
        { selector: 'node[stage = "task"]', style: { 'border-color': colors.ink, 'background-color': colors.surface } },
        { selector: 'node[stage = "frozen"]', style: { 'border-color': colors.signal } },
        { selector: 'node[stage = "verified"]', style: { 'border-color': colors.moss, 'background-color': colors.mossSurface } },
        { selector: 'node[stage = "needs_supplement"]', style: { 'border-color': colors.clay, 'background-color': colors.claySurface } },
        { selector: 'node[stage = "completed"]', style: { 'border-color': colors.moss, 'background-color': colors.mossSurface } },
        { selector: 'node[stage = "sealed"]', style: { 'border-color': colors.ink, 'background-color': colors.paper, 'border-style': 'dashed' } },
        { selector: 'node[record = "true"]', style: { 'border-width': '4px' } },
        {
          selector: 'edge',
          style: {
            width: '2px',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'line-color': colors.edge,
            'target-arrow-color': colors.edge,
          },
        },
        {
          selector: 'edge[type = "supplement"]',
          style: {
            'line-style': 'dashed',
            'line-color': colors.clay,
            'target-arrow-color': colors.clay,
          },
        },
        {
          selector: 'edge[type = "closure"]',
          style: {
            'line-style': 'dashed',
            'line-color': colors.moss,
            'target-arrow-color': colors.moss,
          },
        },
        {
          selector: 'edge[type = "fork"]',
          style: {
            'line-style': 'dashed',
            'line-color': colors.signal,
            'target-arrow-color': colors.signal,
          },
        },
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        roots: rootIds,
        circle: false,
        spacingFactor: 1.25,
        padding: 24,
      },
      minZoom: 0.6,
      maxZoom: 2,
    })

    cy.on('tap', 'node', (event) => navigate(`/contracts/${event.target.id()}`))
    cyRef.current = cy
    return () => cy.destroy()
  }, [contracts, edges, navigate, rootIds, themeRevision])

  return <div ref={containerRef} className={`${heightClassName} w-full rounded-md border border-rail bg-surface`} />
}
