interface Props {
  children: React.ReactNode
  style?: React.CSSProperties
}

export function Card({ children, style }: Props) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
