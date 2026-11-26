import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { StarDisplay, StarPicker } from '../components/StarRating'

function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

function formatDate(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric'
  })
}

// ── Rating Bar (distribution row) ────────────────────────────────────────────
function RatingBar({ star, count, total }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.82rem' }}>
      <span style={{ width: 32, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
        {star}★
      </span>
      <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#f59e0b', borderRadius: 4 }} />
      </div>
      <span style={{ width: 28, color: 'var(--text-muted)', flexShrink: 0 }}>{count}</span>
    </div>
  )
}

// ── Review Card ───────────────────────────────────────────────────────────────
function ReviewCard({ review }) {
  return (
    <div style={{ padding: '1rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.5rem' }}>
        <div>
          <div style={{ fontWeight: 700 }}>{review.customerName}</div>
          <StarDisplay rating={review.rating} showCount={false} size=".9rem" />
        </div>
        <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{formatDate(review.createdAt)}</div>
      </div>
      {review.title && <div style={{ fontWeight: 600, marginTop: '.5rem' }}>{review.title}</div>}
      {review.body  && <div style={{ color: 'var(--text)', marginTop: '.25rem', fontSize: '.9rem' }}>{review.body}</div>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [product,  setProduct]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [qty,      setQty]      = useState(1)
  const [addMsg,   setAddMsg]   = useState('')
  const [adding,   setAdding]   = useState(false)

  // Reviews state
  const [summary,  setSummary]  = useState(null)
  const [reviews,  setReviews]  = useState([])
  const [revPage,  setRevPage]  = useState(0)
  const [revTotal, setRevTotal] = useState(0)
  const [revLoading, setRevLoading] = useState(false)

  // Write review state
  const [canReview,    setCanReview]    = useState(false)
  const [eligibleOrds, setEligibleOrds] = useState([])
  const [myReview,     setMyReview]     = useState(null)
  const [showForm,     setShowForm]     = useState(false)
  const [formRating,   setFormRating]   = useState(5)
  const [formTitle,    setFormTitle]    = useState('')
  const [formBody,     setFormBody]     = useState('')
  const [formOrderId,  setFormOrderId]  = useState('')
  const [formSubmit,   setFormSubmit]   = useState(false)
  const [formError,    setFormError]    = useState('')
  const [formSuccess,  setFormSuccess]  = useState('')

  // Load product
  useEffect(() => {
    setLoading(true)
    api.get(`/products/${id}`)
      .then(({ data }) => setProduct(data))
      .catch(() => setError('Product not found'))
      .finally(() => setLoading(false))
  }, [id])

  // Load rating summary
  useEffect(() => {
    api.get(`/products/${id}/reviews/summary`)
      .then(({ data }) => setSummary(data))
      .catch(() => {})
  }, [id])

  // Load reviews (paginated)
  const loadReviews = useCallback((page = 0) => {
    setRevLoading(true)
    api.get(`/products/${id}/reviews?page=${page}&size=5`)
      .then(({ data }) => {
        setReviews(prev => page === 0 ? data.content : [...prev, ...data.content])
        setRevTotal(data.totalElements)
        setRevPage(page)
      })
      .catch(() => {})
      .finally(() => setRevLoading(false))
  }, [id])

  useEffect(() => { loadReviews(0) }, [loadReviews])

  // Load user review eligibility (authenticated only)
  useEffect(() => {
    if (!isAuthenticated) return
    api.get(`/products/${id}/reviews/can-review`)
      .then(({ data }) => {
        setCanReview(data.canReview)
        setEligibleOrds(data.eligibleOrderIds || [])
      })
      .catch(() => {})
    api.get(`/products/${id}/reviews/mine`)
      .then(({ data }) => {
        if (data) {
          setMyReview(data)
          setFormRating(data.rating)
          setFormTitle(data.title || '')
          setFormBody(data.body || '')
          if (data.orderId) setFormOrderId(String(data.orderId))
        }
      })
      .catch(() => {})
  }, [id, isAuthenticated])

  // ── Add to cart ─────────────────────────────────────────────────────────────
  const handleAddToCart = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    setAdding(true); setAddMsg('')
    try {
      await api.post('/cart/items', { productId: Number(id), quantity: qty })
      setAddMsg('Added to cart!')
      setTimeout(() => setAddMsg(''), 3000)
    } catch (err) {
      setAddMsg(err.response?.data?.message || 'Failed to add to cart')
    } finally { setAdding(false) }
  }

  // ── Submit review ───────────────────────────────────────────────────────────
  const handleReviewSubmit = async () => {
    if (!formOrderId && eligibleOrds.length > 0) { setFormError('Please select an order'); return }
    if (!formOrderId && !myReview) { setFormError('No eligible order found'); return }
    setFormSubmit(true); setFormError(''); setFormSuccess('')
    try {
      await api.post(`/products/${id}/reviews`, {
        rating: formRating,
        title: formTitle || null,
        body: formBody || null,
        orderId: Number(formOrderId),
      })
      setFormSuccess(myReview ? 'Review updated!' : 'Review submitted! Thank you.')
      setShowForm(false)
      setMyReview({ rating: formRating, title: formTitle, body: formBody, createdAt: new Date().toISOString() })
      setCanReview(false)
      // Refresh summary and reviews
      api.get(`/products/${id}/reviews/summary`).then(({ data }) => setSummary(data)).catch(() => {})
      loadReviews(0)
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit review')
    } finally { setFormSubmit(false) }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (error)   return <div className="page-container"><div className="alert alert-error">{error}</div></div>
  if (!product) return null

  const hasDiscount = product.discountPercent > 0

  return (
    <div className="page-container">
      <button className="btn btn-secondary btn-sm mb-2" onClick={() => navigate(-1)}>← Back</button>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Image */}
        <div>
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name} style={{ borderRadius: '12px', width: '100%', maxHeight: '400px', objectFit: 'cover' }} />
            : <div style={{ background: 'var(--surface-2)', borderRadius: '12px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No Image</div>
          }
        </div>

        {/* Details */}
        <div className="card">
          {product.category?.name && (
            <span style={{ fontSize: '.8rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {product.category.name}
            </span>
          )}
          <h1 style={{ margin: '.5rem 0 .5rem' }}>{product.name}</h1>

          {/* Rating summary under title */}
          {summary && summary.totalReviews > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <StarDisplay rating={summary.avgRating} count={summary.totalReviews} size="1.1rem" />
            </div>
          )}

          <p style={{ marginBottom: '1.5rem', color: 'var(--text)' }}>{product.description}</p>

          <div style={{ marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
              {formatINR(product.effectivePrice ?? (product.price * (1 - (product.discountPercent || 0) / 100)))}
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
              ? <span style={{ color: 'var(--success)' }}>✔ {product.stock} in stock</span>
              : <span style={{ color: 'var(--danger)' }}>✗ Out of stock</span>
            }
          </div>

          {product.stock > 0 && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
              <label style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Qty:</label>
              <input
                type="number" min={1} max={product.stock} value={qty}
                onChange={e => setQty(Math.max(1, Math.min(product.stock, Number(e.target.value))))}
                className="input" style={{ width: '80px' }}
              />
              <button className="btn btn-primary" onClick={handleAddToCart} disabled={adding}>
                {adding ? 'Adding...' : '🛒 Add to Cart'}
              </button>
            </div>
          )}

          {addMsg && (
            <div className={`alert ${addMsg.includes('!') ? 'alert-success' : 'alert-error'}`}>{addMsg}</div>
          )}
        </div>
      </div>

      {/* ── Reviews Section ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: '2.5rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>⭐ Customer Reviews</h2>

        <div className="grid-2" style={{ alignItems: 'start', gap: '2rem', marginBottom: '2rem' }}>

          {/* Rating Summary */}
          <div className="card">
            {summary && summary.totalReviews > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.25rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>
                      {summary.avgRating.toFixed(1)}
                    </div>
                    <StarDisplay rating={summary.avgRating} showCount={false} size="1rem" />
                    <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>
                      {summary.totalReviews} review{summary.totalReviews !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                    {[5, 4, 3, 2, 1].map(star => (
                      <RatingBar
                        key={star}
                        star={star}
                        count={summary.distribution?.[star] ?? 0}
                        total={summary.totalReviews}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>⭐</div>
                <div>No reviews yet — be the first!</div>
              </div>
            )}

            {/* Write Review CTA */}
            {isAuthenticated ? (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                {myReview ? (
                  <>
                    <div style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: '.5rem' }}>
                      Your review: <StarDisplay rating={myReview.rating} showCount={false} size=".9rem" />
                    </div>
                    <button className="btn btn-secondary w-full btn-sm"
                      onClick={() => { setShowForm(true); setFormSuccess('') }}>
                      ✏️ Edit My Review
                    </button>
                  </>
                ) : canReview ? (
                  <button className="btn btn-primary w-full"
                    onClick={() => { setShowForm(true); setFormSuccess('') }}>
                    ✍️ Write a Review
                  </button>
                ) : (
                  <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Purchase this product to leave a review
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', textAlign: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/login')}>
                  Login to write a review
                </button>
              </div>
            )}
          </div>

          {/* Review Form */}
          {showForm && (
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>{myReview ? 'Edit Your Review' : 'Write a Review'}</h3>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '.4rem' }}>
                  Rating <span style={{ color: 'red' }}>*</span>
                </label>
                <StarPicker value={formRating} onChange={setFormRating} />
              </div>

              {eligibleOrds.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '.4rem' }}>
                    Order <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select className="form-input" value={formOrderId}
                    onChange={e => setFormOrderId(e.target.value)} style={{ width: '100%' }}>
                    <option value="">— Select order —</option>
                    {eligibleOrds.map(oid => (
                      <option key={oid} value={oid}>Order #{oid}</option>
                    ))}
                  </select>
                </div>
              )}

              {!formOrderId && myReview && (
                <input type="hidden" value={formOrderId} />
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '.4rem' }}>Title (optional)</label>
                <input className="form-input" value={formTitle} onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Great product!" style={{ width: '100%' }} maxLength={150} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '.4rem' }}>Review (optional)</label>
                <textarea className="form-input" rows={4} value={formBody}
                  onChange={e => setFormBody(e.target.value)}
                  placeholder="Share your experience with this product..."
                  style={{ width: '100%', resize: 'vertical' }} maxLength={2000} />
              </div>

              {formError   && <div className="alert alert-error mb-1">{formError}</div>}
              {formSuccess  && <div className="alert alert-success mb-1">{formSuccess}</div>}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-primary w-full" onClick={handleReviewSubmit}
                  disabled={formSubmit || (!formOrderId && eligibleOrds.length > 0 && !myReview)}>
                  {formSubmit ? 'Submitting...' : myReview ? 'Update Review' : 'Submit Review'}
                </button>
                <button className="btn btn-secondary w-full" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Reviews List */}
        {reviews.length > 0 ? (
          <div className="card">
            <h3 style={{ marginBottom: '.5rem' }}>All Reviews ({revTotal})</h3>
            {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
            {reviews.length < revTotal && (
              <button className="btn btn-secondary w-full mt-2" onClick={() => loadReviews(revPage + 1)} disabled={revLoading}>
                {revLoading ? 'Loading...' : 'Load More Reviews'}
              </button>
            )}
          </div>
        ) : (
          !revLoading && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
              No reviews yet for this product.
            </div>
          )
        )}
      </div>
    </div>
  )
}
