import cytoscape, { type Core } from 'cytoscape'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExecStore } from '../store/useExecStore'

type ProjectGraphProps = {
  projectId: string
  heightClassName?: string
  visibleContractIds?: string[]
}

export function ProjectGraph({ projectId, heightClassName = 'h-[360px] min-h-[280px]', visibleContractIds }: ProjectGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)
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
    if (!containerRef.current) return

    cyRef.current?.destroy()
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
            color: '#161814',
            'background-color': '#f7f5ef',
            'border-width': '2px',
            'border-color': '#d9d2c4',
          },
        },
        { selector: 'node[stage = "task"]', style: { 'border-color': '#161814', 'background-color': '#ffffff' } },
        { selector: 'node[stage = "frozen"]', style: { 'border-color': '#1f7a8c' } },
        { selector: 'node[stage = "verified"]', style: { 'border-color': '#5d7c52', 'background-color': '#ecf2e7' } },
        { selector: 'node[stage = "needs_supplement"]', style: { 'border-color': '#a44a3f', 'background-color': '#f7e6e2' } },
        { selector: 'node[stage = "completed"]', style: { 'border-color': '#5d7c52', 'background-color': '#ecf2e7' } },
        { selector: 'node[record = "true"]', style: { 'border-width': '4px' } },
        {
          selector: 'edge',
          style: {
            width: '2px',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'line-color': '#8d9488',
            'target-arrow-color': '#8d9488',
          },
        },
        {
          selector: 'edge[type = "supplement"]',
          style: {
            'line-style': 'dashed',
            'line-color': '#a44a3f',
            'target-arrow-color': '#a44a3f',
          },
        },
        {
          selector: 'edge[type = "fork"]',
          style: {
            'line-style': 'dashed',
            'line-color': '#1f7a8c',
            'target-arrow-color': '#1f7a8c',
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
  }, [contracts, edges, navigate, rootIds])

  return <div ref={containerRef} className={`${heightClassName} w-full rounded-md border border-rail bg-white`} />
}
