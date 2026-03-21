import type { NodeStatus } from '../api'

const colors: Record<NodeStatus, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  down: 'var(--down)',
  unknown: 'var(--unknown)',
}

interface Props {
  status: NodeStatus
  pulse?: boolean
  size?: number
}

export function StatusDot({ status, pulse = false, size = 7 }: Props) {
  const color = colors[status]
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: pulse && status === 'ok' ? `0 0 0 2px ${color}33` : undefined,
        animation: pulse && status === 'ok' ? 'pulse 2s infinite' : undefined,
      }}
    />
  )
}
