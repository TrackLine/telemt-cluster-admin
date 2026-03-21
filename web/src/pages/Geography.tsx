import { useEffect, useState, useCallback, useRef } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import { zoom as d3Zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom'
import { select } from 'd3-selection'
import 'd3-transition'
import { getGeoClients } from '../api'
import type { GeoResponse } from '../api'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const HOURS_OPTIONS = [
  { value: 1, label: '1h' },
  { value: 6, label: '6h' },
  { value: 24, label: '24h' },
]

const MAP_W = 960
const MAP_H = 500

const baseProjection = geoMercator().scale(148).translate([MAP_W / 2, MAP_H / 1.55])
const basePath = geoPath(baseProjection)

function getRadius(connections: number, maxConnections: number): number {
  if (maxConnections === 0) return 5
  const ratio = connections / maxConnections
  return Math.max(5, Math.min(24, 5 + ratio * 19))
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 130 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ color: 'var(--text)', fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

type GeoFeature = { type: string; id?: string | number; geometry: object; properties: object }

export function Geography() {
  const [data, setData] = useState<GeoResponse | null>(null)
  const [hours, setHours] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [topoFeatures, setTopoFeatures] = useState<GeoFeature[]>([])
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [markerTooltip, setMarkerTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [updateStatus, setUpdateStatus] = useState<any>(null)
  const [updating, setUpdating] = useState(false)

  const svgRef = useRef<SVGSVGElement>(null)
  const zoomGroupRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<any>(null)

  // Load topojson
  useEffect(() => {
    fetch(GEO_URL)
      .then(r => r.json())
      .then((topo: any) => {
        import('topojson-client').then(({ feature }) => {
          const countries = feature(topo, topo.objects.countries) as any
          setTopoFeatures(countries.features || [])
        })
      })
      .catch(console.error)
  }, [])

  // Set up d3-zoom
  useEffect(() => {
    if (!svgRef.current || !zoomGroupRef.current) return
    const svg = select(svgRef.current)
    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .translateExtent([[-MAP_W * 0.5, -MAP_H * 0.5], [MAP_W * 1.5, MAP_H * 1.5]])
      .on('zoom', (event) => {
        setTransform(event.transform)
      })
    svg.call(zoomBehavior)
    zoomRef.current = zoomBehavior
    return () => { svg.on('.zoom', null) }
  }, [])

  const resetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, zoomIdentity)
  }, [])

  const zoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.5)
  }, [])

  const zoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.67)
  }, [])

  const load = useCallback(() => {
    getGeoClients(hours)
      .then(res => { setData(res); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [hours])

  useEffect(() => {
    setLoading(true); load()
    const iv = setInterval(load, 30_000)
    return () => clearInterval(iv)
  }, [load])

  // Load geo status
  const loadStatus = useCallback(() => {
    fetch('/api/geo/status').then(r => r.json()).then(setUpdateStatus).catch(() => {})
  }, [])

  useEffect(() => {
    loadStatus()
    const iv = setInterval(loadStatus, 5000)
    return () => clearInterval(iv)
  }, [loadStatus])

  const triggerUpdate = useCallback(async () => {
    setUpdating(true)
    try {
      await fetch('/api/geo/update', { method: 'POST' })
    } finally {
      setTimeout(() => setUpdating(false), 2000)
      setTimeout(loadStatus, 3000)
    }
  }, [loadStatus])

  const maxConnections = data?.points?.length ? Math.max(...data.points.map(p => p.connections)) : 1

  // Build country data map
  const countryDataMap: Record<string, { name: string; connections: number; cities: { city: string; connections: number }[] }> = {}
  if (data?.points) {
    for (const p of data.points) {
      if (!countryDataMap[p.country_code]) {
        countryDataMap[p.country_code] = { name: p.country_name || p.country_code, connections: 0, cities: [] }
      }
      countryDataMap[p.country_code].connections += p.connections
      if (p.city) {
        countryDataMap[p.country_code].cities.push({ city: p.city, connections: p.connections })
      }
    }
  }

  const countryList = Object.entries(countryDataMap)
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.connections - a.connections)

  const topCountry = countryList[0]?.name ?? '—'
  const selectedData = selectedCountry ? countryDataMap[selectedCountry] : null

  // Projection with current zoom transform
  const transformStr = `translate(${transform.x},${transform.y}) scale(${transform.k})`

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 4 }}>Geography</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Client connection origins · MaxMind GeoIP
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: 3 }}>
          {HOURS_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setHours(opt.value)} style={{
              padding: '5px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: hours === opt.value ? 'var(--ok)' : 'transparent',
              color: hours === opt.value ? '#0d0d0d' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* GeoIP banner */}
      {data && !data.geo_available && (
        <div style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.25)', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16 }}>⚠</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#ffc107', marginBottom: 3 }}>GeoIP database not loaded</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Задай{' '}
                  <code style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>MAXMIND_LICENSE_KEY</code>
                  {' '}и нажми «Скачать» — или положи{' '}
                  <code style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>GeoLite2-City.mmdb</code>
                  {' '}в <code style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>./data/</code>
                </div>
              </div>
            </div>
            <button
              onClick={triggerUpdate}
              disabled={updating || updateStatus?.in_progress}
              style={{
                padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(255,193,7,0.4)',
                background: 'rgba(255,193,7,0.1)', color: '#ffc107', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                opacity: (updating || updateStatus?.in_progress) ? 0.6 : 1,
              }}
            >
              {updating || updateStatus?.in_progress ? '⟳ Загрузка…' : '↓ Скачать БД'}
            </button>
          </div>
          {updateStatus?.last_error && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#ef4444', paddingLeft: 26 }}>
              Ошибка: {updateStatus.last_error}
            </div>
          )}
        </div>
      )}

      {/* If DB is available, show update button in a small bar */}
      {data && data.geo_available && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, justifyContent: 'flex-end' }}>
          {updateStatus?.last_update && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Обновлена: {new Date(updateStatus.last_update).toLocaleDateString('ru')}
            </span>
          )}
          <button
            onClick={triggerUpdate}
            disabled={updating || updateStatus?.in_progress}
            style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: 11, opacity: (updating || updateStatus?.in_progress) ? 0.6 : 1,
            }}
          >
            {updating || updateStatus?.in_progress ? '⟳ Обновление…' : '↓ Обновить БД'}
          </button>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--down)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const }}>
        <StatCard label="Total Connections" value={loading ? '—' : (data?.total_connections ?? 0)} />
        <StatCard label="Countries" value={loading ? '—' : (data?.total_countries ?? 0)} />
        <StatCard label="Top Country" value={loading ? '—' : topCountry} />
        <StatCard label="Window" value={`${hours}h`} />
      </div>

      {/* Map + optional side panel */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Map */}
        <div style={{ flex: 1, background: '#0d1117', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', position: 'relative', minWidth: 0 }}>
          {loading && (
            <div style={{ position: 'absolute', top: 12, right: 52, fontSize: 11, color: 'var(--text-muted)', zIndex: 5 }}>
              Loading…
            </div>
          )}

          {/* Zoom controls */}
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
            {[{ label: '+', fn: zoomIn }, { label: '−', fn: zoomOut }, { label: '⌂', fn: resetZoom }].map(btn => (
              <button key={btn.label} onClick={btn.fn} style={{
                width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.6)', color: 'var(--text)', cursor: 'pointer',
                fontSize: btn.label === '⌂' ? 13 : 16, lineHeight: 1, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}>
                {btn.label}
              </button>
            ))}
          </div>

          {/* Marker tooltip */}
          {markerTooltip && (
            <div style={{
              position: 'absolute', left: markerTooltip.x, top: markerTooltip.y,
              transform: 'translate(-50%, -100%)',
              background: 'rgba(10,10,10,0.92)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '5px 10px', fontSize: 12, color: 'var(--text)',
              whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20,
            }}>
              {markerTooltip.text}
            </div>
          )}

          <svg
            ref={svgRef}
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            style={{ width: '100%', display: 'block', cursor: 'grab' }}
          >
            <g ref={zoomGroupRef} transform={transformStr}>
              {/* Countries */}
              {topoFeatures.map((feat: any, i: number) => {
                const d = basePath(feat as any) ?? ''
                const isHovered = hoveredCountry === String(feat.id)
                return (
                  <path
                    key={feat.id ?? i}
                    d={d}
                    fill={isHovered ? '#2a3f5f' : '#1a2332'}
                    stroke="#0d1117"
                    strokeWidth={0.5 / transform.k}
                    style={{ cursor: 'default', transition: 'fill 0.1s' }}
                    onMouseEnter={() => setHoveredCountry(String(feat.id))}
                    onMouseLeave={() => setHoveredCountry(null)}
                  />
                )
              })}

              {/* Connection markers */}
              {data?.points.map((p, i) => {
                const coord = baseProjection([p.lng, p.lat])
                if (!coord) return null
                const r = getRadius(p.connections, maxConnections) / transform.k
                return (
                  <g key={i} style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedCountry(
                      selectedCountry === p.country_code ? null : p.country_code
                    )}
                  >
                    <circle cx={coord[0]} cy={coord[1]} r={r * 1.8} fill="var(--ok)" fillOpacity={0.12} />
                    <circle
                      cx={coord[0]} cy={coord[1]} r={r}
                      fill={selectedCountry === p.country_code ? '#fff' : 'var(--ok)'}
                      fillOpacity={0.8}
                      stroke={selectedCountry === p.country_code ? '#fff' : 'var(--ok)'}
                      strokeWidth={1 / transform.k}
                      onMouseEnter={() => {
                        const svg = svgRef.current
                        if (!svg) return
                        const rect = svg.getBoundingClientRect()
                        const svgScale = rect.width / MAP_W
                        setMarkerTooltip({
                          x: coord[0] * transform.k * svgScale + transform.x * svgScale,
                          y: coord[1] * transform.k * svgScale + transform.y * svgScale - 12,
                          text: `${p.city ? p.city + ', ' : ''}${p.country_name} — ${p.connections} conn`,
                        })
                      }}
                      onMouseLeave={() => setMarkerTooltip(null)}
                    />
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Legend */}
          <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)', opacity: 0.75 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Подключения</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Колесо мыши — зум · Перетащи — панорама · Клик по точке — детали</span>
          </div>
        </div>

        {/* Side panel — shown when a country is selected */}
        {selectedCountry && selectedData && (
          <div style={{
            minWidth: 260, flex: 1, background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedData.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{selectedCountry}</div>
              </div>
              <button onClick={() => setSelectedCountry(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
            </div>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.4px' }}>Connections</div>
              <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{selectedData.connections.toLocaleString()}</div>
            </div>
            {selectedData.cities.length > 0 && (
              <div style={{ padding: '12px 0' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 16px 8px', textTransform: 'uppercase' as const, letterSpacing: '0.4px' }}>Cities</div>
                {selectedData.cities.sort((a, b) => b.connections - a.connections).slice(0, 10).map(city => (
                  <div key={city.city} style={{ padding: '6px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span>{city.city}</span>
                    <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{city.connections}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!loading && data && data.points.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌍</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>Нет данных о клиентах</div>
          <div style={{ fontSize: 13 }}>
            {data.geo_available ? 'Данные появятся когда клиенты подключатся к backend-нодам.' : 'Загрузи базу MaxMind чтобы начать сбор геоданных.'}
          </div>
        </div>
      )}

      {/* Country table */}
      {countryList.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Country Breakdown</span>
          </div>
          <div className="table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13, minWidth: 520 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['#', 'Country', 'Connections', 'Share'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: (i > 1 ? 'right' : 'left') as any, color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.4px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {countryList.map((c, i) => {
                const share = data ? ((c.connections / Math.max(data.total_connections, 1)) * 100).toFixed(1) : '0'
                const isSelected = selectedCountry === c.code
                return (
                  <tr key={c.code}
                    onClick={() => setSelectedCountry(isSelected ? null : c.code)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'rgba(74,222,128,0.06)' : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(74,222,128,0.06)' : 'transparent' }}
                  >
                    <td style={{ padding: '10px 20px', color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ padding: '10px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)', flexShrink: 0, opacity: 0.8 }} />
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{c.code}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{c.connections.toLocaleString()}</td>
                    <td style={{ padding: '10px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${share}%`, height: '100%', background: 'var(--ok)', borderRadius: 2 }} />
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 40, textAlign: 'right' }}>{share}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}
