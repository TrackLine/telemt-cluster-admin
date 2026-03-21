import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getMetrics, type MetricSample } from '../api'

interface Props {
  nodeId: string
  metric: string
  color?: string
  range?: string
  label?: string
  format?: (v: number) => string
}

const fmt = (v: number) => v.toLocaleString()

export function MetricChart({
  nodeId,
  metric,
  color = 'var(--ok)',
  range = '1h',
  label,
  format = fmt,
}: Props) {
  const [data, setData] = useState<MetricSample[]>([])
  const [activeRange, setActiveRange] = useState(range)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await getMetrics(nodeId, metric, activeRange)
        if (!cancelled) setData(res.data || [])
      } catch {}
    }
    load()
    const id = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [nodeId, metric, activeRange])

  const chartData = data.map(s => ({
    t: new Date(s.sampled_at).getTime(),
    v: s.value,
  }))

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {label || metric}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {['1h', '6h', '24h'].map(r => (
            <button
              key={r}
              onClick={() => setActiveRange(r)}
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: activeRange === r ? 'var(--bg-hover)' : 'transparent',
                color: activeRange === r ? 'var(--text)' : 'var(--text-muted)',
                fontSize: 11,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={v => {
              const d = new Date(v)
              return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
            }}
            tick={{ fill: 'var(--text-dim)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={format}
            tick={{ fill: 'var(--text-dim)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--text)',
            }}
            labelFormatter={v => new Date(v).toLocaleTimeString()}
            formatter={(v) => [format(Number(v)), label || metric]}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
