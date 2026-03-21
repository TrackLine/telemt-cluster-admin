import { useEffect, useMemo } from 'react'
import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Topology, NodeStatus } from '../api'
import { StatusDot } from './StatusDot'

const REGION_FLAGS: Record<string, string> = {
  RU: '🇷🇺', DE: '🇩🇪', AT: '🇦🇹', FR: '🇫🇷', NL: '🇳🇱',
  FI: '🇫🇮', US: '🇺🇸', GB: '🇬🇧', PL: '🇵🇱', CZ: '🇨🇿',
}

type NodeData = {
  label: string
  name: string
  type: string
  region: string
  status: NodeStatus
  load: number
} & Record<string, unknown>

type TopologyFlowNode = Node<NodeData>

function NodeCard({ data }: NodeProps<TopologyFlowNode>) {
  const flag = REGION_FLAGS[data.region] || ''
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '8px 12px',
        minWidth: 110,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <StatusDot status={data.status} pulse={data.status === 'ok'} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          {flag && <span style={{ marginRight: 4 }}>{flag}</span>}
          {data.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {data.load > 0 ? `${data.load.toLocaleString()} conns` : data.type}
        </div>
      </div>
    </div>
  )
}

const nodeTypes = { custom: NodeCard }

interface Props {
  topology: Topology
}

export function TopologyGraph({ topology }: Props) {
  const { rfNodes, rfEdges } = useMemo(() => {
    const entries = topology.nodes.filter(n => n.type === 'entry')
    const backends = topology.nodes.filter(n => n.type === 'backend')

    const ENTRY_X = 60
    const BACKEND_X = 320
    const GAP_Y = 90

    const entryH = entries.length * GAP_Y
    const backendH = backends.length * GAP_Y
    const maxH = Math.max(entryH, backendH, 90)

    const rfNodes: TopologyFlowNode[] = [
      ...entries.map((n, i) => ({
        id: n.id,
        type: 'custom',
        position: { x: ENTRY_X, y: (maxH - entryH) / 2 + i * GAP_Y },
        data: { label: n.name, ...n } as NodeData,
      })),
      ...backends.map((n, i) => ({
        id: n.id,
        type: 'custom',
        position: { x: BACKEND_X, y: (maxH - backendH) / 2 + i * GAP_Y },
        data: { label: n.name, ...n } as NodeData,
      })),
    ]

    const rfEdges: Edge[] = topology.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      style: { stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 },
    }))

    return { rfNodes, rfEdges }
  }, [topology])

  const [nodes, setNodes, onNodesChange] = useNodesState<TopologyFlowNode>(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  useEffect(() => { setNodes(rfNodes) }, [rfNodes])
  useEffect(() => { setEdges(rfEdges) }, [rfEdges])

  const nodeCount = Math.max(
    topology.nodes.filter(n => n.type === 'entry').length,
    topology.nodes.filter(n => n.type === 'backend').length,
    1,
  )

  return (
    <div style={{ height: Math.max(nodeCount * 90 + 40, 160), borderRadius: 8, overflow: 'hidden' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnDrag={false}
        style={{ background: 'var(--bg-card)' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.02)" variant={BackgroundVariant.Dots} gap={20} size={1} />
      </ReactFlow>
    </div>
  )
}
