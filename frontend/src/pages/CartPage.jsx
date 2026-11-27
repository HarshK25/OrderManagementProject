import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight } from 'lucide-react'
import api from '../api/axiosInstance'
import { useToast, notifyCartUpdated } from '../context/ToastContext'
import { EmptyState, SkeletonCard, PageTransition, ProductImage, formatINR } from '../components/ui/GlassUI'

export default function CartPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [cart, setCart] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const fetchCart = () => {
    setLoading(true)
    api.get('/cart')
      .then(({ data }) => setCart(data))
      .catch(() => toast('Could not load cart', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCart() }, [])

  // Backend expects {productId} on PUT /api/cart/items/{productId}
  const updateQty = async (productId, qty) => {
    if (qty < 1) return
    setBusyId(productId)
    try {
      const { data } = await api.put(`/cart/items/${productId}`, { quantity: qty })
      setCart(data)
      notifyCartUpdated(data)
    } catch (err) {
      toast(err.response?.data?.message || 'Could not update quantity', 'error')
    } finally {
      setBusyId(null)
    }
  }

  // Backend expects {productId} on DELETE /api/cart/items/{productId}
  const removeItem = async (productId) => {
    setBusyId(productId)
    try {
      const { data } = await api.delete(`/cart/items/${productId}`)
      setCart(data)
      notifyCartUpdated(data)
      toast('Item removed from cart', 'info')
    } catch (err) {
      toast(err.response?.data?.message || 'Could not remove item', 'error')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1240px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4"><SkeletonCard className="h-24" /><SkeletonCard className="h-24" /></div>
        <SkeletonCard className="h-56" />
      </div>
    )
  }

  const isEmpty = !cart?.items || cart.items.length === 0
  const originalSubtotal = (cart?.items || []).reduce(
    (sum, item) => sum + Number(item.price || item.effectivePrice || 0) * (item.quantity || 1),
    0
  )
  const totalAmount = Number(cart?.totalAmount ?? 0)
  const totalSavings = Math.max(0, originalSubtotal - totalAmount)

  return (
    <PageTransition className="max-w-[1240px] mx-auto px-6 py-10">
      <div className="pb-6 border-b border-[var(--border)] mb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[var(--text)]">Cart</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Review quantities before checkout.</p>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Add items from the catalog to start an order."
          action={<button className="ts-btn-primary" onClick={() => navigate('/products')}>Browse catalog <ArrowRight className="w-4 h-4" /></button>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {cart.items.map((item) => {
              const unitPrice = item.effectivePrice ?? item.price ?? 0
              const lineTotal = item.subtotal ?? (Number(unitPrice) * item.quantity)
              const isBusy = busyId === item.productId
              return (
                <div key={item.cartItemId ?? item.productId} className="py-5 flex flex-wrap items-center justify-between gap-4">
                  <Link to={`/products/${item.productId}`} className="flex items-center gap-4 flex-1 min-w-[220px] group">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-[var(--surface)] border border-[var(--border)] shrink-0">
                      <ProductImage src={item.imageUrl} alt={item.productName} iconSize="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-base text-[var(--text)] group-hover:text-[var(--primary)] group-hover:underline truncate transition-colors">{item.productName}</div>
                      <div className="font-mono text-xs text-[var(--text-muted)] mt-1 tabular flex items-center gap-2">
                        <span>{formatINR(unitPrice)} each</span>
                        {Number(item.discountPercent) > 0 && (
                          <span className="text-[var(--primary)]">(-{item.discountPercent}%)</span>
                        )}
                      </div>
                      {item.availableStock !== undefined && item.quantity > item.availableStock && (
                        <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                          Only {item.availableStock} left in stock
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.quantity - 1)}
                      disabled={isBusy || item.quantity <= 1}
                      aria-label="Decrease quantity"
                      className="w-9 h-9 flex items-center justify-center hover:bg-[var(--surface)] disabled:opacity-40"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center font-mono text-sm font-medium tabular">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.quantity + 1)}
                      disabled={isBusy || (item.availableStock !== undefined && item.quantity >= item.availableStock)}
                      aria-label="Increase quantity"
                      className="w-9 h-9 flex items-center justify-center hover:bg-[var(--surface)] disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="font-semibold text-base tabular min-w-[100px] text-right">{formatINR(lineTotal)}</div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    disabled={isBusy}
                    aria-label="Remove item"
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--surface)] disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="lg:col-span-4 ts-card p-6 lg:sticky lg:top-24 space-y-4">
            <h2 className="text-base font-semibold text-[var(--text)]">Order summary</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Items ({cart.totalItems ?? cart.items.length})</span>
                <span className="text-[var(--text)] tabular">{formatINR(originalSubtotal)}</span>
              </div>
              {totalSavings > 0 && (
                <div className="flex justify-between text-[#0f7d45] dark:text-emerald-400">
                  <span>Product discount</span>
                  <span className="tabular">- {formatINR(totalSavings)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Shipping</span>
                <span className="font-mono text-xs text-[var(--text)]">FREE</span>
              </div>
            </div>
            <div className="border-t border-[var(--border)] pt-4 flex justify-between items-baseline">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-semibold tabular">{formatINR(totalAmount)}</span>
            </div>
            <button id="checkout-btn" className="ts-btn-primary w-full" onClick={() => navigate('/checkout')}>
              Continue to checkout <ArrowRight className="w-4 h-4" />
            </button>
            <p className="font-mono text-[11px] text-[var(--text-muted)]">
              Promo codes (WELCOME10, FLAT200) apply on the next step.
            </p>
          </div>
        </div>
      )}
    </PageTransition>
  )
}
