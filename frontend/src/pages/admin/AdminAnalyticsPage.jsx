import { useState, useEffect } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../api/axiosInstance'

// ── Formatting helpers ────────────────────────────────────────────────────────
function formatINR(amount) {
  if (amount == null) return '₹0'
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function shortINR(amount) {
  const n = Number(amount) || 0
  if (n >= 1_00_00_000) return '₹' + (n / 1_00_00_000).toFixed(1) + 'Cr'
  if (n >= 1_00_000)    return '₹' + (n / 1_00_000).toFixed(1) + 'L'
  if (n >= 1_000)       return '₹' + (n / 1_000).toFixed(1) + 'K'
  return '₹' + n.toFixed(0)
}

function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function shortDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })
}

// ── Status badge colours ──────────────────────────────────────────────────────
const STATUS_COLOR = {
  PENDING_PAYMENT:  { bg: '#fef3c7', text: '#92400e' },
  PAID:             { bg: '#d1fae5', text: '#065f46' },
  SHIPPED:          { bg: '#dbeafe', text: '#1e40af' },
  DELIVERED:        { bg: '#d1fae5', text: '#065f46' },
  CANCELLED:        { bg: '#fee2e2', text: '#991b1b' },
  EXPIRED:          { bg: '#f3f4f6', text: '#6b7280' },
  RETURN_REQUESTED: { bg: '#fef3c7', text: '#92400e' },
  RETURN_APPROVED:  { bg: '#d1fae5', text: '#065f46' },
  RETURN_REJECTED:  { bg: '#fee2e2', text: '#991b1b' },
  PICKUP_COMPLETED: { bg: '#dbeafe', text: '#1e40af' },
  REFUNDED:         { bg: '#ede9fe', text: '#5b21b6' },
}

