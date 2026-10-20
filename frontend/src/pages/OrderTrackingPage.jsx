import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

/** Formats date only (e.g. "Thu, 24 Oct 2026") in IST */
function formatDateOnly(dt) {
  if (!dt) return '—'
  const dateObj = typeof dt === 'string' && dt.length === 10 ? new Date(dt + 'T00:00:00') : new Date(dt)
  return dateObj.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

/** Human-readable label + icon for each order status */
const STATUS_LABELS = {
  PENDING_PAYMENT: { label: 'Order Placed',   icon: '🛒' },
  PAID:            { label: 'Payment Done',    icon: '✅' },
  SHIPPED:         { label: 'Shipped',         icon: '🚚' },
  DELIVERED:       { label: 'Delivered',       icon: '📦' },
  CANCELLED:       { label: 'Cancelled',       icon: '❌' },
  EXPIRED:         { label: 'Expired',         icon: '⏰' },
}

/** Live countdown until expiresAt — returns "MM:SS" or null if not applicable. */
function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!expiresAt) return

    const tick = () => {
      const diff = new Date(expiresAt) - new Date()
      setRemaining(diff > 0 ? diff : 0)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  if (remaining === null) return null
  if (remaining <= 0)    return 'EXPIRED'

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default function OrderTrackingPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [order, setOrder]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [cancelling, setCancelling] = useState(false)

  const fetchOrder = useCallback(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => setOrder(data))
      .catch(() => setError('Order not found'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchOrder() }, [fetchOrder])

  const countdown = useCountdown(
    order?.status === 'PENDING_PAYMENT' ? order.expiresAt : null
  )

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order?')) return
    setCancelling(true)
    try {
      await api.patch(`/orders/${id}/cancel`)
      fetchOrder()
    } catch (err) {
      alert(err.response?.data?.message || 'Cannot cancel this order')
    } finally {
      setCancelling(false)
    }
  }

  const handlePayNow = () => {
    navigate('/payment', {
      state: { orderId: order.id, orderNumber: order.orderNumber, total: order.total }
    })
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (error)   return <div className="page-container"><div className="alert alert-error">{error}</div></div>
  if (!order)  return null

  const canCancel = order.status === 'PENDING_PAYMENT' || order.status === 'PAID'
  const canPay    = order.status === 'PENDING_PAYMENT' && countdown && countdown !== 'EXPIRED'

  const isShipped = order.status === 'SHIPPED' || order.status === 'DELIVERED'
  const isDelivered = order.status === 'DELIVERED'
  const isTerminated = order.status === 'CANCELLED' || order.status === 'EXPIRED'

  return (
    <div className="page-container">
      <button className="btn btn-secondary btn-sm mb-2" onClick={() => navigate('/orders')}>← My Orders</button>

      <div className="flex-between page-header">
        <div>
          <h1>Order {order.orderNumber}</h1>
          <p>Placed on {formatDate(order.createdAt)}</p>
        </div>
        <span className={`badge ${STATUS_BADGE[order.status] || ''}`} style={{ fontSize: '1rem' }}>
          {order.status?.replace('_', ' ')}
        </span>
      </div>

      {/* Flipkart-style Delivery Status Highlight */}
      <div style={{
        background: isDelivered ? '#f0fdf4' : isTerminated ? '#fef2f2' : '#eff6ff',
        border: `1px solid ${isDelivered ? '#bbf7d0' : isTerminated ? '#fecaca' : '#bfdbfe'}`,
        borderRadius: '10px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '2.2rem' }}>
            {isDelivered ? '🎉' : isShipped ? '🚚' : isTerminated ? '❌' : '📦'}
          </span>
          <div>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: isDelivered ? '#166534' : isTerminated ? '#991b1b' : '#1e40af'
            }}>
              {isDelivered
                ? `Delivered on ${formatDate(order.deliveredAt || order.updatedAt)}`
                : isShipped
                ? `Arriving by ${formatDateOnly(order.estimatedDeliveryDate)}`
                : order.status === 'PAID'
                ? `Order Confirmed — Arriving by ${formatDateOnly(order.estimatedDeliveryDate)}`
                : order.status === 'PENDING_PAYMENT'
                ? `Order Placed — Expected Delivery: ${formatDateOnly(order.estimatedDeliveryDate)}`
                : `Order ${order.status?.replace('_', ' ')}`
              }
            </div>
            <div style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {isDelivered
                ? 'Your package has been successfully delivered'
                : isShipped
                ? `Shipped on ${formatDate(order.shippedAt || order.updatedAt)}`
                : order.status === 'PAID'
                ? `Expected Dispatch: ${formatDateOnly(order.estimatedShipDate)}`
                : order.status === 'PENDING_PAYMENT'
                ? 'Complete your payment before expiry to initiate shipment'
                : ''}
            </div>
          </div>
        </div>

        {/* Quick Delivery Summary Badges */}
        {(order.estimatedShipDate || order.estimatedDeliveryDate) && !isTerminated && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ background: '#ffffff', padding: '.6rem .9rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '.85rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600 }}>DISPATCH</div>
              <strong>{order.shippedAt ? formatDate(order.shippedAt) : `Est: ${formatDateOnly(order.estimatedShipDate)}`}</strong>
            </div>
            <div style={{ background: '#ffffff', padding: '.6rem .9rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '.85rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600 }}>DELIVERY</div>
              <strong>{order.deliveredAt ? formatDate(order.deliveredAt) : `Est: ${formatDateOnly(order.estimatedDeliveryDate)}`}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Countdown for pending orders */}
      {order.status === 'PENDING_PAYMENT' && countdown && (
        <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            {countdown === 'EXPIRED'
              ? '⏰ Payment window has expired'
              : <>⏳ Pay within: <span className={`countdown ${countdown === 'EXPIRED' ? 'expired' : ''}`}>{countdown}</span></>
            }
          </span>
          {canPay && (
            <button id="pay-now-tracking-btn" className="btn btn-primary btn-sm" onClick={handlePayNow}>
              💳 Pay Now
            </button>
          )}
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start', gap: '2rem' }}>
        {/* Left: Status timeline + items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Status history timeline */}
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem' }}>Order Timeline</h3>
            <div className="timeline">
              {order.statusHistory?.map((h, i) => {
                const meta = STATUS_LABELS[h.toStatus] || { label: h.toStatus?.replace('_', ' '), icon: '•' }
                return (
                  <div key={i} className="timeline-item completed">
                    <div className="timeline-dot" />
                    <div className="timeline-date">{formatDate(h.changedAt)}</div>
                    <div className="timeline-label">
                      <span style={{ marginRight: '.4rem' }}>{meta.icon}</span>
                      <strong>{meta.label}</strong>
                      {h.changedBy && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '.8rem', marginLeft: '.5rem' }}>
                          by {h.changedBy}
                        </span>
                      )}
                    </div>
                    {h.note && <div className="timeline-note">{h.note}</div>}
                  </div>
                )
              })}

              {/* Expected Upcoming Milestones (Flipkart-style) */}
              {!isTerminated && !isShipped && order.estimatedShipDate && (
                <div className="timeline-item" style={{ opacity: 0.75 }}>
                  <div className="timeline-dot" style={{ background: '#94a3b8' }} />
                  <div className="timeline-date">Est. {formatDateOnly(order.estimatedShipDate)}</div>
                  <div className="timeline-label">
                    <span style={{ marginRight: '.4rem' }}>🚚</span>
                    <span style={{ color: 'var(--text-muted)' }}>Expected to be Shipped</span>
                  </div>
                </div>
              )}

              {!isTerminated && !isDelivered && order.estimatedDeliveryDate && (
                <div className="timeline-item" style={{ opacity: 0.75 }}>
                  <div className="timeline-dot" style={{ background: '#94a3b8' }} />
                  <div className="timeline-date">Est. {formatDateOnly(order.estimatedDeliveryDate)}</div>
                  <div className="timeline-label">
                    <span style={{ marginRight: '.4rem' }}>📦</span>
                    <span style={{ color: 'var(--text-muted)' }}>Expected Delivery</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order items */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Items Ordered</h3>
            {order.items?.map(item => (
              <div key={item.id} className="flex-between" style={{ padding: '.75rem 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.productName}</div>
                  <div style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                    {formatINR(item.unitPrice)} × {item.quantity}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>{formatINR(item.lineTotal)}</div>
              </div>
            ))}
            <div className="flex-between mt-2" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              <span>Total</span>
              <span className="text-primary">{formatINR(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Right: Shipping address + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Shipping Address</h3>
            <div style={{ lineHeight: 2, color: 'var(--text)' }}>
              <div style={{ fontWeight: 700 }}>{order.shippingName}</div>
              <div>{order.shippingPhone}</div>
              <div>{order.shippingAddress}</div>
              <div>{order.shippingCity}, {order.shippingState} – {order.shippingPincode}</div>
            </div>
          </div>

          {canCancel && (
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Actions</h3>
              <button
                id="cancel-order-btn"
                className="btn btn-danger w-full"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : '✕ Cancel Order'}
              </button>
              <p style={{ fontSize: '.8rem', marginTop: '.5rem', textAlign: 'center' }}>
                {order.status === 'PENDING_PAYMENT'
                  ? 'Cancel before payment is completed'
                  : 'Cancel before order is shipped'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
