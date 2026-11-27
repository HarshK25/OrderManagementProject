import { useState, useEffect } from 'react'
import api from '../../api/axiosInstance'
import AdminLayout from '../../components/AdminLayout'

const STATUS_BADGE = {
  PENDING_PAYMENT:  'badge-pending',
  PAID:             'badge-paid',
  CONFIRMED:        'badge-paid',
  PACKED:           'badge-paid',
  SHIPPED:          'badge-shipped',
  OUT_FOR_DELIVERY: 'badge-shipped',
  DELIVERED:        'badge-delivered',
  CANCELLED:        'badge-cancelled',
  EXPIRED:          'badge-expired',
}

// Valid next statuses for each current status (admin view)
const NEXT_STATUSES = {
  PENDING_PAYMENT:  ['CONFIRMED', 'CANCELLED'],
  PAID:             ['CONFIRMED', 'PACKED', 'SHIPPED', 'CANCELLED'],
  CONFIRMED:        ['PACKED', 'SHIPPED', 'CANCELLED'],
  PACKED:           ['SHIPPED', 'CANCELLED'],
  SHIPPED:          ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
}

function formatINR(a) {
  return '₹' + Number(a).toLocaleString('en-IN', { minimumFractionDigits: 2 })
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

/** Formats date only (e.g. "24 Oct 2026") in IST */
function formatDateOnly(dt) {
  if (!dt) return '—'
  const dateObj = typeof dt === 'string' && dt.length === 10 ? new Date(dt + 'T00:00:00') : new Date(dt)
  return dateObj.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export default function AdminOrdersPage() {
  const [orders, setOrders]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]             = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [selectedOrder, setSelectedOrder] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [deletingId, setDeletingId]         = useState(null)

  // #9 AI Customer Notification Drafter state
  const [notifScenario, setNotifScenario] = useState('ORDER_UPDATE')
  const [notifTitle, setNotifTitle]       = useState('')
  const [notifBody, setNotifBody]         = useState('')
  const [notifSendEmail, setNotifSendEmail] = useState(false)
  const [notifBusy, setNotifBusy]         = useState(false)
  const [notifStatus, setNotifStatus]     = useState('')

  // Modal for shipping action with delivery date picker
  const [shippingModal, setShippingModal]   = useState({
    open: false,
    order: null,
    estimatedDeliveryDate: '',
    note: ''
  })

  const fetchOrders = () => {
    setLoading(true)
    const params = { page, size: 20 }
    if (statusFilter) params.status = statusFilter
    api.get('/admin/orders', { params })
      .then(({ data }) => { setOrders(data.content); setTotalPages(data.totalPages) })
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchOrders() }, [page, statusFilter])

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingStatus(true)
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: newStatus, note: `Admin: ${newStatus}` })
      fetchOrders()
      if (selectedOrder?.id === orderId) {
        const { data } = await api.get(`/admin/orders/${orderId}`)
        setSelectedOrder(data)
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Status update failed')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const onTriggerStatus = (order, nextStatus) => {
    if (nextStatus === 'SHIPPED') {
      const defaultDate = order.estimatedDeliveryDate || (() => {
        const d = new Date()
        d.setDate(d.getDate() + 3)
        return d.toISOString().split('T')[0]
      })()
      setShippingModal({
        open: true,
        order,
        estimatedDeliveryDate: defaultDate,
        note: 'Dispatched via Courier'
      })
    } else {
      handleStatusChange(order.id, nextStatus)
    }
  }

  const handleDelete = async (order) => {
    if (!window.confirm(`Permanently delete order ${order.orderNumber}?\nThis cannot be undone.`)) return
    setDeletingId(order.id)
    try {
      await api.delete(`/admin/orders/${order.id}`)
      if (selectedOrder?.id === order.id) setSelectedOrder(null)
      fetchOrders()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete order')
    } finally {
      setDeletingId(null)
    }
  }

  const openDetail = async (orderId) => {
    try {
      const { data } = await api.get(`/admin/orders/${orderId}`)
      setSelectedOrder(data)
    } catch {
      alert('Failed to load order details')
    }
  }

  const ALL_STATUSES = ['PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'EXPIRED']

  return (
    <AdminLayout title="Orders Management">
      {error && <div className="alert alert-error">{error}</div>}

      {/* Status filter */}
      <div className="filter-bar mb-2">
        <label style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '.9rem' }}>Filter by status:</label>
        <select
          className="select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
          style={{ maxWidth: '200px' }}
        >
          <option value="">All Orders</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'start' }}>
        {/* Orders table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Est. Delivery</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 700 }}>{order.orderNumber}</td>
                      <td style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                        {order.userEmail || '—'}
                      </td>
                      <td style={{ fontSize: '.85rem' }}>{formatDate(order.createdAt)}</td>
                      <td style={{ fontSize: '.85rem' }}>
                        {order.status === 'DELIVERED' ? (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>Delivered</span>
                        ) : order.estimatedDeliveryDate ? (
                          formatDateOnly(order.estimatedDeliveryDate)
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatINR(order.total)}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[order.status] || ''}`}>
                          {order.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {/* View detail */}
                          <button className="btn btn-secondary btn-sm" onClick={() => openDetail(order.id)}>
                            View
                          </button>

                          {/* Status transition buttons */}
                          {(NEXT_STATUSES[order.status] || []).map(nextStatus => (
                            <button
                              key={nextStatus}
                              className="btn btn-primary btn-sm"
                              disabled={updatingStatus || deletingId === order.id}
                              onClick={() => onTriggerStatus(order, nextStatus)}
                            >
                              → {nextStatus.replace('_', ' ')}
                            </button>
                          ))}

                          {/* Delete */}
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={deletingId === order.id || updatingStatus}
                            onClick={() => handleDelete(order)}
                          >
                            {deletingId === order.id ? '...' : 'Delete'}
                          </button>
                        </div>
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
              <span style={{ color: 'var(--text-muted)' }}>Page {page + 1} of {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>

        {/* Order detail panel */}
        {selectedOrder && (
          <div className="card" style={{ width: '340px', flexShrink: 0, position: 'sticky', top: '80px' }}>
            <div className="flex-between mb-2">
              <h3>{selectedOrder.orderNumber}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>
            <div style={{ marginBottom: '.75rem' }}>
              <span className={`badge ${STATUS_BADGE[selectedOrder.status] || ''}`}>
                {selectedOrder.status?.replace('_', ' ')}
              </span>
            </div>
            <div style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
              {selectedOrder.shippingName} · {selectedOrder.shippingCity}
            </div>

            {/* Delivery Timeline snapshot */}
            <div style={{ background: '#f8fafc', padding: '.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '.85rem', border: '1px solid var(--border)' }}>
              <div><strong>Est. Dispatch:</strong> {formatDateOnly(selectedOrder.estimatedShipDate)}</div>
              <div style={{ marginTop: '4px' }}><strong>Est. Delivery:</strong> {formatDateOnly(selectedOrder.estimatedDeliveryDate)}</div>
              {selectedOrder.shippedAt && (
                <div style={{ marginTop: '4px', color: '#2563eb' }}><strong>Shipped At:</strong> {formatDate(selectedOrder.shippedAt)}</div>
              )}
              {selectedOrder.deliveredAt && (
                <div style={{ marginTop: '4px', color: '#16a34a' }}><strong>Delivered At:</strong> {formatDate(selectedOrder.deliveredAt)}</div>
              )}
            </div>

            {/* Update status from detail panel */}
            {(NEXT_STATUSES[selectedOrder.status] || []).length > 0 && (
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                {(NEXT_STATUSES[selectedOrder.status] || []).map(nextStatus => (
                  <button
                    key={nextStatus}
                    className="btn btn-primary btn-sm"
                    disabled={updatingStatus}
                    onClick={() => onTriggerStatus(selectedOrder, nextStatus)}
                  >
                    → {nextStatus.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}

            {selectedOrder.items?.map(item => (
              <div key={item.id} className="flex-between" style={{ padding: '.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '.85rem' }}>
                <span>{item.productName} ×{item.quantity}</span>
                <span style={{ fontWeight: 600 }}>{formatINR(item.lineTotal)}</span>
              </div>
            ))}

            <div className="flex-between mt-2" style={{ fontWeight: 800 }}>
              <span>Total</span>
              <span className="text-primary">{formatINR(selectedOrder.total)}</span>
            </div>

            <div className="divider" />
            <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
              <strong>Status history</strong>
              {selectedOrder.statusHistory?.map((h, i) => (
                <div key={i} style={{ marginTop: '.4rem' }}>
                  {h.toStatus?.replace('_', ' ')} — {formatDate(h.changedAt)}
                </div>
              ))}
            </div>

            {/* #9 AI Automated Customer Notification / Email Drafter */}
            <div className="divider" />
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--primary)]">
                  AI Customer Message
                </span>
                <button
                  type="button"
                  disabled={notifBusy}
                  onClick={async () => {
                    setNotifBusy(true); setNotifStatus('')
                    try {
                      const { data } = await api.post('/admin/ai/draft-notification', {
                        orderId: selectedOrder.id,
                        scenario: notifScenario,
                      })
                      setNotifTitle(data.title || '')
                      setNotifBody(data.message || '')
                    } catch {
                      setNotifStatus('Could not draft message')
                    } finally {
                      setNotifBusy(false)
                    }
                  }}
                  className="ts-btn-secondary !min-h-[30px] !px-2.5 text-xs"
                >
                  {notifBusy ? 'Drafting...' : 'Draft with AI'}
                </button>
              </div>

              <select
                className="select !min-h-[36px] text-xs"
                value={notifScenario}
                onChange={(e) => setNotifScenario(e.target.value)}
              >
                <option value="ORDER_UPDATE">Order Status Update</option>
                <option value="DELAY_APOLOGY">Shipping Delay Apology</option>
                <option value="DELIVERY_FOLLOWUP">Post-Delivery Follow-up</option>
                <option value="VIP_THANK_YOU">VIP Thank-You + Coupon</option>
              </select>

              <input
                className="input !min-h-[36px] text-xs"
                placeholder="Notification title..."
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
              />
              <textarea
                className="input text-xs"
                rows={3}
                placeholder="Click 'Draft with AI' or type a message..."
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifSendEmail}
                  onChange={(e) => setNotifSendEmail(e.target.checked)}
                  className="accent-[var(--primary)]"
                />
                Also send email to customer
              </label>
              <button
                type="button"
                disabled={notifBusy || !notifTitle.trim() || !notifBody.trim()}
                onClick={async () => {
                  setNotifBusy(true); setNotifStatus('')
                  try {
                    const { data } = await api.post('/admin/ai/send-notification', {
                      orderId: selectedOrder.id,
                      title: notifTitle,
                      message: notifBody,
                      sendEmail: notifSendEmail,
                    })
                    setNotifStatus(data.emailSent ? 'Sent in-app + email!' : 'Sent in-app notification!')
                    setNotifTitle(''); setNotifBody('')
                  } catch {
                    setNotifStatus('Failed to send notification')
                  } finally {
                    setNotifBusy(false)
                  }
                }}
                className="ts-btn-primary w-full !min-h-[36px] text-xs"
              >
                Send Notification
              </button>
              {notifStatus && (
                <div className="text-xs font-medium text-[var(--primary)]">{notifStatus}</div>
              )}
            </div>

            {/* Delete from detail panel */}
            <div style={{ marginTop: '1rem' }}>
              <button
                className="btn btn-danger btn-sm"
                style={{ width: '100%' }}
                disabled={deletingId === selectedOrder.id}
                onClick={() => handleDelete(selectedOrder)}
              >
                {deletingId === selectedOrder.id ? 'Deleting...' : '🗑 Delete This Order'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ship Order Modal for setting custom delivery date */}
      {shippingModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="card" style={{ width: '420px', maxWidth: '90%' }}>
            <h3 style={{ marginBottom: '.5rem' }}>Ship Order {shippingModal.order?.orderNumber}</h3>
            <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Confirm shipment and verify/adjust the promised delivery date.
            </p>

            <div className="form-group mb-2">
              <label>Expected Delivery Date</label>
              <input
                type="date"
                className="input"
                value={shippingModal.estimatedDeliveryDate}
                onChange={e => setShippingModal({ ...shippingModal, estimatedDeliveryDate: e.target.value })}
                required
              />
            </div>

            <div className="form-group mb-2">
              <label>Courier / Tracking Note</label>
              <input
                type="text"
                className="input"
                value={shippingModal.note}
                onChange={e => setShippingModal({ ...shippingModal, note: e.target.value })}
                placeholder="e.g. Dispatched via BlueDart AWB#123456"
              />
            </div>

            <div className="flex-between mt-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShippingModal({ open: false, order: null, estimatedDeliveryDate: '', note: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={updatingStatus}
                onClick={async () => {
                  setUpdatingStatus(true)
                  try {
                    await api.patch(`/admin/orders/${shippingModal.order.id}/status`, {
                      status: 'SHIPPED',
                      note: shippingModal.note || 'Dispatched via Courier',
                      estimatedDeliveryDate: shippingModal.estimatedDeliveryDate || undefined
                    })
                    setShippingModal({ open: false, order: null, estimatedDeliveryDate: '', note: '' })
                    fetchOrders()
                    if (selectedOrder?.id === shippingModal.order.id) {
                      const { data } = await api.get(`/admin/orders/${shippingModal.order.id}`)
                      setSelectedOrder(data)
                    }
                  } catch (err) {
                    alert(err.response?.data?.message || 'Failed to update order status')
                  } finally {
                    setUpdatingStatus(false)
                  }
                }}
              >
                {updatingStatus ? 'Updating...' : 'Confirm Shipment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
