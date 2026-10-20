import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axiosInstance'

function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export default function CartPage() {
  const navigate = useNavigate()
  const [cart, setCart]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const fetchCart = () => {
    setLoading(true)
    api.get('/cart')
      .then(({ data }) => setCart(data))
      .catch(() => setError('Failed to load cart'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCart() }, [])

  const updateQty = async (itemId, qty) => {
    if (qty < 1) return
    try {
      await api.put(`/cart/items/${itemId}`, { quantity: qty })
      fetchCart()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update quantity')
    }
  }

  const removeItem = async (itemId) => {
    try {
      await api.delete(`/cart/items/${itemId}`)
      fetchCart()
    } catch {
      alert('Failed to remove item')
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (error)   return <div className="page-container"><div className="alert alert-error">{error}</div></div>

  const isEmpty = !cart?.items || cart.items.length === 0

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🛒 Your Cart</h1>
      </div>

      {isEmpty ? (
        <div className="empty-state">
          <h3>Your cart is empty</h3>
          <p>Browse our products and add items to your cart</p>
          <button className="btn btn-primary mt-2" onClick={() => navigate('/products')}>
            Shop Now
          </button>
        </div>
      ) : (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Cart items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {cart.items.map(item => (
              <div key={item.id} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{item.productName}</div>
                  <div style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    {formatINR(item.unitPrice)} each
                  </div>
                  {item.stockWarning && (
                    <div style={{ color: 'var(--warning)', fontSize: '.8rem', marginTop: '.25rem' }}>
                      ⚠️ Only {item.availableStock} available
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => updateQty(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >−</button>
                  <span style={{ minWidth: '2rem', textAlign: 'center', fontWeight: 700 }}>
                    {item.quantity}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => updateQty(item.id, item.quantity + 1)}
                  >+</button>
                </div>
                <div style={{ fontWeight: 700, minWidth: '80px', textAlign: 'right' }}>
                  {formatINR(item.lineTotal)}
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => removeItem(item.id)}
                >✕</button>
              </div>
            ))}
          </div>

          {/* Order summary */}
          <div className="card" style={{ position: 'sticky', top: '80px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Order Summary</h3>
            <div className="flex-between mb-2">
              <span className="text-muted">Subtotal</span>
              <span>{formatINR(cart.subtotal)}</span>
            </div>
            {cart.discountTotal > 0 && (
              <div className="flex-between mb-2">
                <span className="text-muted">Discount</span>
                <span className="text-success">- {formatINR(cart.discountTotal)}</span>
              </div>
            )}
            <div className="divider" />
            <div className="flex-between" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
              <span>Total</span>
              <span className="text-primary">{formatINR(cart.total)}</span>
            </div>
            <button
              id="checkout-btn"
              className="btn btn-primary w-full mt-2"
              onClick={() => navigate('/checkout')}
            >
              Proceed to Checkout →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