// Colour palette for status donut chart
const STATUS_PALETTE = [
  '#4f46e5','#10b981','#f59e0b','#3b82f6','#ef4444',
  '#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316'
]

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = '#4f46e5' }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
      <div style={{
        width: 52, height: 52, borderRadius: 12,
        background: color + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.5rem', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {label}
        </div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
        {sub && <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── SVG Bar Chart (revenue last 30 days) ─────────────────────────────────────
function RevenueBarChart({ data }) {
  const W = 760, H = 180, PAD = { top: 10, right: 10, bottom: 40, left: 55 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  if (!data || data.length === 0) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No data</div>

  const maxRev = Math.max(...data.map(d => Number(d.revenue)), 1)
  const barW = innerW / data.length - 2

  // Show every 5th date label to avoid overlap
  const labelEvery = Math.ceil(data.length / 7)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {/* Y-axis grid lines + labels */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = PAD.top + innerH * (1 - frac)
        return (
          <g key={frac}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
              stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 3" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end"
              fontSize={10} fill="#9ca3af">
              {shortINR(maxRev * frac)}
            </text>
          </g>
        )
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const x = PAD.left + i * (innerW / data.length) + 1
        const barH = (Number(d.revenue) / maxRev) * innerH
        const y = PAD.top + innerH - barH
        const isZero = Number(d.revenue) === 0

        return (
          <g key={d.date}>
            <rect
              x={x} y={isZero ? PAD.top + innerH - 2 : y}
              width={barW} height={isZero ? 2 : barH}
              rx={3}
              fill={isZero ? '#e5e7eb' : '#4f46e5'}
              opacity={0.85}
            />
            {/* Date labels every Nth bar */}
            {i % labelEvery === 0 && (
              <text
                x={x + barW / 2} y={H - 4}
                textAnchor="middle" fontSize={9} fill="#9ca3af"
                transform={`rotate(-35, ${x + barW / 2}, ${H - 4})`}
              >
                {shortDate(d.date)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Donut Chart (status distribution) ────────────────────────────────────────
function DonutChart({ data }) {
  if (!data || data.length === 0) return null

  const total = data.reduce((s, d) => s + Number(d.count), 0)
  const R = 70, CX = 90, CY = 90, strokeW = 28

  let cumulative = 0
  const slices = data.map((d, i) => {
    const pct = Number(d.count) / total
    const start = cumulative
    cumulative += pct
    return { ...d, pct, start, color: STATUS_PALETTE[i % STATUS_PALETTE.length] }
  })

  function describeArc(startPct, endPct) {
    const startAngle = startPct * 2 * Math.PI - Math.PI / 2
    const endAngle   = endPct   * 2 * Math.PI - Math.PI / 2
    const x1 = CX + R * Math.cos(startAngle)
    const y1 = CY + R * Math.sin(startAngle)
    const x2 = CX + R * Math.cos(endAngle)
    const y2 = CY + R * Math.sin(endAngle)
    const large = endPct - startPct > 0.5 ? 1 : 0
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 180 180" style={{ width: 150, height: 150, flexShrink: 0 }}>
        {slices.map(s => (
          <path
            key={s.status}
            d={describeArc(s.start, s.start + s.pct)}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeW}
            strokeLinecap="butt"
          />
        ))}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--text)">{total}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize={9} fill="#9ca3af">TOTAL ORDERS</text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', flex: 1, minWidth: 160 }}>
        {slices.map(s => (
          <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.8rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text-muted)' }}>{s.status.replace(/_/g, ' ')}</span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{s.count}</span>
            <span style={{ color: 'var(--text-muted)' }}>({(s.pct * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminAnalyticsPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchData = () => {
    setLoading(true)
    api.get('/admin/analytics')
      .then(({ data }) => { setData(data); setLastRefresh(new Date()) })
      .catch(() => setError('Failed to load analytics data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  if (loading && !data) return (
    <AdminLayout title="📊 Analytics Dashboard">
      <div className="loading-center"><div className="spinner" /></div>
    </AdminLayout>
  )

  if (error) return (
    <AdminLayout title="📊 Analytics Dashboard">
      <div className="alert alert-error">{error}</div>
    </AdminLayout>
  )

  const d = data

  return (
    <AdminLayout title="📊 Analytics Dashboard">
      {/* Refresh bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
        {lastRefresh && (
          <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
            Last updated: {lastRefresh.toLocaleTimeString('en-IN')}
          </span>
        )}
        <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
          {loading ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <KpiCard icon="💰" label="Total Revenue"    value={shortINR(d.totalRevenue)}   sub={formatINR(d.totalRevenue)}              color="#4f46e5" />
        <KpiCard icon="🧾" label="Total Orders"     value={d.totalOrders}              sub="All time"                               color="#10b981" />
        <KpiCard icon="👥" label="Customers"        value={d.totalCustomers}            sub="Unique buyers"                          color="#f59e0b" />
        <KpiCard icon="📈" label="Avg Order Value"  value={shortINR(d.avgOrderValue)}  sub={formatINR(d.avgOrderValue)}             color="#3b82f6" />
        <KpiCard icon="⏳" label="Pending Payment"  value={d.pendingOrders}             sub="Awaiting payment"                       color="#ef4444" />
        <KpiCard icon="🚀" label="Processing"       value={d.processingOrders}          sub="Paid + Shipped"                         color="#06b6d4" />
        <KpiCard icon="↩️" label="Returns"          value={d.totalReturns}              sub={`${formatINR(d.totalRefunded)} refunded`} color="#8b5cf6" />
      </div>

      {/* ── Revenue Bar Chart ──────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Revenue — Last 30 Days</h3>
            <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Daily revenue from paid orders (IST)
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4f46e5' }}>
              {shortINR(d.revenueByDay?.reduce((s, r) => s + Number(r.revenue), 0))}
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>30-day total</div>
          </div>
        </div>
        <RevenueBarChart data={d.revenueByDay} />
      </div>

      {/* ── Bottom Row: Top Products + Status Distribution ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

        {/* Top 5 Products */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem' }}>🏆 Top Products by Revenue</h3>
          {d.topProducts?.length === 0
            ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No sales data yet</div>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ textAlign: 'left', padding: '.5rem .4rem', fontWeight: 600 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '.5rem .4rem', fontWeight: 600 }}>Product</th>
                    <th style={{ textAlign: 'right', padding: '.5rem .4rem', fontWeight: 600 }}>Units</th>
                    <th style={{ textAlign: 'right', padding: '.5rem .4rem', fontWeight: 600 }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {d.topProducts.map((p, i) => (
                    <tr key={p.productName} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '.6rem .4rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </td>
                      <td style={{ padding: '.6rem .4rem', fontWeight: 600 }}>
                        {p.productName}
                        <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          {p.orderCount} order{p.orderCount !== 1 ? 's' : ''}
                        </div>
                      </td>
                      <td style={{ padding: '.6rem .4rem', textAlign: 'right', color: 'var(--text-muted)' }}>{p.unitsSold}</td>
                      <td style={{ padding: '.6rem .4rem', textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>
                        {shortINR(p.totalRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>

        {/* Order Status Distribution */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem' }}>📊 Order Status Distribution</h3>
          <DonutChart data={d.statusDistribution} />
        </div>
      </div>

      {/* ── Recent Orders ──────────────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ marginBottom: '1.25rem' }}>🕐 Recent Orders</h3>
        {d.recentOrders?.length === 0
          ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No orders yet</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.88rem', minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                    {['Order #', 'Customer', 'Amount', 'Status', 'Date'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '.5rem .75rem', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.recentOrders.map(o => {
                    const badge = STATUS_COLOR[o.status] || { bg: '#f3f4f6', text: '#374151' }
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '.65rem .75rem', fontWeight: 700, color: '#4f46e5' }}>{o.orderNumber}</td>
                        <td style={{ padding: '.65rem .75rem' }}>
                          <div style={{ fontWeight: 600 }}>{o.customerName}</div>
                          <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{o.customerEmail}</div>
                        </td>
                        <td style={{ padding: '.65rem .75rem', fontWeight: 700 }}>{formatINR(o.total)}</td>
                        <td style={{ padding: '.65rem .75rem' }}>
                          <span style={{
                            background: badge.bg, color: badge.text,
                            padding: '.2rem .6rem', borderRadius: 999,
                            fontSize: '.75rem', fontWeight: 700,
                          }}>
                            {o.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '.65rem .75rem', color: 'var(--text-muted)', fontSize: '.82rem' }}>
                          {formatDate(o.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </AdminLayout>
  )
}

