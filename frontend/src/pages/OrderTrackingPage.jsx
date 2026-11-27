import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Download, CheckCircle2, Package, Truck, Home, Clock, XCircle,
  MapPin, RotateCcw, CreditCard, Copy, Check, AlertTriangle, ShoppingBag, ShieldCheck
} from 'lucide-react'
import api from '../api/axiosInstance'
import { useToast } from '../context/ToastContext'
import {
  PageTransition, StatusBadge, ProductImage, ThemedSelect, formatINR
} from '../components/ui/GlassUI'

function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function formatDateOnly(dt) {
  if (!dt) return '—'
  const dateObj = typeof dt === 'string' && dt.length === 10 ? new Date(dt + 'T00:00:00') : new Date(dt)
  return dateObj.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  })
}

const TRACKING_STEPS = [
  { key: 'PLACED',           label: 'Placed',           icon: ShoppingBag },
  { key: 'CONFIRMED',        label: 'Confirmed',        icon: CheckCircle2 },
  { key: 'PACKED',           label: 'Packed',           icon: Package },
  { key: 'SHIPPED',          label: 'Shipped',          icon: Truck },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Truck },
  { key: 'DELIVERED',        label: 'Delivered',        icon: Home },
]

function getStepIndex(status) {
  switch (status) {
    case 'PENDING_PAYMENT':  return 0
    case 'PAID':
    case 'CONFIRMED':        return 1
    case 'PACKED':           return 2
    case 'SHIPPED':          return 3
    case 'OUT_FOR_DELIVERY': return 4
    case 'DELIVERED':
    case 'RETURN_REQUESTED':
    case 'RETURN_APPROVED':
    case 'RETURN_REJECTED':
    case 'PICKUP_COMPLETED':
    case 'REFUNDED':         return 5
    default:                 return -1
  }
}

const STATUS_LABELS = {
  PENDING_PAYMENT:  'Order Placed (Awaiting Payment)',
  PAID:             'Payment Confirmed',
  CONFIRMED:        'Order Confirmed',
  PACKED:           'Packed at Warehouse',
  SHIPPED:          'Shipped & In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED:        'Delivered',
  CANCELLED:        'Order Cancelled',
  EXPIRED:          'Payment Expired',
  RETURN_REQUESTED: 'Return Requested',
  RETURN_APPROVED:  'Return Approved',
  RETURN_REJECTED:  'Return Rejected',
  PICKUP_COMPLETED: 'Return Pickup Completed',
  REFUNDED:         'Refund Processed',
}

