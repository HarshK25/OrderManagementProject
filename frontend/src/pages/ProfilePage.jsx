import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axiosInstance'
import { StatusBadge, PageTransition, formatINR } from '../components/ui/GlassUI'

export default function ProfilePage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [addresses, setAddresses] = useState([])
  const [wishlistCount, setWishlistCount] = useState(0)

  useEffect(() => {
    api.get('/orders/me', { params: { page: 0, size: 5 } }).then((r) => setOrders(r.data?.content || [])).catch(() => {})
    api.get('/addresses').then((r) => setAddresses(r.data || [])).catch(() => {})
    api.get('/wishlist').then((r) => setWishlistCount((r.data || []).length)).catch(() => {})
  }, [])

  const totalSpent = orders.reduce((acc, o) => acc + Number(o.total || 0), 0)

  return (
    <PageTransition className="max-w-[1240px] mx-auto px-6 py-10 space-y-8">
      <div className="pb-6 border-b border-[var(--border)] flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">{user?.role}</div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[var(--text)] mt-1">{user?.name}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{user?.email}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/addresses" className="ts-btn-secondary">Manage addresses</Link>
          <Link to="/orders" className="ts-btn-primary">View all orders</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="ts-card p-5">
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">Recent orders</div>
          <div className="text-3xl font-semibold tabular mt-2">{orders.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1 tabular">Recent spend: {formatINR(totalSpent)}</div>
        </div>
        <div className="ts-card p-5">
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">Saved addresses</div>
          <div className="text-3xl font-semibold tabular mt-2">{addresses.length}</div>
          <Link to="/addresses" className="ts-link text-xs mt-1 inline-block">Open address book</Link>
        </div>
        <div className="ts-card p-5">
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">Saved items</div>
          <div className="text-3xl font-semibold tabular mt-2">{wishlistCount}</div>
          <Link to="/wishlist" className="ts-link text-xs mt-1 inline-block">Open saved items</Link>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent orders</h2>
          <Link to="/orders" className="ts-link text-xs inline-flex items-center gap-1">All orders <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {orders.length === 0 ? (
          <div className="ts-card p-8 text-center text-sm text-[var(--text-muted)]">No orders placed yet.</div>
        ) : (
          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {orders.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="py-4 px-3 flex flex-wrap items-center justify-between gap-4 hover:bg-[var(--surface)] transition-colors">
                <div>
                  <div className="font-mono text-sm font-medium text-[var(--primary)]">{o.orderNumber}</div>
                  <div className="text-xs text-[var(--text-muted)]">{new Date(o.createdAt).toLocaleDateString('en-IN')}</div>
                </div>
                <StatusBadge status={o.status} />
                <div className="font-semibold text-sm tabular">{formatINR(o.total)}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
