import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, ShoppingCart, Trash2 } from 'lucide-react'
import api from '../api/axiosInstance'
import { useToast, notifyCartUpdated } from '../context/ToastContext'

export default function WishlistPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = () => {
    api.get('/wishlist')
      .then((r) => setItems(r.data))
      .catch(() => toast('Failed to load wishlist', 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const remove = async (productId) => {
    await api.delete(`/wishlist/${productId}`)
    toast('Removed from wishlist', 'info')
    load()
  }

  const moveToCart = async (productId) => {
    try {
      const { data } = await api.post('/cart/items', { productId, quantity: 1 })
      await api.delete(`/wishlist/${productId}`)
      notifyCartUpdated(data)
      toast('Moved to cart!', 'success', {
        actionLabel: 'Go to cart',
        actionTo: '/cart',
      })
      load()
    } catch (err) {
      toast(err.response?.data?.message || 'Could not add to cart', 'error')
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Heart className="w-6 h-6 text-rose-500" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Wishlist</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <div key={i} className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <Heart className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Your wishlist is empty</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">Save items you love while browsing the store.</p>
          <Link to="/products" className="inline-flex px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500">
            Explore Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {items.map((p) => (
            <div key={p.id} className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
              <Link to={`/products/${p.id}`} className="h-44 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">No image</div>
                )}
              </Link>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <Link to={`/products/${p.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-indigo-500">{p.name}</Link>
                  <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">₹{Number(p.effectivePrice ?? p.price).toLocaleString('en-IN')}</div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => moveToCart(p.id)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
                    <ShoppingCart className="w-3.5 h-3.5" /> Move to Cart
                  </button>
                  <button onClick={() => remove(p.id)} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