const RETURN_CONDITIONS = [
  { value: 'UNOPENED',   label: 'Unopened / Unused' },
  { value: 'DAMAGED',    label: 'Damaged / Defective' },
  { value: 'WRONG_ITEM', label: 'Wrong Item Received' },
  { value: 'OTHER',      label: 'Other' },
]

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!expiresAt) { setRemaining(null); return }
    const tick = () => {
      const diff = new Date(expiresAt) - new Date()
      setRemaining(diff > 0 ? diff : 0)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  if (remaining === null) return null
  if (remaining <= 0) return 'EXPIRED'
  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default function OrderTrackingPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [copiedTracking, setCopiedTracking] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // Return request modal
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnCondition, setReturnCondition] = useState('UNOPENED')
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [returnError, setReturnError] = useState('')
  const [returnInfo, setReturnInfo] = useState(null)

  const fetchOrder = useCallback(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => setOrder(data))
      .catch(() => setError('Order not found'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchOrder() }, [fetchOrder])

  useEffect(() => {
    const returnStatuses = ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'PICKUP_COMPLETED', 'REFUNDED']
    if (order && returnStatuses.includes(order.status)) {
      api.get(`/orders/${id}/return`)
        .then(({ data }) => setReturnInfo(data))
        .catch(() => {})
    }
  }, [order, id])

  const countdown = useCountdown(order?.status === 'PENDING_PAYMENT' ? order.expiresAt : null)

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order?')) return
    setCancelling(true)
    try {
      await api.patch(`/orders/${id}/cancel`)
      toast('Order cancelled', 'info')
      fetchOrder()
    } catch (err) {
      toast(err.response?.data?.message || 'Cannot cancel this order', 'error')
    } finally {
      setCancelling(false)
    }
  }

  const handlePayNow = () => {
    navigate('/payment', {
      state: { orderId: order.id, orderNumber: order.orderNumber, total: order.total },
    })
  }

  const handleDownloadInvoice = async () => {
    setDownloadingPdf(true)
    try {
      const res = await api.get(`/orders/${id}/invoice`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `ShopVerse-Invoice-${order.orderNumber || id}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast('Could not download invoice', 'error')
    } finally {
      setDownloadingPdf(false)
    }
  }

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
      toast('Return request submitted', 'success')
      fetchOrder()
    } catch (err) {
      setReturnError(err.response?.data?.message || 'Failed to submit return request')
    } finally {
      setReturnSubmitting(false)
    }
  }

  const withinReturnWindow = () => {
    if (!order?.deliveredAt) return false
    const diffDays = (new Date() - new Date(order.deliveredAt)) / (1000 * 60 * 60 * 24)
    return diffDays <= 7
  }

  const copyTracking = () => {
    if (!order?.trackingNumber) return
    navigator.clipboard?.writeText(order.trackingNumber)
    setCopiedTracking(true)
    toast('Tracking number copied', 'info')
    setTimeout(() => setCopiedTracking(false), 2000)
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (error) {
    return (
      <PageTransition className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10">
        <div className="alert alert-error">{error}</div>
        <button onClick={() => navigate('/orders')} className="ts-btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back to orders
        </button>
      </PageTransition>
    )
  }
  if (!order) return null

  const canCancel = ['PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'PACKED'].includes(order.status)
  const canPay = order.status === 'PENDING_PAYMENT' && countdown && countdown !== 'EXPIRED'
  const isShipped = ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status)
  const isDelivered = order.status === 'DELIVERED'
  const isTerminated = order.status === 'CANCELLED' || order.status === 'EXPIRED'
  const returnStatuses = ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'PICKUP_COMPLETED', 'REFUNDED']
  const inReturnFlow = returnStatuses.includes(order.status)
  const canReturn = order.status === 'DELIVERED' && withinReturnWindow()
  const activeStepIdx = getStepIndex(order.status)
  const progressPct = activeStepIdx <= 0 ? 0 : Math.min(100, (activeStepIdx / (TRACKING_STEPS.length - 1)) * 100)

  const headlineText = isDelivered
    ? `Delivered on ${formatDateOnly(order.deliveredAt || order.updatedAt)}`
    : order.status === 'OUT_FOR_DELIVERY'
    ? 'Out for delivery today'
    : isShipped
    ? `Arriving by ${formatDateOnly(order.estimatedDeliveryDate)}`
    : isTerminated
    ? `Order ${order.status === 'CANCELLED' ? 'Cancelled' : 'Expired'}`
    : order.status === 'PENDING_PAYMENT'
    ? 'Awaiting payment confirmation'
    : `Estimated delivery by ${formatDateOnly(order.estimatedDeliveryDate)}`

  const subheadlineText = isDelivered
    ? 'Your package was delivered safely. Thank you for shopping with ShopVerse.'
    : isTerminated
    ? 'This order is no longer active.'
    : order.status === 'PENDING_PAYMENT'
    ? 'Complete payment before the timer expires to confirm and pack your items.'
    : isShipped
    ? `Dispatched on ${formatDate(order.shippedAt || order.updatedAt)}`
    : `Expected dispatch by ${formatDateOnly(order.estimatedShipDate)}`

  return (
    <PageTransition className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-5 pb-24 md:py-10 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => navigate('/orders')} className="ts-btn-secondary !min-h-[38px] !px-3.5 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> My orders
        </button>

        <button
          type="button"
          onClick={handleDownloadInvoice}
          disabled={downloadingPdf}
          className="ts-btn-primary !min-h-[38px] !px-4 text-xs"
        >
          <Download className="w-3.5 h-3.5" />
          {downloadingPdf ? 'Preparing PDF...' : 'Download GST Invoice'}
        </button>
      </div>

      {/* Order Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-[var(--border)]">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--primary)]">
            Order Details &amp; Live Tracking
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-[var(--text)] mt-1 font-mono">
            {order.orderNumber}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Placed on {formatDate(order.createdAt)}
            {order.paymentMethod && <> &middot; Payment: <span className="font-mono text-[var(--text)]">{order.paymentMethod}</span></>}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Pending Payment Countdown Banner */}
      {order.status === 'PENDING_PAYMENT' && countdown && (
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-[var(--text)]">
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
            <span>
              {countdown === 'EXPIRED'
                ? 'Payment window has expired.'
                : <>Complete payment within <strong className="font-mono text-[var(--primary)]">{countdown}</strong> to lock in stock.</>}
            </span>
          </div>
          {canPay && (
            <button id="pay-now-tracking-btn" type="button" onClick={handlePayNow} className="ts-btn-primary !min-h-[40px] text-xs w-full sm:w-auto">
              <CreditCard className="w-4 h-4" /> Pay {formatINR(order.total)} now
            </button>
          )}
        </div>
      )}

      {/* Live Shipment Tracker Hero Card */}
      <section className="ts-card p-5 sm:p-7 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
              isDelivered
                ? 'bg-[var(--bg)] border-[var(--success)]/40 text-[var(--success)]'
                : isTerminated
                ? 'bg-[var(--bg)] border-[var(--danger)]/40 text-[var(--danger)]'
                : 'bg-[var(--bg)] border-[var(--primary)]/40 text-[var(--primary)]'
            }`}>
              {isDelivered ? <CheckCircle2 className="w-5 h-5" /> : isTerminated ? <XCircle className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold tracking-[-0.02em] text-[var(--text)]">
                {headlineText}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">{subheadlineText}</p>
            </div>
          </div>

          {!isTerminated && (order.estimatedShipDate || order.estimatedDeliveryDate) && (
            <div className="grid grid-cols-2 gap-2.5 shrink-0">
              <div className="px-3.5 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Dispatch</div>
                <div className="text-xs sm:text-sm font-semibold text-[var(--text)] mt-0.5">
                  {order.shippedAt ? formatDateOnly(order.shippedAt) : formatDateOnly(order.estimatedShipDate)}
                </div>
              </div>
              <div className="px-3.5 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Delivery</div>
                <div className="text-xs sm:text-sm font-semibold text-[var(--text)] mt-0.5">
                  {order.deliveredAt ? formatDateOnly(order.deliveredAt) : formatDateOnly(order.estimatedDeliveryDate)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Visual 6-Step Progress Bar (for active / delivered orders) */}
        {!isTerminated && activeStepIdx >= 0 && (
          <div className="pt-2">
            {/* Desktop Horizontal Stepper */}
            <div className="hidden md:block relative">
              <div className="absolute top-5 left-6 right-6 h-0.5 bg-[var(--border)]" />
              <div
                className="absolute top-5 left-6 h-0.5 bg-[var(--primary)] transition-all duration-500"
                style={{ width: `calc((100% - 3rem) * ${progressPct / 100})` }}
              />
              <div className="relative grid grid-cols-6 gap-2">
                {TRACKING_STEPS.map((step, idx) => {
                  const Icon = step.icon
                  const done = idx <= activeStepIdx
                  const current = idx === activeStepIdx
                  return (
                    <div key={step.key} className="flex flex-col items-center text-center">
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors ${
                        done
                          ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                          : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)]'
                      } ${current ? 'ring-4 ring-[var(--primary)]/20' : ''}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`mt-2.5 text-xs font-medium ${done ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Mobile Compact Vertical Progress Stepper */}
            <div className="md:hidden space-y-3">
              {TRACKING_STEPS.map((step, idx) => {
                const Icon = step.icon
                const done = idx <= activeStepIdx
                const current = idx === activeStepIdx
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      done
                        ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                        : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)]'
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 flex items-center justify-between border-b border-[var(--border)] pb-2">
                      <span className={`text-xs font-medium ${done ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                        {step.label}
                      </span>
                      {current && (
                        <span className="font-mono text-[10px] uppercase text-[var(--primary)]">Current</span>
                      )}
                      {done && !current && (
                        <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Courier & Tracking Number Pill */}
        {(order.trackingNumber || order.carrier) && (
          <div className="pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {order.carrier && (
                <span className="text-[var(--text-muted)]">
                  Carrier: <strong className="text-[var(--text)]">{order.carrier}</strong>
                </span>
              )}
              {order.trackingNumber && (
                <span className="text-[var(--text-muted)]">
                  Tracking ID: <code className="font-mono font-semibold text-[var(--text)]">{order.trackingNumber}</code>
                </span>
              )}
            </div>
            {order.trackingNumber && (
              <button type="button" onClick={copyTracking} className="ts-btn-secondary !min-h-[32px] !px-2.5 text-xs">
                {copiedTracking ? <><Check className="w-3.5 h-3.5 text-[var(--success)]" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy ID</>}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Main 2-Column Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Items Ordered + Activity Log */}
        <div className="lg:col-span-7 space-y-6">
          {/* Items Ordered */}
          <div className="ts-card p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-semibold text-[var(--text)] border-b border-[var(--border)] pb-3">
              Items ordered ({order.items?.length || 0})
            </h3>
            <div className="divide-y divide-[var(--border)]">
              {order.items?.map((item) => {
                const productLink = item.productId ? `/products/${item.productId}` : null
                const rowContent = (
                  <>
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-[var(--surface-2)] border border-[var(--border)] shrink-0">
                      <ProductImage src={item.imageUrl} alt={item.productName} iconSize="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--primary)] group-hover:underline truncate">
                        {item.productName}
                      </div>
                      <div className="font-mono text-xs text-[var(--text-muted)] mt-0.5 tabular">
                        {formatINR(item.unitPrice)} × {item.quantity}
                      </div>
                    </div>
                  </>
                )
                return (
                  <div key={item.id} className="py-3.5 flex items-center justify-between gap-3">
                    {productLink ? (
                      <Link to={productLink} className="flex items-center gap-3 min-w-0 flex-1 group">
                        {rowContent}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 min-w-0 flex-1">{rowContent}</div>
                    )}
                    <div className="font-semibold text-sm text-[var(--text)] tabular shrink-0">
                      {formatINR(item.lineTotal)}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Price Breakdown */}
            <div className="pt-4 border-t border-[var(--border)] space-y-2 text-sm">
              {order.subtotal != null && (
                <div className="flex justify-between text-[var(--text-muted)]">
                  <span>Subtotal</span>
                  <span className="text-[var(--text)] tabular">{formatINR(order.subtotal)}</span>
                </div>
              )}
              {Number(order.discountTotal || 0) > 0 && (
                <div className="flex justify-between text-[var(--success)]">
                  <span>Product discount</span>
                  <span className="tabular">- {formatINR(order.discountTotal)}</span>
                </div>
              )}
              {Number(order.couponDiscount || 0) > 0 && (
                <div className="flex justify-between text-[var(--success)]">
                  <span>Coupon ({order.couponCode || 'Applied'})</span>
                  <span className="tabular">- {formatINR(order.couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Shipping</span>
                <span className="font-mono text-xs text-[var(--text)]">FREE</span>
              </div>
              <div className="flex justify-between items-baseline pt-3 border-t border-[var(--border)]">
                <span className="font-semibold text-[var(--text)]">Order Total</span>
                <span className="text-xl font-semibold text-[var(--primary)] tabular">{formatINR(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Detailed Activity Timeline */}
          <div className="ts-card p-5 sm:p-6">
            <h3 className="text-base font-semibold text-[var(--text)] border-b border-[var(--border)] pb-3 mb-5">
              Shipment Activity Log
            </h3>
            <div className="relative pl-6 space-y-5 before:content-[''] before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--border)]">
              {order.statusHistory?.map((h, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center ring-4 ring-[var(--surface)]">
                    <Check className="w-3 h-3" />
                  </span>
                  <div className="font-mono text-[11px] text-[var(--text-muted)]">{formatDate(h.changedAt)}</div>
                  <div className="text-sm font-semibold text-[var(--text)] mt-0.5">
                    {STATUS_LABELS[h.toStatus] || h.toStatus?.replace(/_/g, ' ')}
                  </div>
                  {h.note && <p className="text-xs text-[var(--text-muted)] mt-0.5">{h.note}</p>}
                </div>
              ))}

              {!isTerminated && !isShipped && order.estimatedShipDate && (
                <div className="relative opacity-70">
                  <span className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[var(--bg)] border-2 border-[var(--border)] ring-4 ring-[var(--surface)]" />
                  <div className="font-mono text-[11px] text-[var(--text-muted)]">Est. {formatDateOnly(order.estimatedShipDate)}</div>
                  <div className="text-sm font-medium text-[var(--text-muted)] mt-0.5">Expected Warehouse Dispatch</div>
                </div>
              )}

              {!isTerminated && !isDelivered && order.estimatedDeliveryDate && (
                <div className="relative opacity-70">
                  <span className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[var(--bg)] border-2 border-[var(--border)] ring-4 ring-[var(--surface)]" />
                  <div className="font-mono text-[11px] text-[var(--text-muted)]">Est. {formatDateOnly(order.estimatedDeliveryDate)}</div>
                  <div className="text-sm font-medium text-[var(--text-muted)] mt-0.5">Expected Doorstep Delivery</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Shipping Address + Return/Cancel Actions */}
        <div className="lg:col-span-5 space-y-6">
          {/* Shipping Address */}
          <div className="ts-card p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <MapPin className="w-4 h-4 text-[var(--primary)]" />
              <h3 className="text-base font-semibold text-[var(--text)]">Delivery Address</h3>
            </div>
            <div className="text-sm text-[var(--text)] space-y-1 leading-relaxed">
              <div className="font-semibold">{order.shippingName}</div>
              <div className="text-[var(--text-muted)]">{order.shippingAddress}</div>
              <div className="text-[var(--text-muted)]">
                {order.shippingCity}, {order.shippingState} — <span className="font-mono text-[var(--text)]">{order.shippingPincode}</span>
              </div>
              <div className="font-mono text-xs text-[var(--text-muted)] pt-1">Phone: {order.shippingPhone}</div>
            </div>
          </div>

          {/* Assurance Card */}
          <div className="ts-card p-5 space-y-2.5 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-2 text-[var(--text)] font-semibold text-sm">
              <ShieldCheck className="w-4 h-4 text-[var(--primary)]" /> ShopVerse Buyer Protection
            </div>
            <p className="leading-relaxed">
              7-day easy returns on delivered items. Download your verified GST tax invoice anytime from the top right button.
            </p>
          </div>

          {/* Cancel Order */}
          {canCancel && (
            <div className="ts-card p-5 sm:p-6 space-y-3">
              <h3 className="text-base font-semibold text-[var(--text)]">Order Actions</h3>
              <button
                id="cancel-order-btn"
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="btn btn-danger w-full !min-h-[42px]"
              >
                <XCircle className="w-4 h-4" />
                {cancelling ? 'Cancelling...' : 'Cancel order'}
              </button>
              <p className="text-xs text-[var(--text-muted)] text-center">
                Orders can be cancelled before shipment dispatch.
              </p>
            </div>
          )}

          {/* Request Return */}
          {canReturn && (
            <div className="ts-card p-5 sm:p-6 space-y-3">
              <h3 className="text-base font-semibold text-[var(--text)]">Return &amp; Refund</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Not satisfied with your item? Request a hassle-free return within 7 days of delivery.
              </p>
              <button
                type="button"
                onClick={() => { setShowReturnModal(true); setReturnError('') }}
                className="ts-btn-secondary w-full"
              >
                <RotateCcw className="w-4 h-4" /> Request return
              </button>
            </div>
          )}

          {/* Return Workflow Status */}
          {inReturnFlow && returnInfo && (
            <div className="ts-card p-5 sm:p-6 space-y-3 border-[var(--primary)]/50">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text)]">
                  <RotateCcw className="w-4 h-4 text-[var(--primary)]" /> Return Status
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="space-y-2 text-xs sm:text-sm">
                <div>
                  <span className="text-[var(--text-muted)]">Reason: </span>
                  <span className="text-[var(--text)]">{returnInfo.reason}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Condition: </span>
                  <span className="font-mono text-xs text-[var(--text)]">{returnInfo.itemCondition?.replace(/_/g, ' ')}</span>
                </div>
                {returnInfo.adminNote && (
                  <div>
                    <span className="text-[var(--text-muted)]">Note: </span>
                    <span className="text-[var(--text)]">{returnInfo.adminNote}</span>
                  </div>
                )}
                {returnInfo.razorpayRefundId && (
                  <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--success)]/40 mt-2 space-y-1">
                    <div className="text-xs font-semibold text-[var(--success)]">Refund Initiated</div>
                    <div className="font-mono text-[11px] text-[var(--text)]">ID: {returnInfo.razorpayRefundId}</div>
                    {returnInfo.refundAmount && (
                      <div className="text-xs text-[var(--text)] font-semibold tabular">
                        Amount: {formatINR(returnInfo.refundAmount)}
                      </div>
                    )}
                    <div className="text-[11px] text-[var(--text-muted)]">Reflects in 5–7 business days.</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Themed Return Request Modal */}
      {showReturnModal && (
        <div
          onClick={() => setShowReturnModal(false)}
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2 font-semibold text-base text-[var(--text)]">
                <RotateCcw className="w-4 h-4 text-[var(--primary)]" /> Request Return
              </div>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--text)]"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs space-y-1">
              <div><span className="text-[var(--text-muted)]">Order:</span> <strong className="font-mono text-[var(--text)]">{order.orderNumber}</strong></div>
              <div>
                <span className="text-[var(--text-muted)]">Return window closes: </span>
                <strong className="text-[var(--text)]">
                  {order.deliveredAt
                    ? formatDateOnly(new Date(new Date(order.deliveredAt).getTime() + 7 * 24 * 60 * 60 * 1000))
                    : '7 days from delivery'}
                </strong>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">
                Reason for return <span className="text-[var(--danger)]">*</span>
              </label>
              <textarea
                className="input"
                rows={4}
                maxLength={1000}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Describe why you want to return this order (min 10 characters)..."
              />
              <div className="font-mono text-[11px] text-[var(--text-muted)] mt-1">
                {returnReason.length} / 1000
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Item condition</label>
              <ThemedSelect
                value={returnCondition}
                onChange={(val) => setReturnCondition(val)}
                options={RETURN_CONDITIONS}
                ariaLabel="Select item condition"
              />
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface)] border border-amber-500/40 flex items-start gap-2.5 text-xs text-[var(--text-muted)]">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>Once approved, we&apos;ll arrange a doorstep pickup and process your refund upon pickup completion.</span>
            </div>

            {returnError && <div className="alert alert-error !mb-0">{returnError}</div>}

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
              <button type="button" onClick={() => setShowReturnModal(false)} className="ts-btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReturnSubmit}
                disabled={returnSubmitting || returnReason.trim().length < 10}
                className="ts-btn-primary flex-1"
              >
                {returnSubmitting ? 'Submitting...' : 'Submit return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  )
}
