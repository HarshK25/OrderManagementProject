import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin, ChevronRight, ChevronLeft, Sparkles, Smartphone, Headphones,
  Shirt, Footprints, Lamp, Dumbbell, Watch, LayoutGrid, Tag, ArrowRight, TrendingUp,
  Gamepad2, Briefcase
} from 'lucide-react'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { ProductImage, SkeletonCard, PageTransition, formatINR } from '../components/ui/GlassUI'

const CATEGORY_ICONS = {
  Technology: Smartphone,
  Audio: Headphones,
  Clothing: Shirt,
  Footwear: Footprints,
  'Home & Kitchen': Lamp,
  'Sports & Fitness': Dumbbell,
  Accessories: Watch,
  Gaming: Gamepad2,
  'Beauty & Care': Sparkles,
  'Travel & Luggage': Briefcase,
}

export default function HomePage() {
  const { user, isAuthenticated } = useAuth()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [topSearches, setTopSearches] = useState([])
  const [recommended, setRecommended] = useState([])
  const [basedOnTerms, setBasedOnTerms] = useState([])
  const [defaultAddress, setDefaultAddress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bannerIdx, setBannerIdx] = useState(0)
  const [recentIds, setRecentIds] = useState([])

  useEffect(() => {
    let recentQueries = []
    try {
      setRecentIds(JSON.parse(localStorage.getItem('recentlyViewed') || '[]'))
      recentQueries = JSON.parse(localStorage.getItem('recentSearches') || '[]')
    } catch {}

    Promise.all([
      api.get('/products', { params: { page: 0, size: 20, sortBy: 'createdAt', direction: 'desc' } }),
      api.get('/categories'),
      api.get('/products/recommendations', {
        params: {
          limit: 8,
          ...(recentQueries.length > 0 ? { recent: recentQueries.slice(0, 4).join(',') } : {}),
        },
      }).catch(() => ({ data: { topSearches: [], basedOn: [], products: [] } })),
    ])
      .then(([prodRes, catRes, recRes]) => {
        setProducts(prodRes.data?.content || [])
        setCategories(catRes.data || [])
        setTopSearches(recRes.data?.topSearches || [])
        setBasedOnTerms(recRes.data?.basedOn || [])
        setRecommended(recRes.data?.products || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    if (isAuthenticated) {
      api.get('/addresses')
        .then(({ data }) => {
          const list = data || []
          setDefaultAddress(list.find((a) => a.defaultAddress) || list[0] || null)
        })
        .catch(() => {})
    }
  }, [isAuthenticated])

  // Featured banner slides built from real discounted products
  const discounted = products.filter((p) => Number(p.discountPercent) > 0)
  const bannerProducts = (discounted.length >= 3 ? discounted : products).slice(0, 4)
  const activeBanner = bannerProducts[bannerIdx % Math.max(1, bannerProducts.length)]

  // "Still looking for these?" — recently viewed products, falling back to popular items
  const recentProducts = products.filter((p) => recentIds.includes(p.id))
  const stillLooking = (recentProducts.length >= 2 ? recentProducts : products.slice(0, 6)).slice(0, 6)

  // Deals & All Stock
  const topDeals = [...products]
    .sort((a, b) => Number(b.discountPercent || 0) - Number(a.discountPercent || 0))
    .slice(0, 8)

  const firstName = user?.name ? user.name.split(' ')[0] : null

  return (
    <PageTransition className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-4 pb-24 md:pb-12 space-y-8">
      {/* 1. Delivery Location Strip (Flipkart-style, in Sheet-and-Biro theme) */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs sm:text-sm">
        <Link to={isAuthenticated ? '/addresses' : '/login'} className="flex items-center gap-2 min-w-0 text-[var(--text)] hover:text-[var(--primary)] transition-colors">
          <MapPin className="w-4 h-4 text-[var(--primary)] shrink-0" />
          <span className="truncate">
            {defaultAddress ? (
              <>
                <span className="font-semibold uppercase font-mono text-[11px] mr-1.5">{defaultAddress.label}</span>
                <span className="text-[var(--text-muted)]">
                  {defaultAddress.addressLine}, {defaultAddress.city} — {defaultAddress.pincode}
                </span>
              </>
            ) : isAuthenticated ? (
              <span className="text-[var(--text-muted)]">Add your delivery address for faster checkout</span>
            ) : (
              <span className="text-[var(--text-muted)]">Sign in to select your delivery address</span>
            )}
          </span>
        </Link>
        <Link to={isAuthenticated ? '/addresses' : '/login'} className="font-mono text-[11px] text-[var(--primary)] shrink-0 hover:underline">
          {defaultAddress ? 'Change' : 'Set address'}
        </Link>
      </div>

      {/* 2. Horizontal Category Icon Strip */}
      <section aria-label="Shop by category" className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          <Link
            to="/products"
            className="flex flex-col items-center gap-1.5 min-w-[76px] sm:min-w-[88px] p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--primary)] text-[var(--primary)] shrink-0 transition-colors"
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[11px] font-semibold whitespace-nowrap">For You</span>
          </Link>

          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.name] || Tag
            return (
              <Link
                key={c.id}
                to={`/products?category=${encodeURIComponent(c.name)}`}
                className="flex flex-col items-center gap-1.5 min-w-[76px] sm:min-w-[92px] p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--text)] text-[var(--text)] shrink-0 transition-colors"
              >
                <Icon className="w-5 h-5 text-[var(--text-muted)]" />
                <span className="text-[11px] font-medium whitespace-nowrap">{c.name}</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* 3. Hero Sale Spotlight Banner */}
      <section data-enter className="relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
        {loading || !activeBanner ? (
          <SkeletonCard className="h-64 sm:h-80" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 items-center">
            <div className="md:col-span-7 p-6 sm:p-10 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[var(--bg)] border border-[var(--border)] font-mono text-[11px] uppercase tracking-wider text-[var(--primary)]">
                <Tag className="w-3.5 h-3.5" />
                {activeBanner.discountPercent > 0 ? `Save ${activeBanner.discountPercent}% today` : 'Featured pick'}
              </div>

              <h1 className="text-2xl sm:text-4xl font-semibold tracking-[-0.035em] leading-tight text-[var(--text)]">
                {activeBanner.name}
              </h1>

              <p className="text-sm text-[var(--text-muted)] max-w-lg line-clamp-2">
                {activeBanner.description || 'Live warehouse stock with same-day dispatch and 7-day easy returns.'}
              </p>

              <div className="flex flex-wrap items-baseline gap-3 pt-1 tabular">
                <span className="text-2xl sm:text-3xl font-semibold text-[var(--text)]">
                  From {formatINR(activeBanner.effectivePrice ?? activeBanner.price)}
                </span>
                {activeBanner.discountPercent > 0 && (
                  <span className="text-sm line-through text-[var(--text-muted)]">
                    {formatINR(activeBanner.price)}
                  </span>
                )}
              </div>

              {/* Coupon strip */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]">
                  WELCOME10 &middot; 10% Instant Off
                </span>
                <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]">
                  FLAT200 &middot; ₹200 Off
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link to={`/products/${activeBanner.id}`} className="ts-btn-primary">
                  Shop now <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/products" className="ts-btn-secondary">
                  Browse all
                </Link>
              </div>
            </div>

            <div className="md:col-span-5 h-56 sm:h-72 md:h-full bg-[var(--surface-2)] overflow-hidden relative">
              <Link to={`/products/${activeBanner.id}`} className="block w-full h-full">
                <ProductImage src={activeBanner.imageUrl} alt={activeBanner.name} />
              </Link>
            </div>
          </div>
        )}

        {/* Banner controls */}
        {bannerProducts.length > 1 && (
          <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--bg)] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {bannerProducts.map((bp, idx) => (
                <button
                  key={bp.id}
                  type="button"
                  aria-label={`Slide ${idx + 1}`}
                  onClick={() => setBannerIdx(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    bannerIdx === idx ? 'w-7 bg-[var(--primary)]' : 'w-2 bg-[var(--border)] hover:bg-[var(--text-muted)]'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => setBannerIdx((i) => (i - 1 + bannerProducts.length) % bannerProducts.length)}
                className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center hover:border-[var(--text)]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => setBannerIdx((i) => (i + 1) % bannerProducts.length)}
                className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center hover:border-[var(--text)]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 4. "Still looking for these?" Shelf (Flipkart-style personalized card row) */}
      {stillLooking.length > 0 && (
        <section className="rounded-2xl p-5 sm:p-6 bg-[var(--surface)] border border-[var(--border)]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold tracking-[-0.025em] text-[var(--text)]">
              {firstName ? `${firstName}, still looking for these?` : 'Still looking for these?'}
            </h2>
            <Link to="/products" className="ts-link text-xs sm:text-sm inline-flex items-center gap-1 shrink-0">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stillLooking.map((p) => {
              const eff = p.discountPercent > 0 ? p.price * (1 - p.discountPercent / 100) : p.price
              return (
                <Link
                  key={p.id}
                  to={`/products/${p.id}`}
                  className="rounded-xl bg-[var(--bg)] border border-[var(--border)] ts-card-link overflow-hidden flex flex-col"
                >
                  <div className="aspect-square overflow-hidden bg-[var(--surface-2)]">
                    <ProductImage src={p.imageUrl} alt={p.name} />
                  </div>
                  <div className="p-2.5">
                    <div className="text-xs font-medium text-[var(--text)] truncate">{p.name}</div>
                    <div className="text-xs font-semibold text-[var(--primary)] tabular mt-0.5">{formatINR(eff)}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* 4b. Recommended from Top Searches (Redis-backed global + personal search recommendations) */}
      {(topSearches.length > 0 || recommended.length > 0) && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--primary)] mb-1">
                <TrendingUp className="w-3.5 h-3.5" /> Trending &amp; Recommended
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                Recommended from top searches
              </h2>
              {basedOnTerms.length > 0 && (
                <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                  Matched from popular searches: {basedOnTerms.slice(0, 4).join(', ')}
                </p>
              )}
            </div>
            <Link to="/products" className="ts-link text-xs sm:text-sm inline-flex items-center gap-1 shrink-0">
              Explore all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {topSearches.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {topSearches.slice(0, 8).map((item) => (
                <Link
                  key={item.query}
                  to={`/products?q=${encodeURIComponent(item.query)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--primary)] text-xs font-medium text-[var(--text)] shrink-0 transition-colors capitalize"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>{item.query}</span>
                </Link>
              ))}
            </div>
          )}

          {recommended.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {recommended.map((p) => {
                const eff = p.effectivePrice ?? (p.discountPercent > 0 ? p.price * (1 - p.discountPercent / 100) : p.price)
                return (
                  <Link key={p.id} to={`/products/${p.id}`} className="ts-card ts-card-link overflow-hidden flex flex-col">
                    <div className="relative aspect-square overflow-hidden bg-[var(--surface-2)]">
                      <ProductImage src={p.imageUrl} alt={p.name} />
                      {p.discountPercent > 0 && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[var(--primary)] text-white font-mono text-[10px] font-semibold">
                          -{p.discountPercent}%
                        </span>
                      )}
                    </div>
                    <div className="p-3 sm:p-4 bg-[var(--bg)] border-t border-[var(--border)] flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-[var(--text-muted)] truncate">
                            {p.category?.name || p.categoryName || 'General'}
                          </span>
                          {p.stock <= 0 ? (
                            <span className="font-mono text-[10px] text-[var(--danger)] shrink-0">Sold out</span>
                          ) : p.stock < 5 ? (
                            <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400 shrink-0">Only {p.stock}</span>
                          ) : null}
                        </div>
                        <h3 className="font-semibold text-xs sm:text-sm text-[var(--text)] mt-1 line-clamp-2">{p.name}</h3>
                      </div>
                      <div className="mt-3 flex flex-wrap items-baseline gap-2 tabular">
                        <span className="font-semibold text-sm sm:text-base text-[var(--text)]">{formatINR(eff)}</span>
                        {p.discountPercent > 0 && (
                          <span className="text-[11px] line-through text-[var(--text-muted)]">{formatINR(p.price)}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* 5. Top Deals & Best Sellers (Flipkart/Amazon 2-col mobile, 4-col desktop grid) */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">
              Top deals for you
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
              Live prices across Electronics, Audio, Footwear, Clothing, Home &amp; Fitness
            </p>
          </div>
          <Link to="/products" className="ts-link text-xs sm:text-sm inline-flex items-center gap-1 shrink-0">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} className="h-56 sm:h-72" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {topDeals.map((p) => {
              const eff = p.discountPercent > 0 ? p.price * (1 - p.discountPercent / 100) : p.price
              return (
                <Link key={p.id} to={`/products/${p.id}`} className="ts-card ts-card-link overflow-hidden flex flex-col">
                  <div className="relative aspect-square overflow-hidden bg-[var(--surface-2)]">
                    <ProductImage src={p.imageUrl} alt={p.name} />
                    {p.discountPercent > 0 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[var(--primary)] text-white font-mono text-[10px] font-semibold">
                        -{p.discountPercent}%
                      </span>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 bg-[var(--bg)] border-t border-[var(--border)] flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-[var(--text-muted)] truncate">
                          {p.category?.name || p.categoryName || 'General'}
                        </span>
                        {p.stock <= 0 ? (
                          <span className="font-mono text-[10px] text-[var(--danger)] shrink-0">Sold out</span>
                        ) : p.stock < 5 ? (
                          <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400 shrink-0">Only {p.stock}</span>
                        ) : null}
                      </div>
                      <h3 className="font-semibold text-xs sm:text-sm text-[var(--text)] mt-1 line-clamp-2">{p.name}</h3>
                    </div>
                    <div className="mt-3 flex flex-wrap items-baseline gap-2 tabular">
                      <span className="font-semibold text-sm sm:text-base text-[var(--text)]">{formatINR(eff)}</span>
                      {p.discountPercent > 0 && (
                        <span className="text-[11px] line-through text-[var(--text-muted)]">{formatINR(p.price)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </PageTransition>
  )
}
