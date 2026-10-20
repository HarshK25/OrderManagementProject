import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axiosInstance'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    shippingName: '', shippingPhone: '', shippingAddress: '',
    shippingCity: '', shippingState: '', shippingPincode: '',
  })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: order } = await api.post('/orders', form)
      // Navigate to payment page with order details
      navigate('/payment', { state: { orderId: order.id, orderNumber: order.orderNumber, total: order.total } })
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Checkout</h1>
        <p>Enter your shipping address to place the order</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit} className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Shipping Details</h3>

          <div className="form-group">
            <label>Full Name</label>
            <input id="shipping-name" name="shippingName" className="input" value={form.shippingName}
              onChange={handleChange} placeholder="John Doe" required />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input id="shipping-phone" name="shippingPhone" className="input" value={form.shippingPhone}
              onChange={handleChange} placeholder="9999999999" required pattern="[0-9]{10}" />
          </div>
          <div className="form-group">
            <label>Address Line</label>
            <input id="shipping-address" name="shippingAddress" className="input" value={form.shippingAddress}
              onChange={handleChange} placeholder="123, Main Street, Apt 4" required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>City</label>
              <input id="shipping-city" name="shippingCity" className="input" value={form.shippingCity}
                onChange={handleChange} placeholder="Mumbai" required />
            </div>
            <div className="form-group">
              <label>State</label>
              <input id="shipping-state" name="shippingState" className="input" value={form.shippingState}
                onChange={handleChange} placeholder="Maharashtra" required />
            </div>
          </div>
          <div className="form-group">
            <label>Pincode</label>
            <input id="shipping-pincode" name="shippingPincode" className="input" value={form.shippingPincode}
              onChange={handleChange} placeholder="400001" required pattern="[0-9]{6}" style={{ maxWidth: '150px' }} />
          </div>

          {/* Flipkart-style Guaranteed Delivery Promise */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem'
          }}>
            <span style={{ fontSize: '1.6rem' }}>🚚</span>
            <div>
              <div style={{ fontWeight: 700, color: '#166534', fontSize: '1rem' }}>
                Guaranteed Delivery by {(() => {
                  const d = new Date()
                  d.setDate(d.getDate() + 4)
                  return d.toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short'
                  })
                })()}
              </div>
              <div style={{ fontSize: '.85rem', color: '#15803d', marginTop: '2px' }}>
                ✓ Free Delivery &nbsp;|&nbsp; ⚡ Dispatched within 24 hours
              </div>
            </div>
          </div>

          <div className="flex-between">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/cart')}>
              ← Back to Cart
            </button>
            <button id="place-order-btn" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Placing Order...' : 'Place Order & Pay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
