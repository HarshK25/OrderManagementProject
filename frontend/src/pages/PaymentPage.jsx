import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import api from '../api/axiosInstance'
import { PageTransition, formatINR } from '../components/ui/GlassUI'

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function PaymentPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { orderId, orderNumber, total } = location.state || {}

  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!orderId) navigate('/orders')
  }, [orderId, navigate])

  const handlePayNow = async () => {
    setLoading(true)
    setMessage('')
    const scriptLoaded = await loadRazorpayScript()
    if (!scriptLoaded) {
      setMessage('Could not load payment gateway. Try again.')
      setLoading(false)
      return
    }

    let paymentData
    try {
      const { data } = await api.post(`/payments/create/${orderId}`)
      paymentData = data
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not start payment')
      setLoading(false)
      return
    }

    const options = {
      key: paymentData.razorpayKeyId,
      amount: Math.round(paymentData.amount * 100),
      currency: paymentData.currency || 'INR',
      name: 'ShopVerse',
      description: `Payment for ${paymentData.orderNumber}`,
      order_id: paymentData.razorpayOrderId,
      handler: async function (response) {
        try {
          await api.post('/payments/verify', {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          })
          setStatus('success')
          setMessage(`Payment verified. Order ${orderNumber} is confirmed.`)
        } catch (verifyErr) {
          setStatus('error')
          setMessage(verifyErr.response?.data?.message || 'Payment verification failed')
        }
      },
      theme: { color: '#1a4be0' },
      modal: {
        ondismiss: () => {
          setMessage('Payment window closed. You have 15 minutes to pay from your Orders page.')
          setLoading(false)
        },
      },
    }

    setLoading(false)
    setStatus('paying')
    const rzp = new window.Razorpay(options)
    rzp.open()
  }

  if (!orderId) return null

  return (
    <PageTransition className="max-w-md mx-auto px-6 py-16">
      <div className="ts-card p-8">
        <div className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">Razorpay checkout</div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text)] mt-1">
          {status === 'success' ? 'Payment verified' : 'Complete payment'}
        </h1>

        <div className="my-6 p-5 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
          <div className="font-mono text-xs text-[var(--text-muted)]">Order reference</div>
          <div className="font-mono font-medium text-sm text-[var(--primary)] mt-0.5 mb-4">{orderNumber}</div>
          <div className="font-mono text-xs text-[var(--text-muted)]">Amount due</div>
          <div className="text-3xl font-semibold tabular mt-1">{formatINR(total)}</div>
        </div>

        {message && (
          <div className={`alert ${status === 'success' ? 'alert-success' : 'alert-error'}`}>{message}</div>
        )}

        {status === 'success' ? (
          <button className="ts-btn-primary w-full" onClick={() => navigate(`/orders/${orderId}`)}>
            Open order tracking <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="space-y-3">
            <button className="ts-btn-primary w-full" onClick={handlePayNow} disabled={loading}>
              {loading ? 'Opening gateway...' : `Pay ${formatINR(total)}`}
            </button>
            <button onClick={() => navigate(`/orders/${orderId}`)} className="ts-btn-secondary w-full text-xs">
              Pay later (15-minute window)
            </button>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
