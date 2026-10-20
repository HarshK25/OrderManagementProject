import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'

function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qty, setQty] = useState(1)
  const [addMsg, setAddMsg] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/products/${id}`)
      .then(({ data }) => setProduct(data))
      .catch(() => setError('Product not found'))
      .finally(() => setLoading(false))
  }, [id])

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    setAdding(true)
    setAddMsg('')
    try {
      await api.post('/cart/items', { productId: Number(id), quantity: qty })
      setAddMsg('Added to cart!')
      setTimeout(() => setAddMsg(''), 3000)
    } catch (err) {
      setAddMsg(err.response?.data?.message || 'Failed to add to cart')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (error)   return <div className="page-container"><div className="alert alert-error">{error}</div></div>
  if (!product) return null

  const hasDiscount = product.discountPercent > 0
  const effectivePrice = hasDiscount
    ? product.price * (1 - product.discountPercent / 100)
    : product.price

  return (
    <div className="page-container">
      <button className="btn btn-secondary btn-sm mb-2" onClick={() => navigate(-1)}>← Back</button>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Image */}
        <div>
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name} style={{ borderRadius: '12px', width: '100%', maxHeight: '400px', objectFit: 'cover' }} />
            : <div style={{ background: 'var(--surface-2)', borderRadius: '12px', height: '300px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>No Image</div>
          }
        </div>

        {/* Details */}
        <div className="card">
          {product.categoryName && (
            <span style={{ fontSize: '.8rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {product.categoryName}
            </span>
          )}
          <h1 style={{ margin: '.5rem 0 1rem' }}>{product.name}</h1>

          <p style={{ marginBottom: '1.5rem', color: 'var(--text)' }}>{product.description}</p>

          <div style={{ marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
              {formatINR(effectivePrice)}
            </span>
            {hasDiscount && (
              <span style={{ marginLeft: '.75rem', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                {formatINR(product.price)}
              </span>
            )}
            {hasDiscount && (
              <span style={{ marginLeft: '.5rem', color: 'var(--success)', fontWeight: 600 }}>
                {product.discountPercent}% off
              </span>
            )}
          </div>

          <div style={{ marginBottom: '1.5rem', fontSize: '.9rem' }}>
            {product.stock > 0
              ? <span style={{ color: 'var(--success)' }}>✓ {product.stock} in stock</span>
              : <span style={{ color: 'var(--danger)' }}>✗ Out of stock</span>
            }
          </div>

          {product.stock > 0 && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
              <label style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Qty:</label>
              <input
                id="qty"
                type="number"
                min={1}
                max={product.stock}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(product.stock, Number(e.target.value))))}
                className="input"
                style={{ width: '80px' }}
              />
              <button
                id="add-to-cart-btn"
                className="btn btn-primary"
                onClick={handleAddToCart}
                disabled={adding || product.stock === 0}
              >
                {adding ? 'Adding...' : '🛒 Add to Cart'}
              </button>
            </div>
          )}

          {addMsg && (
            <div className={`alert ${addMsg.includes('!') ? 'alert-success' : 'alert-error'}`}>
              {addMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
