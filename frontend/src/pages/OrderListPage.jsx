import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axiosInstance'

const STATUS_BADGE = {
  PENDING_PAYMENT: 'badge-pending',
  PAID:            'badge-paid',
  SHIPPED:         'badge-shipped',
  DELIVERED:       'badge-delivered',
  CANCELLED:       'badge-cancelled',
  EXPIRED:         'badge-expired',
}

function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

/** Always displays in Indian Standard Time (IST, UTC+5:30) */
function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

function formatDateOnly(dt) {
  if (!dt) return '—'
  const dateObj = typeof dt === 'string' && dt.length === 10 ? new Date(dt + 'T00:00:00') : new Date(dt)
  return dateObj.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  })
}

export default function OrderListPage() {
  const navigate = useNavigate()
  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [page, setPage]           = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    setLoading(true)
    api.get('/orders/me', { params: { page, size: 10 } })
      .then(({ data }) => {
        setOrders(data.content)
        setTotalPages(data.totalPages)
      })
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false))
  }, [page])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (error)   return <div className="page-container"><div className="alert alert-error">{error}</div></div>

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>My Orders</h1>
        <p>Track all your past and active orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <h3>No orders yet</h3>
          <p>Start shopping to see your orders here</p>
          <button className="btn btn-primary mt-2" onClick={() => navigate('/products')}>
            Shop Now
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Placed On</th>
                <th>Delivery / Arrival</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td style={{ fontWeight: 700 }}>{order.orderNumber}</td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>
                    {order.status === 'DELIVERED' ? (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>
                        ✓ Delivered {order.deliveredAt ? formatDate(order.deliveredAt) : ''}
                      </span>
                    ) : order.status === 'CANCELLED' || order.status === 'EXPIRED' ? (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    ) : order.estimatedDeliveryDate ? (
                      <span style={{ fontWeight: 600, color: '#2563eb' }}>
                        🚚 By {formatDateOnly(order.estimatedDeliveryDate)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>{formatINR(order.total)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[order.status] || ''}`}>
                      {order.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      Track →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ color: 'var(--text-muted)', padding: '0 .5rem' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  )
}
