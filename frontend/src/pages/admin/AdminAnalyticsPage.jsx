import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Download, Send, AlertTriangle } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar
} from 'recharts'
import AdminLayout from '../../components/AdminLayout'
import api from '../../api/axiosInstance'
import { useToast } from '../../context/ToastContext'
import { StatusBadge, formatINR } from '../../components/ui/GlassUI'

const AI_PROMPTS = [
  "Show today's orders",
  "Summarize sales",
  "Find low-stock products",
  "Predict demand",
  "Generate weekly sales report",
]

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    api.get('/admin/analytics')
      .then((res) => setData(res.data))
      .catch(() => toast('Could not load analytics', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const askAi = async (q) => {
    const query = (q || aiQuestion).trim()
    if (!query) return
    setAiQuestion(query)
    setAiLoading(true)
    try {
      const res = await api.post('/admin/ai/assistant', { question: query })
      setAiAnswer(res.data.answer)
    } catch {
      toast('Assistant did not respond', 'error')
    } finally {
      setAiLoading(false)
    }
  }

  const exportCsv = async () => {
    try {
      const res = await api.get('/admin/analytics/export/orders', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'orders-export.csv'
      a.click()
      toast('Exported orders-export.csv', 'success')
    } catch {
      toast('CSV export failed', 'error')
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Analytics & AI" subtitle="Live revenue, orders, and inventory counts">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton border border-[var(--border)]" />)}
        </div>
        <div className="h-72 rounded-xl skeleton border border-[var(--border)]" />
      </AdminLayout>
    )
  }

  if (!data) return null

  const kpis = [
    { label: 'Total revenue', value: formatINR(data.totalRevenue) },
    { label: 'Orders', value: data.totalOrders },
    { label: 'Customers', value: data.totalCustomers },
    { label: 'Average order', value: formatINR(data.avgOrderValue) },
    { label: 'Pending payment', value: data.pendingOrders },
    { label: 'Cancelled / expired', value: data.cancelledOrders ?? 0 },
    { label: 'Active products', value: data.totalProducts ?? 0 },
    { label: 'Returns', value: `${data.totalReturns} (${formatINR(data.totalRefunded)})` },
  ]

  return (
    <AdminLayout
      title="Analytics & AI"
      subtitle="Live revenue, orders, inventory counts, and operations assistant"
      actions={
        <button onClick={exportCsv} className="ts-btn-secondary !min-h-[40px] text-xs">
          <Download className="w-4 h-4" /> Export orders CSV
        </button>
      }
    >
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="ts-card p-5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{k.label}</div>
            <div className="mt-2 text-2xl font-semibold tabular tracking-tight text-[var(--text)]">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Operations AI Assistant */}
      <div className="ts-card p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Operations assistant</h2>
            <p className="text-xs text-[var(--text-muted)]">Query live orders, revenue trends, and low-stock products in plain language.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {AI_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => askAi(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); askAi() }} className="flex gap-2">
          <input
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            placeholder="Ask about today's orders, sales summary, or restock items..."
            className="input flex-1"
          />
          <button type="submit" disabled={aiLoading} className="ts-btn-primary shrink-0">
            <Send className="w-4 h-4" /> {aiLoading ? 'Working...' : 'Run query'}
          </button>
        </form>
        {aiAnswer && (
          <div className="mt-4 p-4 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed">
            {aiAnswer}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 ts-card p-5">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Revenue by day (last 30 days, ₹)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueByDay || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                <Area type="monotone" dataKey="revenue" stroke="#4d7eff" strokeWidth={2} fill="#4d7eff" fillOpacity={0.16} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ts-card p-5">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Orders by status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.statusDistribution || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis dataKey="status" type="category" width={110} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                <Bar dataKey="count" fill="#4d7eff" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Low stock + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="ts-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Low stock (10 or fewer)
            </h3>
            <Link to="/admin/products" className="ts-link text-xs">Adjust stock</Link>
          </div>
          {(!data.lowStockProducts || data.lowStockProducts.length === 0) ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">All active products are above threshold.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {data.lowStockProducts.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className={`font-mono text-xs ${p.stock === 0 ? 'text-[var(--danger)]' : 'text-amber-700 dark:text-amber-400'}`}>
                    {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ts-card p-5">
          <h3 className="text-sm font-semibold mb-4">Top products by revenue</h3>
          {(!data.topProducts || data.topProducts.length === 0) ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">No completed sales yet.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {data.topProducts.map((p) => (
                <div key={p.productName} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{p.productName}</div>
                    <div className="font-mono text-xs text-[var(--text-muted)]">{p.unitsSold} units &middot; {p.orderCount} orders</div>
                  </div>
                  <span className="font-semibold tabular">{formatINR(p.totalRevenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="ts-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent orders</h3>
          <Link to="/admin/orders" className="ts-link text-xs">View all orders</Link>
        </div>
        <div className="overflow-x-auto bg-[var(--bg)]">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(data.recentOrders || []).map((o) => (
                <tr key={o.id}>
                  <td className="font-mono font-medium text-[var(--primary)]">{o.orderNumber}</td>
                  <td>
                    <div className="font-medium">{o.customerName}</div>
                    <div className="text-xs text-[var(--text-muted)]">{o.customerEmail}</div>
                  </td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="text-right font-semibold tabular">{formatINR(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
