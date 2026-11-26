import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/axiosInstance'

const STATUS_BADGE = {
  PENDING_PAYMENT:  'badge-pending',
  PAID:             'badge-paid',
  SHIPPED:          'badge-shipped',
  DELIVERED:        'badge-delivered',
  CANCELLED:        'badge-cancelled',
  EXPIRED:          'badge-expired',
  RETURN_REQUESTED: 'badge-pending',
  RETURN_APPROVED:  'badge-paid',
  RETURN_REJECTED:  'badge-cancelled',
  PICKUP_COMPLETED: 'badge-shipped',
  REFUNDED:         'badge-delivered',
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
  PENDING_PAYMENT:  { label: 'Order Placed',       icon: '🛒' },
  PAID:             { label: 'Payment Done',        icon: '✅' },
  SHIPPED:          { label: 'Shipped',             icon: '🚚' },
  DELIVERED:        { label: 'Delivered',           icon: '📦' },
  CANCELLED:        { label: 'Cancelled',           icon: '❌' },
  EXPIRED:          { label: 'Expired',             icon: '⏰' },
  RETURN_REQUESTED: { label: 'Return Requested',    icon: '↩️' },
  RETURN_APPROVED:  { label: 'Return Approved',     icon: '✅' },
  RETURN_REJECTED:  { label: 'Return Rejected',     icon: '❌' },
  PICKUP_COMPLETED: { label: 'Pickup Completed',    icon: '🏠' },
  REFUNDED:         { label: 'Refunded',            icon: '💰' },
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

  // Return request modal state
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnReason, setReturnReason]       = useState('')
  const [returnCondition, setReturnCondition] = useState('UNOPENED')
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [returnError, setReturnError]         = useState('')
  const [returnInfo, setReturnInfo]           = useState(null)   // existing return data

  const fetchOrder = useCallback(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => setOrder(data))
      .catch(() => setError('Order not found'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchOrder() }, [fetchOrder])

  // Fetch return info if order is in return workflow
  useEffect(() => {
    const returnStatuses = ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'PICKUP_COMPLETED', 'REFUNDED']
    if (order && returnStatuses.includes(order.status)) {
      api.get(`/orders/${id}/return`)
        .then(({ data }) => setReturnInfo(data))
        .catch(() => {})
    }
  }, [order, id])

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

  // ── Return request handler ───────────────────────────────────────────────
  const handleReturnSubmit = async () => {
    if (!returnReason.trim() || returnReason.trim().length < 10) {
      setReturnError('Please describe the reason in at least 10 characters.')
      return
    }
    setReturnSubmitting(true)
    setReturnError('')
    try {
      await api.post(`/orders/${id}/return`, {
        reason: returnReason.trim(),
        itemCondition: returnCondition,
      })
      setShowReturnModal(false)
      setReturnReason('')
      fetchOrder()
    } catch (err) {
      setReturnError(err.response?.data?.message || 'Failed to submit return request')
    } finally {
      setReturnSubmitting(false)
    }
  }

  // ── 7-day return window check ────────────────────────────────────────────
  const withinReturnWindow = () => {
    if (!order?.deliveredAt) return false
    const deliveredAt = new Date(order.deliveredAt)
    const now = new Date()
    const diffDays = (now - deliveredAt) / (1000 * 60 * 60 * 24)
    return diffDays <= 7
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (error)   return <div className="page-container"><div className="alert alert-error">{error}</div></div>
  if (!order)  return null

  const canCancel = order.status === 'PENDING_PAYMENT' || order.status === 'PAID'
  const canPay    = order.status === 'PENDING_PAYMENT' && countdown && countdown !== 'EXPIRED'

  const isShipped = order.status === 'SHIPPED' || order.status === 'DELIVERED'
  const isDelivered = order.status === 'DELIVERED'
  const isTerminated = order.status === 'CANCELLED' || order.status === 'EXPIRED'

  const returnStatuses = ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'PICKUP_COMPLETED', 'REFUNDED']
  const inReturnFlow   = returnStatuses.includes(order.status)
  const canReturn      = order.status === 'DELIVERED' && withinReturnWindow()

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

          {/* Return Request button — shown for DELIVERED orders within 7 days */}
          {canReturn && (
            <div className="card">
              <h3 style={{ marginBottom: '.5rem' }}>Return & Refund</h3>
              <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Not happy with your order? Request a return within 7 days of delivery.
              </p>
              <button
                className="btn btn-secondary w-full"
                onClick={() => { setShowReturnModal(true); setReturnError('') }}
              >
                ↩️ Request Return
              </button>
            </div>
          )}

          {/* Return status panel — shown when already in return workflow */}
          {inReturnFlow && returnInfo && (
            <div className="card" style={{
              border: '2px solid',
              borderColor: order.status === 'REFUNDED' ? '#8b5cf6' :
                           order.status === 'RETURN_REJECTED' ? '#ef4444' : '#f59e0b'
            }}>
              <h3 style={{ marginBottom: '1rem' }}>↩️ Return Status</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', fontSize: '.9rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                  <strong>{order.status.replace(/_/g, ' ')}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Reason: </span>
                  {returnInfo.reason}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Condition: </span>
                  {returnInfo.itemCondition?.replace('_', ' ')}
                </div>
                {returnInfo.adminNote && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Admin Note: </span>
                    {returnInfo.adminNote}
                  </div>
                )}
                {returnInfo.razorpayRefundId && (
                  <div style={{ background: '#ede9fe', borderRadius: 8, padding: '.75rem', marginTop: '.5rem' }}>
                    <div style={{ color: '#5b21b6', fontWeight: 700 }}>💰 Refund Initiated</div>
                    <div style={{ fontSize: '.8rem', marginTop: '.25rem' }}>
                      Refund ID: <code>{returnInfo.razorpayRefundId}</code>
                    </div>
                    {returnInfo.refundAmount && (
                      <div style={{ fontSize: '.8rem' }}>
                        Amount: ₹{Number(returnInfo.refundAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                    <div style={{ fontSize: '.75rem', color: '#6d28d9', marginTop: '.25rem' }}>
                      Reflects in your account within 5-7 business days
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Return Request Modal ───────────────────────────────────────────── */}
      {showReturnModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0 }}>↩️ Request Return</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowReturnModal(false)}>✕</button>
            </div>

            <div style={{ marginBottom: '1rem', background: 'var(--surface-2)', borderRadius: 8, padding: '1rem', fontSize: '.9rem' }}>
              <strong>Order:</strong> {order.orderNumber}<br />
              <strong>Return window closes:</strong>{' '}
              {order.deliveredAt
                ? new Date(new Date(order.deliveredAt).getTime() + 7 * 24 * 60 * 60 * 1000)
                    .toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
                : '7 days from delivery'}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '.5rem' }}>
                Reason for Return <span style={{ color: 'red' }}>*</span>
              </label>
              <textarea
                className="form-input"
                rows={4}
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                placeholder="Please describe why you want to return this order (min 10 characters)..."
                style={{ width: '100%', resize: 'vertical' }}
              />
              <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>
                {returnReason.length} / 1000 characters (minimum 10)
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '.5rem' }}>
                Item Condition <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                className="form-input"
                value={returnCondition}
                onChange={e => setReturnCondition(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="UNOPENED">Unopened / Unused</option>
                <option value="DAMAGED">Damaged / Defective</option>
                <option value="WRONG_ITEM">Wrong Item Received</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="alert" style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '.75rem', marginBottom: '1rem', fontSize: '.85rem' }}>
              ⚠️ Once approved, our team will arrange a pickup. Refund will be processed after the item is picked up. No stock deduction occurs.
            </div>

            {returnError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{returnError}</div>}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="btn btn-primary w-full"
                onClick={handleReturnSubmit}
                disabled={returnSubmitting || returnReason.trim().length < 10}
              >
                {returnSubmitting ? 'Submitting...' : 'Submit Return Request'}
              </button>
              <button className="btn btn-secondary w-full" onClick={() => setShowReturnModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
