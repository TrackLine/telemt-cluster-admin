import type { NodeStatus } from '../api'

const colors: Record<NodeStatus, string> = {
  ok:      'var(--ok)',
  warn:    'var(--warn)',
  down:    'var(--down)',
  unknown: 'var(--unknown)',
}

interface Props {
  status: NodeStatus
  pulse?: boolean
  size?: number
}

export function StatusDot({ status, pulse = false, size = 7 }: Props) {
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: colors[status],
      flexShrink: 0,
      animation: pulse && status === 'ok' ? 'pulse-ring 2.5s ease-out infinite' : undefined,
    }} />
  )
}

export function StatusBadge({ status }: { status: NodeStatus }) {
  const cls = status === 'ok' ? 'badge-ok' : status === 'warn' ? 'badge-warn' : status === 'down' ? 'badge-down' : 'badge-neutral'
  return (
    <span className={`badge ${cls}`}>
      <StatusDot status={status} size={6} />
      {status.toUpperCase()}
    </span>
  )
}
