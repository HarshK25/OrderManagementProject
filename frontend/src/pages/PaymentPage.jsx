import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api/axiosInstance'

function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

/**
 * Loads the Razorpay Checkout script dynamically.
 * Returns a Promise that resolves when the script is ready.
 */
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
  const location   = useLocation()
  const navigate   = useNavigate()
  const { orderId, orderNumber, total } = location.state || {}

  const [status, setStatus]   = useState('idle') // idle | paying | success | error
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!orderId) navigate('/orders')
  }, [orderId, navigate])

  const handlePayNow = async () => {
    setLoading(true)
    setMessage('')

    // 1. Load Razorpay script
    const scriptLoaded = await loadRazorpayScript()
    if (!scriptLoaded) {
      setMessage('Failed to load payment gateway. Please try again.')
      setLoading(false)
      return
    }

    // 2. Create Razorpay order from backend
    let paymentData
    try {
      const { data } = await api.post(`/payments/create/${orderId}`)
      paymentData = data
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to initiate payment')
      setLoading(false)
      return
    }

    // 3. Open Razorpay Checkout popup
    const options = {
      key:        paymentData.razorpayKeyId,
      amount:     Math.round(paymentData.amount * 100), // paise
      currency:   paymentData.currency || 'INR',
      name:       'OrderMS',
      description: `Payment for ${paymentData.orderNumber}`,
      order_id:   paymentData.razorpayOrderId,
      handler: async function (response) {
        // 4. Verify signature on backend
        try {
          await api.post('/payments/verify', {
            razorpayOrderId:   response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          })
          setStatus('success')
          setMessage(`Payment successful! Your order ${orderNumber} is confirmed.`)
        } catch (verifyErr) {
          setStatus('error')
          setMessage(verifyErr.response?.data?.message || 'Payment verification failed')
        }
      },
      prefill: {},
      theme: { color: '#6366f1' },
      modal: {
        ondismiss: () => {
          setMessage('Payment cancelled. You can pay later from My Orders.')
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
    <div className="page-container">
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h1 style={{ marginBottom: '1rem' }}>Complete Payment</h1>

          <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'var(--surface-2)', borderRadius: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Order Number</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '.75rem' }}>{orderNumber}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Amount to Pay</div>
            <div style={{ fontWeight: 800, fontSize: '2rem', color: 'var(--primary)' }}>
              {formatINR(total)}
            </div>
          </div>

          {message && (
            <div className={`alert ${status === 'success' ? 'alert-success' : 'alert-error'}`}>
              {message}
            </div>
          )}

          {status === 'success' ? (
            <div>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <button id="view-orders-btn" className="btn btn-primary w-full"
                onClick={() => navigate('/orders')}>
                View My Orders
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                id="pay-now-btn"
                className="btn btn-primary w-full"
                onClick={handlePayNow}
                disabled={loading || status === 'paying'}
              >
                {loading ? 'Loading payment gateway...' : '💳 Pay Now with Razorpay'}
              </button>
              <button className="btn btn-secondary w-full" onClick={() => navigate('/orders')}>
                Pay Later (order will expire in 15 min)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
