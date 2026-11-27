import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, ShoppingCart, Heart, Zap, Minus, Plus, Check, Star,
  Truck, RotateCcw, ShieldCheck, Sparkles, ChevronDown, PenLine, Package
} from 'lucide-react'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { useToast, notifyCartUpdated } from '../context/ToastContext'
import { StarDisplay, StarPicker } from '../components/StarRating'
import { PageTransition, ProductImage, ThemedSelect, formatINR } from '../components/ui/GlassUI'

function formatDate(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
  })
}

function RatingBar({ star, count, total }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className="w-7 text-right font-mono text-[var(--text-muted)] shrink-0">{star}★</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-7 font-mono text-[var(--text-muted)] shrink-0 tabular">{count}</span>
    </div>
  )
}

function ReviewCard({ review }) {
  const initial = (review.customerName || 'C').trim().charAt(0).toUpperCase()
  return (
    <div className="py-5 first:pt-2 last:pb-1 border-b last:border-b-0 border-[var(--border)]">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-mono text-xs font-semibold text-[var(--text)] shrink-0">
            {initial}
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">{review.customerName}</div>
            <StarDisplay rating={review.rating} showCount={false} size="0.88rem" />
          </div>
        </div>
        <span className="font-mono text-[11px] text-[var(--text-muted)]">{formatDate(review.createdAt)}</span>
      </div>
      {review.title && (
        <div className="text-sm font-semibold text-[var(--text)] mt-3">{review.title}</div>
      )}
      {review.body && (
        <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">{review.body}</p>
      )}
    </div>
  )
}

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()

  const [product,    setProduct]    = useState(null)
  const [related,    setRelated]    = useState([])
  const [bundle,     setBundle]     = useState(null)
  const [bundleSelected, setBundleSelected] = useState({})
  const [addingBundle, setAddingBundle] = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [qty,        setQty]        = useState(1)
  const [adding,     setAdding]     = useState(false)
  const [buyingNow,  setBuyingNow]  = useState(false)
  const [addedDone,  setAddedDone]  = useState(false)
  const [wishlisted, setWishlisted] = useState(false)

  // Reviews state
  const [summary,    setSummary]    = useState(null)
  const [reviews,    setReviews]    = useState([])
  const [revPage,    setRevPage]    = useState(0)
  const [revTotal,   setRevTotal]   = useState(0)
  const [revLoading, setRevLoading] = useState(false)

  // Write review state
  const [canReview,     setCanReview]     = useState(false)
  const [eligibleOrds,  setEligibleOrds]  = useState([])
  const [myReview,      setMyReview]      = useState(null)
  const [showForm,      setShowForm]      = useState(false)
  const [formRating,    setFormRating]    = useState(5)
  const [formTitle,     setFormTitle]     = useState('')
  const [formBody,      setFormBody]      = useState('')
  const [formOrderId,   setFormOrderId]   = useState('')
  const [formSubmit,    setFormSubmit]    = useState(false)
  const [formError,     setFormError]     = useState('')
  const [formSuccess,   setFormSuccess]   = useState('')
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiOpen,        setAiOpen]        = useState(false)
  const [aiLoading,     setAiLoading]     = useState(false)
  const aiDropdownRef = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (aiDropdownRef.current && !aiDropdownRef.current.contains(e.target)) setAiOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setAiOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // Load product + related items
  useEffect(() => {
    setLoading(true)
    setError('')
    setQty(1)
    setAddedDone(false)
    api.get(`/products/${id}`)
      .then(({ data }) => {
        setProduct(data)
        const catId = data.category?.id
        api.get('/products', { params: { page: 0, size: 5, ...(catId ? { categoryId: catId } : {}) } })
          .then(({ data: rel }) => {
            const list = (rel.content || []).filter((p) => String(p.id) !== String(id)).slice(0, 4)
            setRelated(list)
          })
          .catch(() => {})
        api.get(`/products/${id}/frequently-bought-together`, { params: { limit: 3 } })
          .then(({ data: fbt }) => {
            setBundle(fbt)
            const initial = { [data.id]: true }
            ;(fbt.products || []).forEach((p) => { initial[p.id] = true })
            setBundleSelected(initial)
          })
          .catch(() => {})
      })
      .catch(() => setError('Product not found'))
      .finally(() => setLoading(false))
  }, [id])

  // Load rating summary + track recently viewed
  useEffect(() => {
    api.get(`/products/${id}/reviews/summary`)
      .then(({ data }) => setSummary(data))
      .catch(() => {})
    try {
      const prev = JSON.parse(localStorage.getItem('recentlyViewed') || '[]')
      const numId = Number(id)
      const next = [numId, ...prev.filter((x) => x !== numId)].slice(0, 8)
      localStorage.setItem('recentlyViewed', JSON.stringify(next))
    } catch {}
  }, [id])

  // Load paginated reviews
  const loadReviews = useCallback((page = 0) => {
    setRevLoading(true)
    api.get(`/products/${id}/reviews?page=${page}&size=5`)
      .then(({ data }) => {
        setReviews((prev) => (page === 0 ? data.content : [...prev, ...data.content]))
        setRevTotal(data.totalElements)
        setRevPage(page)
      })
      .catch(() => {})
      .finally(() => setRevLoading(false))
  }, [id])

  useEffect(() => { loadReviews(0) }, [loadReviews])

  // Load user review eligibility + wishlist status
  useEffect(() => {
    if (!isAuthenticated) { setWishlisted(false); return }
    api.get(`/products/${id}/reviews/can-review`)
      .then(({ data }) => {
        setCanReview(data.canReview)
        const list = data.eligibleOrderIds || []
        setEligibleOrds(list)
        if (list.length > 0) {
          setFormOrderId((prev) => prev || String(list[0]))
        }
      })
      .catch(() => {})
    api.get(`/products/${id}/reviews/mine`)
      .then(({ data }) => {
        if (data) {
          setMyReview(data)
          setFormRating(data.rating || 5)
          setFormTitle(data.title || '')
          setFormBody(data.body || '')
          if (data.orderId) setFormOrderId(String(data.orderId))
        }
      })
      .catch(() => {})
    api.get('/wishlist')
      .then(({ data }) => {
        const found = (data || []).some((w) => String(w.productId ?? w.id) === String(id))
        setWishlisted(found)
      })
      .catch(() => {})
  }, [id, isAuthenticated])

  const handleAddToCart = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    setAdding(true)
    try {
      const { data } = await api.post('/cart/items', { productId: Number(id), quantity: qty })
      notifyCartUpdated(data)
      setAddedDone(true)
      toast(`Added ${qty} × ${product?.name} to cart`, 'success', {
        actionLabel: 'Go to cart',
        actionTo: '/cart',
      })
      setTimeout(() => setAddedDone(false), 2200)
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to add to cart', 'error')
    } finally {
      setAdding(false)
    }
  }

  const handleBuyNow = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    setBuyingNow(true)
    try {
      await api.post('/cart/items', { productId: Number(id), quantity: qty })
      navigate('/checkout')
    } catch (err) {
      toast(err.response?.data?.message || 'Could not proceed to checkout', 'error')
      setBuyingNow(false)
    }
  }

  const handleToggleWishlist = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    try {
      const { data } = await api.post(`/wishlist/${id}`)
      setWishlisted(!!data.wishlisted)
      toast(data.wishlisted ? 'Saved to wishlist' : 'Removed from wishlist', 'info')
    } catch {
      toast('Could not update wishlist', 'error')
    }
  }

  const fetchAiSuggestions = async (ratingOverride) => {
    const ratingToUse = ratingOverride ?? formRating
    setAiLoading(true)
    setAiOpen(true)
    try {
      const { data } = await api.post(`/products/${id}/reviews/ai-suggestions`, {
        rating: ratingToUse,
        productName: product?.name || 'this product',
        draft: formBody || formTitle || '',
      })
      setAiSuggestions(data.suggestions || [])
    } catch {
      setAiSuggestions([])
    } finally {
      setAiLoading(false)
    }
  }

  const handleReviewSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!formRating || formRating < 1 || formRating > 5) {
      setFormError('Please select a star rating between 1 and 5.')
      return
    }
    setFormSubmit(true); setFormError(''); setFormSuccess('')
    try {
      const orderIdToSend = formOrderId ? Number(formOrderId) : (eligibleOrds[0] ?? null)
      const { data: saved } = await api.post(`/products/${id}/reviews`, {
        rating: Number(formRating),
        title: formTitle.trim() || null,
        body: formBody.trim() || null,
        orderId: orderIdToSend,
      })
      setFormSuccess(myReview ? 'Review updated!' : 'Review submitted! Thank you.')
      setShowForm(false)
      setAiOpen(false)
      setMyReview(saved || { rating: formRating, title: formTitle, body: formBody, createdAt: new Date().toISOString() })
      setCanReview(false)
      toast(myReview ? 'Review updated' : 'Review submitted', 'success')
      api.get(`/products/${id}/reviews/summary`).then(({ data }) => setSummary(data)).catch(() => {})
      loadReviews(0)
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit review')
    } finally {
      setFormSubmit(false)
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (error) {
    return (
      <PageTransition className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10">
        <div className="alert alert-error">{error}</div>
        <button onClick={() => navigate('/products')} className="ts-btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back to catalog
        </button>
      </PageTransition>
    )
  }
  if (!product) return null

  const hasDiscount = Number(product.discountPercent) > 0
  const effectivePrice = product.effectivePrice ?? (product.price * (1 - (product.discountPercent || 0) / 100))
  const savings = hasDiscount ? Number(product.price) - Number(effectivePrice) : 0
  const maxQty = Math.max(1, product.stock || 1)

  return (
    <PageTransition className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-5 pb-24 md:py-10">
      {/* Top bar: Back button + Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="ts-btn-secondary !min-h-[36px] !px-3 text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Link to="/" className="hover:text-[var(--text)] transition-colors">Home</Link>
          <span>/</span>
          <Link to="/products" className="hover:text-[var(--text)] transition-colors">Catalog</Link>
          {product.category?.name && (
            <>
              <span>/</span>
              <Link
                to={`/products?category=${encodeURIComponent(product.category.name)}`}
                className="hover:text-[var(--text)] transition-colors"
              >
                {product.category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-[var(--text)] font-medium truncate max-w-[220px]">{product.name}</span>
        </nav>
      </div>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
        {/* Left: Image Frame */}
        <div className="lg:col-span-6 lg:sticky lg:top-24">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-[var(--surface)] border border-[var(--border)]">
            <ProductImage src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" iconSize="w-12 h-12" />

            {hasDiscount && (
              <span className="absolute top-3.5 left-3.5 px-2.5 py-1 rounded-md bg-[var(--primary)] text-white font-mono text-[11px] font-semibold uppercase tracking-wider shadow-sm">
                -{product.discountPercent}% OFF
              </span>
            )}

            <button
              type="button"
              onClick={handleToggleWishlist}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
              className={`absolute top-3.5 right-3.5 w-10 h-10 rounded-xl bg-[var(--bg)] border flex items-center justify-center transition-colors shadow-md ${
                wishlisted
                  ? 'border-red-500 text-red-500'
                  : 'border-[var(--border)] text-[var(--text)] hover:border-red-500 hover:text-red-500'
              }`}
            >
              <Heart className={`w-4 h-4 ${wishlisted ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Right: Product Info & Actions */}
        <div className="lg:col-span-6 ts-card p-5 sm:p-7 space-y-5">
          {/* Category + Stock Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {product.category?.name ? (
              <Link
                to={`/products?category=${encodeURIComponent(product.category.name)}`}
                className="font-mono text-[11px] uppercase tracking-wider text-[var(--primary)] hover:underline"
              >
                {product.category.name}
              </Link>
            ) : (
              <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">General</span>
            )}

            {product.stock <= 0 ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded font-mono text-[11px] font-medium border border-[var(--danger)]/40 text-[var(--danger)] bg-[var(--bg)]">
                Out of stock
              </span>
            ) : product.stock < 5 ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded font-mono text-[11px] font-medium border border-amber-500/40 text-amber-700 dark:text-amber-400 bg-[var(--bg)]">
                Only {product.stock} left
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded font-mono text-[11px] font-medium border border-[var(--success)]/40 text-[var(--success)] bg-[var(--bg)]">
                In stock
              </span>
            )}
          </div>

          {/* Title & Rating */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-[var(--text)] leading-tight">
              {product.name}
            </h1>
            {summary && summary.totalReviews > 0 && (
              <a
                href="#reviews"
                className="inline-flex items-center gap-2 mt-2.5 px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--text)] transition-colors"
              >
                <StarDisplay rating={summary.avgRating} count={summary.totalReviews} size="0.92rem" />
              </a>
            )}
          </div>

          {/* Price Block */}
          <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
            <div className="flex flex-wrap items-baseline gap-2.5 tabular">
              <span className="text-3xl font-semibold tracking-tight text-[var(--text)]">
                {formatINR(effectivePrice)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-sm line-through text-[var(--text-muted)]">
                    {formatINR(product.price)}
                  </span>
                  <span className="font-mono text-xs font-semibold text-[var(--success)]">
                    Save {formatINR(savings)} ({product.discountPercent}% off)
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Inclusive of all taxes · GST invoice available at checkout
            </p>
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-sm sm:text-[15px] text-[var(--text-muted)] leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Quantity Stepper + Primary Action Buttons */}
          {product.stock > 0 ? (
            <div className="space-y-3 pt-1">
              {/* Stepper row */}
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <span className="text-xs font-semibold uppercase tracking-wider font-mono text-[var(--text-muted)]">
                  Quantity
                </span>
                <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 flex items-center justify-center text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-35 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-11 text-center font-mono text-sm font-semibold text-[var(--text)] tabular select-none">
                    {qty}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={qty >= maxQty}
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    className="w-10 h-10 flex items-center justify-center text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-35 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={adding}
                  className="ts-btn-primary w-full"
                >
                  {addedDone ? (
                    <>
                      <Check className="w-4 h-4" /> Added to cart
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" /> {adding ? 'Adding...' : 'Add to cart'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={buyingNow}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-lg bg-[var(--text)] text-[var(--bg)] font-semibold text-sm border border-[var(--text)] hover:opacity-90 active:scale-[0.985] disabled:opacity-45 transition-all cursor-pointer w-full"
                >
                  <Zap className="w-4 h-4" /> {buyingNow ? 'Redirecting...' : 'Buy now'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleToggleWishlist}
                className="ts-btn-secondary w-full"
              >
                <Heart className={`w-4 h-4 ${wishlisted ? 'fill-red-500 text-red-500' : ''}`} />
                {wishlisted ? 'Saved in wishlist' : 'Save to wishlist'}
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-muted)] text-center">
                This item is currently out of stock. Save it to your wishlist to check back later.
              </div>
              <button
                type="button"
                onClick={handleToggleWishlist}
                className="ts-btn-secondary w-full"
              >
                <Heart className={`w-4 h-4 ${wishlisted ? 'fill-red-500 text-red-500' : ''}`} />
                {wishlisted ? 'Saved in wishlist' : 'Save to wishlist'}
              </button>
            </div>
          )}

          {/* Store Assurance Strip */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--border)]">
            <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-center">
              <Truck className="w-4 h-4 mx-auto text-[var(--primary)] mb-1" />
              <div className="text-[11px] font-medium text-[var(--text)]">Fast dispatch</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-center">
              <RotateCcw className="w-4 h-4 mx-auto text-[var(--primary)] mb-1" />
              <div className="text-[11px] font-medium text-[var(--text)]">7-day returns</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-center">
              <ShieldCheck className="w-4 h-4 mx-auto text-[var(--primary)] mb-1" />
              <div className="text-[11px] font-medium text-[var(--text)]">GST invoice</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Frequently Bought Together (#5) ──────────────────────────────────── */}
      {bundle && bundle.products && bundle.products.length > 0 && (
        <section className="mt-10 sm:mt-12 ts-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--primary)]">
                Smart Bundle
              </span>
              <h2 className="text-lg sm:text-xl font-semibold tracking-[-0.02em] text-[var(--text)]">
                Frequently bought together
              </h2>
            </div>
            <button
              type="button"
              disabled={addingBundle}
              onClick={async () => {
                if (!isAuthenticated) { navigate('/login'); return }
                const idsToAdd = [product, ...bundle.products]
                  .filter((p) => bundleSelected[p.id] && p.stock > 0)
                  .map((p) => p.id)
                if (idsToAdd.length === 0) { toast('Select at least one item', 'info'); return }
                setAddingBundle(true)
                try {
                  const responses = await Promise.all(idsToAdd.map((pid) => api.post('/cart/items', { productId: pid, quantity: 1 })))
                  notifyCartUpdated(responses[responses.length - 1]?.data)
                  toast(`Added ${idsToAdd.length} bundle item(s) to cart`, 'success', {
                    actionLabel: 'Go to cart',
                    actionTo: '/cart',
                  })
                } catch (err) {
                  toast(err.response?.data?.message || 'Could not add bundle', 'error')
                } finally {
                  setAddingBundle(false)
                }
              }}
              className="ts-btn-primary !min-h-[40px] text-xs sm:text-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              {addingBundle ? 'Adding bundle...' : `Add selected (${[product, ...bundle.products].filter((p) => bundleSelected[p.id]).length}) to cart`}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[product, ...bundle.products].map((item, idx) => {
              const checked = !!bundleSelected[item.id]
              const eff = item.effectivePrice ?? (item.discountPercent > 0 ? item.price * (1 - item.discountPercent / 100) : item.price)
              return (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    checked ? 'bg-[var(--bg)] border-[var(--primary)]' : 'bg-[var(--surface)] border-[var(--border)] opacity-70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setBundleSelected((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                    className="accent-[var(--primary)] w-4 h-4 shrink-0"
                  />
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-[var(--surface-2)] shrink-0">
                    <ProductImage src={item.imageUrl} alt={item.name} iconSize="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {idx === 0 && (
                      <span className="font-mono text-[10px] uppercase text-[var(--primary)]">This item</span>
                    )}
                    <div className="text-xs font-semibold text-[var(--text)] truncate">{item.name}</div>
                    <div className="font-mono text-xs text-[var(--text-muted)] tabular mt-0.5">{formatINR(eff)}</div>
                  </div>
                </label>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Customer Reviews Section ─────────────────────────────────────────── */}
      <section id="reviews" className="mt-12 sm:mt-16 pt-8 border-t border-[var(--border)]">
        <div className="flex items-center gap-2.5 mb-6">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[var(--text)]">
            Customer Reviews
          </h2>
          {revTotal > 0 && (
            <span className="font-mono text-xs text-[var(--text-muted)]">({revTotal})</span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Rating Summary Card */}
          <div className="lg:col-span-5 ts-card p-5 sm:p-6">
            {summary && summary.totalReviews > 0 ? (
              <div className="flex items-center gap-5 sm:gap-6">
                <div className="text-center shrink-0">
                  <div className="font-mono text-4xl sm:text-5xl font-bold text-[var(--text)] leading-none tabular">
                    {summary.avgRating.toFixed(1)}
                  </div>
                  <div className="mt-2">
                    <StarDisplay rating={summary.avgRating} showCount={false} size="0.95rem" />
                  </div>
                  <div className="font-mono text-[11px] text-[var(--text-muted)] mt-1">
                    {summary.totalReviews} review{summary.totalReviews !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <RatingBar
                      key={star}
                      star={star}
                      count={summary.distribution?.[star] ?? 0}
                      total={summary.totalReviews}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-5 text-[var(--text-muted)]">
                <Star className="w-7 h-7 mx-auto mb-2 text-[var(--text-muted)]" strokeWidth={1.5} />
                <div className="text-sm font-medium text-[var(--text)]">No reviews yet</div>
                <p className="text-xs mt-0.5">Be the first to share your experience.</p>
              </div>
            )}

            {/* Write / Edit Review CTA */}
            <div className="mt-5 pt-4 border-t border-[var(--border)]">
              {isAuthenticated ? (
                myReview ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span>Your rating</span>
                      <StarDisplay rating={myReview.rating} showCount={false} size="0.9rem" />
                    </div>
                    <button
                      type="button"
                      className="ts-btn-secondary w-full !min-h-[40px] text-xs"
                      onClick={() => { setShowForm(true); setFormSuccess('') }}
                    >
                      <PenLine className="w-3.5 h-3.5" /> Edit my review
                    </button>
                  </div>
                ) : canReview ? (
                  <button
                    type="button"
                    className="ts-btn-primary w-full !min-h-[40px] text-sm"
                    onClick={() => { setShowForm(true); setFormSuccess('') }}
                  >
                    <PenLine className="w-4 h-4" /> Write a review
                  </button>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] text-center">
                    Purchase this product to leave a verified review.
                  </p>
                )
              ) : (
                <button
                  type="button"
                  className="ts-btn-secondary w-full !min-h-[40px] text-xs"
                  onClick={() => navigate('/login')}
                >
                  Sign in to write a review
                </button>
              )}
            </div>
          </div>

          {/* Review Form OR Reviews List */}
          <div className="lg:col-span-7 space-y-6">
            {showForm && (
              <form onSubmit={handleReviewSubmit} className="ts-card p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
                  <h3 className="text-base font-semibold text-[var(--text)]">
                    {myReview ? 'Edit your review' : 'Write a review'}
                  </h3>

                  <div className="relative" ref={aiDropdownRef}>
                    <button
                      type="button"
                      onClick={() => (aiOpen ? setAiOpen(false) : fetchAiSuggestions())}
                      className="ts-btn-secondary !min-h-[34px] !px-3 text-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>{aiLoading ? 'Generating...' : 'AI suggestions'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {aiOpen && (
                      <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-3rem)] rounded-xl bg-[var(--bg)] border border-[var(--border)] shadow-xl z-30 overflow-hidden">
                        <div className="px-3.5 py-2.5 border-b border-[var(--border)] flex items-center justify-between text-xs bg-[var(--surface)]">
                          <span className="font-mono uppercase tracking-wider text-[var(--text-muted)]">
                            AI drafts ({formRating}★)
                          </span>
                          <button
                            type="button"
                            onClick={() => fetchAiSuggestions()}
                            className="text-[var(--primary)] font-medium hover:underline"
                          >
                            Refresh
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border)]">
                          {aiLoading ? (
                            <div className="p-4 text-xs text-[var(--text-muted)] text-center">Generating suggestions...</div>
                          ) : aiSuggestions.length === 0 ? (
                            <div className="p-4 text-xs text-[var(--text-muted)] text-center">No suggestions available.</div>
                          ) : (
                            aiSuggestions.map((s, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setFormTitle(s.title)
                                  setFormBody(s.body)
                                  setAiOpen(false)
                                }}
                                className="w-full text-left px-3.5 py-3 hover:bg-[var(--surface)] transition-colors"
                              >
                                <div className="text-xs font-semibold text-[var(--text)]">{s.title}</div>
                                <div className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{s.body}</div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">
                    Rating <span className="text-[var(--danger)]">*</span>
                  </label>
                  <StarPicker
                    value={formRating}
                    onChange={(newRating) => {
                      setFormRating(newRating)
                      if (aiOpen) fetchAiSuggestions(newRating)
                    }}
                  />
                </div>

                {eligibleOrds.length > 1 && (
                  <div>
                    <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Order</label>
                    <ThemedSelect
                      value={formOrderId}
                      onChange={(val) => setFormOrderId(val)}
                      options={eligibleOrds.map((oid) => ({ value: String(oid), label: `Order #${oid}` }))}
                      ariaLabel="Select order for review"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Title (optional)</label>
                  <input
                    className="input"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Great build quality"
                    maxLength={150}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Review (optional)</label>
                  <textarea
                    className="input"
                    rows={4}
                    value={formBody}
                    onChange={(e) => setFormBody(e.target.value)}
                    placeholder="Share your experience, or pick a draft from AI suggestions..."
                    style={{ resize: 'vertical' }}
                    maxLength={2000}
                  />
                </div>

                {formError && <div className="alert alert-error !mb-0">{formError}</div>}
                {formSuccess && <div className="alert alert-success !mb-0">{formSuccess}</div>}

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button type="submit" className="ts-btn-primary flex-1" disabled={formSubmit}>
                    {formSubmit ? 'Submitting...' : myReview ? 'Update review' : 'Submit review'}
                  </button>
                  <button
                    type="button"
                    className="ts-btn-secondary flex-1"
                    onClick={() => { setShowForm(false); setAiOpen(false) }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Reviews List */}
            {reviews.length > 0 ? (
              <div className="ts-card p-5 sm:p-6">
                <h3 className="text-sm font-mono uppercase tracking-wider text-[var(--text-muted)] pb-3 border-b border-[var(--border)]">
                  All Reviews ({revTotal})
                </h3>
                <div>
                  {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
                </div>
                {reviews.length < revTotal && (
                  <button
                    type="button"
                    className="ts-btn-secondary w-full mt-4 !min-h-[40px] text-xs"
                    onClick={() => loadReviews(revPage + 1)}
                    disabled={revLoading}
                  >
                    {revLoading ? 'Loading...' : 'Load more reviews'}
                  </button>
                )}
              </div>
            ) : (
              !revLoading && (
                <div className="ts-card p-8 text-center text-sm text-[var(--text-muted)]">
                  No customer reviews yet for this product.
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Related Products Shelf ───────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="mt-12 sm:mt-16 pt-8 border-t border-[var(--border)]">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg sm:text-xl font-semibold tracking-[-0.02em] text-[var(--text)]">
              More in {product.category?.name || 'Catalog'}
            </h2>
            <Link
              to={product.category?.name ? `/products?category=${encodeURIComponent(product.category.name)}` : '/products'}
              className="ts-link text-xs sm:text-sm"
            >
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {related.map((p) => {
              const disc = Number(p.discountPercent) > 0
              const eff = p.effectivePrice ?? (disc ? p.price * (1 - p.discountPercent / 100) : p.price)
              return (
                <Link key={p.id} to={`/products/${p.id}`} className="ts-card ts-card-link overflow-hidden flex flex-col">
                  <div className="aspect-square bg-[var(--surface-2)] overflow-hidden">
                    <ProductImage src={p.imageUrl} alt={p.name} />
                  </div>
                  <div className="p-3 bg-[var(--bg)] border-t border-[var(--border)] flex-1 flex flex-col justify-between">
                    <h3 className="text-xs sm:text-sm font-semibold text-[var(--text)] line-clamp-2">{p.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1.5 tabular">
                      <span className="text-sm font-semibold text-[var(--text)]">{formatINR(eff)}</span>
                      {disc && (
                        <span className="font-mono text-[10px] text-[var(--primary)]">-{p.discountPercent}%</span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </PageTransition>
  )
}
