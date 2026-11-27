import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Search, SlidersHorizontal, LayoutGrid, List, Heart, ShoppingCart, Eye, X, Package, ChevronLeft, ChevronRight, ChevronDown,
  Sparkles, Scale, Check
} from 'lucide-react'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { useToast, notifyCartUpdated } from '../context/ToastContext'
import { StarDisplay } from '../components/StarRating'
import { ProductImage, SkeletonCard, EmptyState, PageTransition, ThemedSelect, formatINR } from '../components/ui/GlassUI'

const SORT_OPTIONS = [
  { value: 'createdAt,desc', label: 'Newest' },
  { value: 'price,asc',      label: 'Price: low to high' },
  { value: 'price,desc',     label: 'Price: high to low' },
  { value: 'name,asc',       label: 'Name: A to Z' },
]

const PRICE_PRESETS = [
  { label: 'Any price', min: '', max: '' },
  { label: 'Under ₹1,000', min: '', max: '1000' },
  { label: '₹1,000 – ₹5,000', min: '1000', max: '5000' },
  { label: '₹5,000 – ₹20,000', min: '5000', max: '20000' },
  { label: 'Above ₹20,000', min: '20000', max: '' },
]

export default function ProductListPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [correctedQuery, setCorrectedQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [viewMode, setViewMode] = useState('grid')
  const [quickView, setQuickView] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef(null)

  // #2 AI Smart Search state
  const [aiQuery, setAiQuery] = useState('')
  const [aiSearchLoading, setAiSearchLoading] = useState(false)
  const [aiInterpretation, setAiInterpretation] = useState('')

  // #3 Compare with AI state
  const [compareIds, setCompareIds] = useState([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareData, setCompareData] = useState(null)
  const [wishlistedIds, setWishlistedIds] = useState(() => new Set())

  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    category: searchParams.get('category') || '',
    minPrice: '',
    maxPrice: '',
    sort: 'createdAt,desc',
  })

  useEffect(() => {
    const close = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setFilterOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    const qParam = searchParams.get('q')
    const catParam = searchParams.get('category')
    if (qParam !== null || catParam !== null) {
      setFilters((prev) => ({ ...prev, q: qParam ?? prev.q, category: catParam ?? prev.category }))
      setPage(0)
    }
  }, [searchParams])

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAuthenticated) { setWishlistedIds(new Set()); return }
    api.get('/wishlist')
      .then(({ data }) => {
        setWishlistedIds(new Set((data || []).map((w) => Number(w.productId ?? w.id))))
      })
      .catch(() => {})
  }, [isAuthenticated])

  useEffect(() => {
    if (filters.category && categories.length === 0) return
    setLoading(true)
    const [sortBy, direction] = (filters.sort || 'createdAt,desc').split(',')
    const params = { page, size: 12, sortBy: sortBy || 'createdAt', direction: direction || 'desc' }
    if (filters.q && filters.q.trim()) params.search = filters.q.trim()
    if (filters.category) {
      const matched = categories.find((c) => c.name.toLowerCase() === filters.category.toLowerCase())
      if (matched) params.categoryId = matched.id
    }
    if (filters.minPrice) params.minPrice = filters.minPrice
    if (filters.maxPrice) params.maxPrice = filters.maxPrice

    api.get('/products', { params })
      .then(({ data }) => {
        const loaded = data.content || []
        setProducts(loaded)
        setTotalPages(data.totalPages || 0)
        setCorrectedQuery(data.correctedQuery || '')
        if (loaded.length > 0) {
          const ids = loaded.map((p) => p.id).join(',')
          api.get(`/products/reviews/summaries?ids=${ids}`)
            .then(({ data: ratings }) => {
              setProducts((prev) => prev.map((p) => ({
                ...p,
                avgRating: ratings[p.id]?.avgRating ?? 0,
                reviewCount: ratings[p.id]?.totalReviews ?? 0,
              })))
            })
            .catch(() => {})
        }
      })
      .catch(() => toast('Could not load products', 'error'))
      .finally(() => setLoading(false))
  }, [page, filters, categories])

  const handleAddToCart = async (e, product) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) { navigate('/login'); return }
    try {
      const { data } = await api.post('/cart/items', { productId: product.id, quantity: 1 })
      notifyCartUpdated(data)
      toast(`Added ${product.name} to cart`, 'success', {
        actionLabel: 'Go to cart',
        actionTo: '/cart',
      })
    } catch (err) {
      toast(err.response?.data?.message || 'Could not add item', 'error')
    }
  }

  const handleWishlist = async (e, product) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) { navigate('/login'); return }
    try {
      const { data } = await api.post(`/wishlist/${product.id}`)
      setWishlistedIds((prev) => {
        const next = new Set(prev)
        if (data.wishlisted) next.add(Number(product.id))
        else next.delete(Number(product.id))
        return next
      })
      toast(data.wishlisted ? 'Saved to wishlist' : 'Removed from wishlist', 'info')
    } catch {
      toast('Could not update wishlist', 'error')
    }
  }

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }))
    setPage(0)
  }

  const activeFilterCount =
    (filters.q ? 1 : 0) + (filters.category ? 1 : 0) + (filters.minPrice || filters.maxPrice ? 1 : 0)

  const clearAllFilters = () => {
    setFilters({ q: '', category: '', minPrice: '', maxPrice: '', sort: 'createdAt,desc' })
    setAiQuery('')
    setAiInterpretation('')
    setPage(0)
  }

  // #2 Natural-Language AI Smart Search
  const runAiSmartSearch = async (e) => {
    e.preventDefault()
    const q = aiQuery.trim()
    if (!q) return
    setAiSearchLoading(true)
    try {
      const { data } = await api.get('/products/smart-search', { params: { q } })
      setProducts(data.products || [])
      setTotalPages(1)
      setAiInterpretation(data.explanation || `AI results for "${q}"`)
    } catch {
      toast('AI search failed — showing standard results', 'error')
    } finally {
      setAiSearchLoading(false)
    }
  }

  // #3 Toggle product in Compare list (max 3)
  const toggleCompare = (e, productId) => {
    e.preventDefault()
    e.stopPropagation()
    setCompareIds((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId)
      if (prev.length >= 3) {
        toast('You can compare up to 3 products at once', 'info')
        return prev
      }
      return [...prev, productId]
    })
  }

  const openAiCompare = async () => {
    if (compareIds.length < 2) {
      toast('Select at least 2 products to compare', 'info')
      return
    }
    setCompareOpen(true)
    setCompareLoading(true)
    setCompareData(null)
    try {
      const { data } = await api.get('/products/compare', { params: { ids: compareIds.join(',') } })
      setCompareData(data)
    } catch {
      toast('Could not generate AI comparison', 'error')
      setCompareOpen(false)
    } finally {
      setCompareLoading(false)
    }
  }

  return (
    <PageTransition className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Header + Toolbar (Filter Dropdown, Sort Dropdown, View Toggle) */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-[var(--border)] mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.035em] text-[var(--text)]">Catalog</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {filters.q ? `Results for "${filters.q}"` : 'Browse all products or open Filters to refine.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Themed Filter Dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((o) => !o)}
              className={`h-10 px-3.5 rounded-lg border text-sm font-medium flex items-center gap-2 transition-colors ${
                filterOpen || activeFilterCount > 0
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)]'
                  : 'border-[var(--border)] text-[var(--text)] bg-[var(--bg)] hover:border-[var(--text)]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--primary)] text-white font-mono text-[11px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
            </button>

            {filterOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-md rounded-xl bg-[var(--bg)] border border-[var(--border)] shadow-xl p-5 z-40 space-y-5">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <span className="font-semibold text-sm text-[var(--text)]">All filter options</span>
                  {activeFilterCount > 0 && (
                    <button type="button" onClick={clearAllFilters} className="text-xs font-medium text-[var(--primary)] hover:underline">
                      Clear all
                    </button>
                  )}
                </div>

                {/* Search */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Keyword</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      value={filters.q}
                      onChange={(e) => handleFilterChange('q', e.target.value)}
                      placeholder="Product name, category, keyword..."
                      className="input pl-10"
                    />
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-2">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleFilterChange('category', '')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        !filters.category
                          ? 'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]'
                          : 'border-[var(--border)] text-[var(--text)] bg-[var(--surface)] hover:border-[var(--text)]'
                      }`}
                    >
                      All
                    </button>
                    {categories.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => handleFilterChange('category', c.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          filters.category === c.name
                            ? 'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]'
                            : 'border-[var(--border)] text-[var(--text)] bg-[var(--surface)] hover:border-[var(--text)]'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Presets + Custom Range */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-2">Price range (₹)</label>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {PRICE_PRESETS.map((pr) => {
                      const active = filters.minPrice === pr.min && filters.maxPrice === pr.max
                      return (
                        <button
                          type="button"
                          key={pr.label}
                          onClick={() => {
                            setFilters((prev) => ({ ...prev, minPrice: pr.min, maxPrice: pr.max }))
                            setPage(0)
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            active
                              ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)]'
                              : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text)]'
                          }`}
                        >
                          {pr.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="Min ₹" value={filters.minPrice} onChange={(e) => handleFilterChange('minPrice', e.target.value)} className="input" />
                    <input type="number" placeholder="Max ₹" value={filters.maxPrice} onChange={(e) => handleFilterChange('maxPrice', e.target.value)} className="input" />
                  </div>
                </div>

                <button type="button" onClick={() => setFilterOpen(false)} className="ts-btn-primary w-full !min-h-[40px] text-xs">
                  Show products
                </button>
              </div>
            )}
          </div>

          {/* Themed Sort Dropdown */}
          <ThemedSelect
            value={filters.sort}
            onChange={(val) => handleFilterChange('sort', val)}
            options={SORT_OPTIONS}
            ariaLabel="Sort products"
            className="w-44"
          />

          {/* Grid / List Toggle */}
          <div className="flex border border-[var(--border)] rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')} aria-label="Grid view" className={`w-10 h-10 flex items-center justify-center ${viewMode === 'grid' ? 'bg-[var(--text)] text-[var(--bg)]' : 'text-[var(--text-muted)]'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} aria-label="List view" className={`w-10 h-10 flex items-center justify-center ${viewMode === 'list' ? 'bg-[var(--text)] text-[var(--bg)]' : 'text-[var(--text-muted)]'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* #2 Natural-Language AI Smart Search Bar */}
      <div className="mb-5 p-3.5 sm:p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
        <form onSubmit={runAiSmartSearch} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Sparkles className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--primary)] pointer-events-none" />
            <input
              type="text"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder='Try AI search: "running shoes under 6000" or "cheapest headphones"'
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={aiSearchLoading || !aiQuery.trim()} className="ts-btn-primary !min-h-[44px] flex-1 sm:flex-none whitespace-nowrap">
              <Sparkles className="w-4 h-4" /> {aiSearchLoading ? 'Thinking...' : 'AI Search'}
            </button>
            {aiInterpretation && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="ts-btn-secondary !min-h-[44px] !px-3 text-xs"
              >
                Reset
              </button>
            )}
          </div>
        </form>
        {aiInterpretation && (
          <div className="mt-2.5 flex items-center gap-2 text-xs text-[var(--primary)] font-mono">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{aiInterpretation}</span>
          </div>
        )}
      </div>

      {/* Spell-correction notice */}
      {correctedQuery && filters.q && (
        <div className="mb-5 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--primary)]/40 text-xs sm:text-sm text-[var(--text)] flex flex-wrap items-center gap-1.5">
          <span className="text-[var(--text-muted)]">Showing results for</span>
          <strong className="text-[var(--primary)]">"{correctedQuery}"</strong>
          <span className="text-[var(--text-muted)]">instead of "{filters.q}"</span>
        </div>
      )}

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6 text-xs">
          {filters.q && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              Search: <strong>{filters.q}</strong>
              <button onClick={() => handleFilterChange('q', '')} aria-label="Clear search"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filters.category && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              Category: <strong>{filters.category}</strong>
              <button onClick={() => handleFilterChange('category', '')} aria-label="Clear category"><X className="w-3 h-3" /></button>
            </span>
          )}
          {(filters.minPrice || filters.maxPrice) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              Price: <strong>₹{filters.minPrice || '0'} – {filters.maxPrice ? `₹${filters.maxPrice}` : '∞'}</strong>
              <button onClick={() => { handleFilterChange('minPrice', ''); handleFilterChange('maxPrice', '') }} aria-label="Clear price"><X className="w-3 h-3" /></button>
            </span>
          )}
          <button onClick={clearAllFilters} className="text-[var(--primary)] font-medium hover:underline ml-1">Reset all</button>
        </div>
      )}

      {/* Full-width Amazon/Flipkart Side-by-Side Product Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} className="h-60 sm:h-72" />)}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products match those filters"
          description="Try clearing one or more filters to view available inventory."
          action={activeFilterCount > 0 ? <button className="ts-btn-primary" onClick={clearAllFilters}>Reset filters</button> : null}
        />
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5' : 'flex flex-col gap-4'}>
          {products.map((p) => {
            const hasDiscount = p.discountPercent > 0
            const eff = hasDiscount ? p.price * (1 - p.discountPercent / 100) : p.price
            return (
              <Link key={p.id} to={`/products/${p.id}`} className={`ts-card ts-card-link overflow-hidden ${viewMode === 'list' ? 'flex flex-col sm:flex-row' : 'flex flex-col'}`}>
                <div className={`relative overflow-hidden bg-[var(--surface-2)] ${viewMode === 'list' ? 'sm:w-52 aspect-square sm:aspect-auto shrink-0' : 'aspect-square'}`}>
                  <ProductImage src={p.imageUrl} alt={p.name} />
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => toggleCompare(e, p.id)}
                      aria-label="Compare product"
                      title={compareIds.includes(p.id) ? 'Remove from compare' : 'Add to AI compare'}
                      className={`w-8 h-8 rounded-lg border shadow-md flex items-center justify-center transition-colors ${
                        compareIds.includes(p.id)
                          ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                          : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                      }`}
                    >
                      {compareIds.includes(p.id) ? <Check className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleWishlist(e, p)}
                      aria-label={wishlistedIds.has(Number(p.id)) ? 'Remove from wishlist' : 'Save item'}
                      className={`w-8 h-8 rounded-lg bg-[var(--bg)] border shadow-md flex items-center justify-center transition-colors ${
                        wishlistedIds.has(Number(p.id))
                          ? 'border-red-500 text-red-500'
                          : 'border-[var(--border)] text-[var(--text)] hover:border-red-500 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${wishlistedIds.has(Number(p.id)) ? 'fill-red-500 text-red-500' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickView(p) }}
                      aria-label="Quick view"
                      className="hidden sm:flex w-8 h-8 rounded-lg bg-[var(--bg)] border border-[var(--border)] shadow-md items-center justify-center text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-2.5 sm:p-4 bg-[var(--bg)] border-t border-[var(--border)] flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-[var(--text-muted)] truncate">{p.category?.name || p.categoryName || 'General'}</span>
                      {p.stock <= 0 ? (
                        <span className="font-mono text-[10px] text-[var(--danger)] shrink-0">Sold out</span>
                      ) : p.stock < 5 ? (
                        <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400 shrink-0">Only {p.stock}</span>
                      ) : null}
                    </div>
                    <h3 className="font-semibold text-xs sm:text-sm text-[var(--text)] mt-1 line-clamp-2">{p.name}</h3>
                    {p.avgRating > 0 && <div className="mt-1"><StarDisplay rating={p.avgRating} count={p.reviewCount} size=".74rem" /></div>}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="tabular">
                      <div className="font-semibold text-sm sm:text-base text-[var(--text)]">{formatINR(eff)}</div>
                      {hasDiscount && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="line-through text-[var(--text-muted)]">{formatINR(p.price)}</span>
                          <span className="font-mono text-[var(--primary)]">-{p.discountPercent}%</span>
                        </div>
                      )}
                    </div>
                    <button
                      disabled={p.stock <= 0}
                      onClick={(e) => handleAddToCart(e, p)}
                      className="ts-btn-primary !min-h-[34px] !px-2.5 sm:!px-3 text-xs w-full sm:w-auto"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-10">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="ts-btn-secondary !min-h-[38px] text-xs disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="font-mono text-xs text-[var(--text-muted)]">Page {page + 1} / {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="ts-btn-secondary !min-h-[38px] text-xs disabled:opacity-40">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {quickView && (
        <div onClick={() => setQuickView(null)} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl max-w-2xl w-full overflow-hidden grid grid-cols-1 sm:grid-cols-2 relative shadow-xl">
            <button onClick={() => setQuickView(null)} aria-label="Close quick view" className="absolute top-3 right-3 z-10 w-9 h-9 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
            <div className="aspect-square bg-[var(--surface)]">
              <ProductImage src={quickView.imageUrl} alt={quickView.name} />
            </div>
            <div className="p-6 flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">{quickView.category?.name || quickView.categoryName || 'General'}</div>
                <h3 className="text-xl font-semibold text-[var(--text)] mt-1">{quickView.name}</h3>
                <p className="text-sm text-[var(--text-muted)] mt-3 line-clamp-4">{quickView.description || 'In stock and ready for dispatch.'}</p>
              </div>
              <div className="mt-6 space-y-3">
                <div className="text-2xl font-semibold tabular">{formatINR(quickView.effectivePrice ?? quickView.price)}</div>
                <div className="flex gap-2">
                  <button disabled={quickView.stock <= 0} onClick={(e) => { handleAddToCart(e, quickView); setQuickView(null) }} className="ts-btn-primary flex-1">
                    Add to cart
                  </button>
                  <Link to={`/products/${quickView.id}`} className="ts-btn-secondary">View item</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* #3 Floating Compare with AI Bar */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-20 md:left-1/2 md:right-auto md:-translate-x-1/2 z-40 rounded-xl bg-[var(--bg)] border border-[var(--primary)] shadow-2xl px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--text)]">
            <Scale className="w-4 h-4 text-[var(--primary)] shrink-0" />
            <span>{compareIds.length} selected for AI compare</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] px-2 py-1"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={compareIds.length < 2}
              onClick={openAiCompare}
              className="ts-btn-primary !min-h-[36px] !px-3.5 text-xs"
            >
              <Sparkles className="w-3.5 h-3.5" /> Compare ({compareIds.length})
            </button>
          </div>
        </div>
      )}

      {/* #3 Compare with AI Modal */}
      {compareOpen && (
        <div onClick={() => setCompareOpen(false)} className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl max-w-4xl w-full max-h-[88dvh] overflow-y-auto shadow-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-lg font-semibold text-[var(--text)]">AI Product Comparison</h3>
              </div>
              <button type="button" onClick={() => setCompareOpen(false)} aria-label="Close comparison" className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            {compareLoading ? (
              <div className="py-12 text-center text-sm text-[var(--text-muted)]">
                <div className="spinner mx-auto mb-3" />
                Analyzing specs, prices, and reviews with AI...
              </div>
            ) : compareData?.products ? (
              <>
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--primary)]/40">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--primary)] mb-1.5">
                    AI Advisor Verdict
                  </div>
                  <div className="text-sm text-[var(--text)] whitespace-pre-line leading-relaxed">
                    {compareData.verdict}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {compareData.products.map((cp) => (
                    <div key={cp.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col">
                      <div className="aspect-square bg-[var(--surface-2)]">
                        <ProductImage src={cp.imageUrl} alt={cp.name} />
                      </div>
                      <div className="p-4 bg-[var(--bg)] border-t border-[var(--border)] flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{cp.category}</div>
                          <div className="font-semibold text-sm text-[var(--text)] mt-0.5">{cp.name}</div>
                          <div className="mt-2 flex items-baseline gap-2 tabular">
                            <span className="text-lg font-semibold text-[var(--text)]">{formatINR(cp.effectivePrice)}</span>
                            {Number(cp.discountPercent) > 0 && (
                              <span className="font-mono text-xs text-[var(--primary)]">-{cp.discountPercent}%</span>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-[var(--text-muted)] space-y-1">
                            <div>Rating: <strong className="text-[var(--text)]">{cp.avgRating > 0 ? `${cp.avgRating}★ (${cp.reviewCount})` : 'No reviews yet'}</strong></div>
                            <div>Stock: <strong className="text-[var(--text)]">{cp.stock <= 0 ? 'Out of stock' : cp.stock < 5 ? `Only ${cp.stock} left` : 'In stock'}</strong></div>
                          </div>
                        </div>
                        <Link to={`/products/${cp.id}`} onClick={() => setCompareOpen(false)} className="ts-btn-secondary w-full !min-h-[38px] text-xs">
                          View product
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </PageTransition>
  )
}
