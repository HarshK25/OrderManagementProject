import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Search, Download, ArrowRight } from 'lucide-react'
import api from '../api/axiosInstance'
import { StatusBadge, EmptyState, SkeletonCard, PageTransition, ThemedSelect, formatINR } from '../components/ui/GlassUI'

export default function OrderListPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page] = useState(0)

  useEffect(() => {
    setLoading(true)
    api.get('/orders/me', { params: { page, size: 15 } })
      .then(({ data }) => setOrders(data.content || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  const filtered = orders.filter((o) => {
    const matchText = !search || (o.orderNumber || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || o.status === statusFilter
    return matchText && matchStatus
  })

  const downloadInvoice = async (e, order) => {
    e.stopPropagation()
    try {
      const res = await api.get(`/orders/${order.id}/invoice`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${order.orderNumber}.pdf`
      a.click()
    } catch {}
  }

  return (
    <PageTransition className="max-w-[1240px] mx-auto px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-[var(--border)] mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[var(--text)]">Orders</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Track dispatch status, download PDF invoices, or request returns.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order number..." className="input pl-10 sm:!w-52" />
          </div>
          <ThemedSelect
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Filter orders by status"
            className="w-48"
            options={[
              { value: '', label: 'All statuses' },
              ...['PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'EXPIRED'].map((s) => ({
                value: s,
                label: s.replace(/_/g, ' '),
              })),
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><SkeletonCard className="h-20" /><SkeletonCard className="h-20" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Place an order from the catalog to track it here."
          action={<button className="ts-btn-primary" onClick={() => navigate('/products')}>Browse catalog</button>}
        />
      ) : (
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {filtered.map((o) => (
            <div
              key={o.id}
              onClick={() => navigate(`/orders/${o.id}`)}
              className="py-4 px-3 cursor-pointer hover:bg-[var(--surface)] transition-colors flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <div className="font-mono font-medium text-sm text-[var(--primary)]">{o.orderNumber}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {new Date(o.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <StatusBadge status={o.status} />
              <div className="font-semibold text-base tabular">{formatINR(o.total)}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => downloadInvoice(e, o)}
                  aria-label="Download PDF invoice"
                  className="ts-btn-secondary !min-h-[36px] !px-3 text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Invoice
                </button>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text)] px-2">
                  Track <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageTransition>
  )
}
