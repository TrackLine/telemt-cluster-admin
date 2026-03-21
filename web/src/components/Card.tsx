interface CardProps {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

export function Card({ children, style, className = '' }: CardProps) {
  return (
    <div className={`card ${className}`.trim()} style={style}>
      {children}
    </div>
  )
}

interface CardHeadProps {
  title: string
  right?: React.ReactNode
}

export function CardHead({ title, right }: CardHeadProps) {
  return (
    <div className="card-head">
      <span className="card-head-title">{title}</span>
      {right && <div>{right}</div>}
    </div>
  )
}
