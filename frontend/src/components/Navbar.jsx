import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  ShoppingCart, Bell, Sun, Moon, LogOut, ChevronDown, Search, Menu, X,
  Home, LayoutGrid, Package, Heart, TrendingUp, Clock, Store
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../api/axiosInstance'
import BrandLogo from './BrandLogo'

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const { dark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [trendingSearches, setTrendingSearches] = useState([])
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('recentSearches') || '[]') } catch { return [] }
  })
  const [cartCount, setCartCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef(null)
  const desktopSearchRef = useRef(null)
  const mobileSearchRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated) { setCartCount(0); return }
    const fetchCartCount = () => {
      api.get('/cart')
        .then(({ data }) => {
          setCartCount((data.items || []).reduce((acc, i) => acc + (i.quantity || 1), 0))
        })
        .catch(() => {})
    }
    api.get('/notifications')
      .then(({ data }) => {
        setNotifications(data.items || [])
        setUnreadCount(data.unreadCount || 0)
      })
      .catch(() => {})
    fetchCartCount()

    const onCartUpdated = (e) => {
      const nextCount = e?.detail?.totalItems
      if (typeof nextCount === 'number') setCartCount(nextCount)
      else fetchCartCount()
    }
    window.addEventListener('cart:updated', onCartUpdated)
    return () => window.removeEventListener('cart:updated', onCartUpdated)
  }, [isAuthenticated, location.pathname])

  useEffect(() => {
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setNotifOpen(false)
        setProfileOpen(false)
      }
      const inDesktop = desktopSearchRef.current && desktopSearchRef.current.contains(e.target)
      const inMobile = mobileSearchRef.current && mobileSearchRef.current.contains(e.target)
      if (!inDesktop && !inMobile) setSearchOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const openSearchSuggestions = () => {
    setSearchOpen(true)
    api.get('/products/trending-searches', { params: { limit: 6 } })
      .then(({ data }) => setTrendingSearches(data.queries || []))
      .catch(() => {})
  }

  const saveRecentSearch = (term) => {
    const clean = term.trim()
    if (clean.length < 2) return
    const next = [clean, ...recentSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 6)
    setRecentSearches(next)
    try { localStorage.setItem('recentSearches', JSON.stringify(next)) } catch {}
  }

  const executeSearch = (term) => {
    const q = term.trim()
    if (q) saveRecentSearch(q)
    setSearchQuery(q)
    setSearchOpen(false)
    setMobileOpen(false)
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products')
  }

  const handleSearch = (e) => {
    e.preventDefault()
    executeSearch(searchQuery)
  }

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all')
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {}
  }

  const handleLogout = async () => {
    setProfileOpen(false)
    await logout()
    navigate('/login')
  }

  const linkCls = (path, exact = false) => {
    const active = exact ? location.pathname === path : location.pathname.startsWith(path)
    return `px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? 'text-[var(--primary)] underline underline-offset-8 decoration-2'
        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
    }`
  }

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg)] border-b border-[var(--border)]">
      <div className="max-w-[1240px] mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-8">
          <Link to="/" aria-label="ShopVerse Home" className="shrink-0">
            <BrandLogo size="md" />
          </Link>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
            <Link to="/" className={linkCls('/', true)}>Overview</Link>
            <Link to="/products" className={linkCls('/products')}>Catalog</Link>
            {isAuthenticated && (
              <>
                <Link to="/orders" className={linkCls('/orders')}>Orders</Link>
                <Link to="/wishlist" className={linkCls('/wishlist')}>Saved</Link>
              </>
            )}
            <Link to="/sell" className={`${linkCls('/sell')} inline-flex items-center gap-1.5 whitespace-nowrap`}>
              <Store className="w-3.5 h-3.5" /> Become a Seller
            </Link>
            {isAdmin && (
              <Link to="/admin/analytics" className={linkCls('/admin')}>Admin</Link>
            )}
          </nav>
        </div>

        <div ref={desktopSearchRef} className="hidden xl:block flex-1 max-w-xs relative mx-2">
          <form onSubmit={handleSearch} className="flex items-center relative">
            <Search className="w-4 h-4 absolute left-3 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onFocus={openSearchSuggestions}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalog..."
              aria-label="Search catalog"
              className="w-full h-10 pl-10 pr-3 rounded-lg text-sm bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
            />
          </form>
          {searchOpen && (recentSearches.length > 0 || trendingSearches.length > 0) && (
            <div className="absolute left-0 right-0 mt-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] shadow-xl overflow-hidden z-50">
              {recentSearches.length > 0 && (
                <div className="p-2.5 border-b border-[var(--border)]">
                  <div className="flex items-center justify-between px-1.5 mb-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Recent</span>
                    <button
                      type="button"
                      onClick={() => { setRecentSearches([]); try { localStorage.removeItem('recentSearches') } catch {} }}
                      className="text-[11px] text-[var(--primary)] hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => executeSearch(term)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)] transition-colors"
                      >
                        <Clock className="w-3 h-3 text-[var(--text-muted)]" /> {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {trendingSearches.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    Trending searches
                  </div>
                  {trendingSearches.map((item) => (
                    <button
                      key={item.query}
                      type="button"
                      onClick={() => executeSearch(item.query)}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-[var(--text)] hover:bg-[var(--surface)] transition-colors text-left"
                    >
                      <span className="inline-flex items-center gap-2 capitalize">
                        <TrendingUp className="w-3.5 h-3.5 text-[var(--primary)]" />
                        {item.query}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">{item.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2" ref={dropdownRef}>
          <button
            onClick={toggleTheme}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {isAuthenticated && (
            <Link
              to="/cart"
              aria-label={`Cart, ${cartCount} items`}
              className="relative h-10 px-3 rounded-lg flex items-center gap-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="font-mono text-xs tabular">{cartCount}</span>
            </Link>
          )}

          {isAuthenticated ? (
            <>
              <div className="relative">
                <button
                  onClick={() => { setNotifOpen((o) => !o); setProfileOpen(false) }}
                  aria-label="Notifications"
                  aria-expanded={notifOpen}
                  className="relative w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--primary)]" />
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[var(--bg)] border border-[var(--border)] shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                      <span className="text-sm font-semibold">Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-[var(--primary)] hover:underline">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border)]">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[var(--text-muted)]">No notifications yet.</div>
                      ) : notifications.map((n) => (
                        <Link
                          key={n.id}
                          to={n.link || '/orders'}
                          onClick={() => setNotifOpen(false)}
                          className={`block px-4 py-3 hover:bg-[var(--surface)] ${!n.read ? 'bg-[var(--surface)]/60' : ''}`}
                        >
                          <div className="text-xs font-semibold text-[var(--text)]">{n.title}</div>
                          <div className="text-xs text-[var(--text-muted)] mt-0.5">{n.message}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => { setProfileOpen((o) => !o); setNotifOpen(false) }}
                  aria-expanded={profileOpen}
                  className="h-10 px-3 rounded-lg border border-[var(--border)] hover:border-[var(--text)] flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <span className="max-w-[110px] truncate">{user?.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[var(--bg)] border border-[var(--border)] shadow-lg py-1.5 z-50">
                    <div className="px-4 py-2 border-b border-[var(--border)]">
                      <div className="text-sm font-semibold truncate">{user?.name}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">{user?.email}</div>
                    </div>
                    <Link to="/profile" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm hover:bg-[var(--surface)]">Account summary</Link>
                    <Link to="/orders" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm hover:bg-[var(--surface)]">Orders</Link>
                    <Link to="/wishlist" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm hover:bg-[var(--surface)]">Saved items</Link>
                    <Link to="/addresses" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm hover:bg-[var(--surface)]">Address book</Link>
                    <Link to="/sell" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--surface)]">
                      <Store className="w-3.5 h-3.5 text-[var(--primary)]" /> Seller Hub
                    </Link>
                    {isAdmin && (
                      <Link to="/admin/analytics" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--surface)]">Admin desk</Link>
                    )}
                    <div className="border-t border-[var(--border)] mt-1 pt-1">
                      <button onClick={handleLogout} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--surface)]">
                        <LogOut className="w-3.5 h-3.5" /> Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link to="/login" className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-lg inline-flex items-center whitespace-nowrap text-xs sm:text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)]">
                Sign in
              </Link>
              <Link to="/register" className="ts-btn-primary !min-h-[36px] sm:!min-h-[40px] !px-3 sm:!px-4 text-xs sm:text-sm whitespace-nowrap">
                <span className="sm:hidden">Sign up</span>
                <span className="hidden sm:inline">Create account</span>
              </Link>
            </div>
          )}

          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center hover:bg-[var(--surface)]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Dedicated non-overlapping mobile/tablet search row (in document flow, never overlaps content) */}
      <div className="xl:hidden border-t border-[var(--border)] px-4 sm:px-6 py-2.5 bg-[var(--bg)]">
        <div ref={mobileSearchRef} className="relative max-w-[1240px] mx-auto">
          <form onSubmit={handleSearch} className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onFocus={openSearchSuggestions}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, categories..."
              aria-label="Search products"
              className="w-full h-10 pl-10 pr-4 rounded-lg text-sm bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
            />
          </form>
          {searchOpen && (recentSearches.length > 0 || trendingSearches.length > 0) && (
            <div className="absolute left-0 right-0 mt-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] shadow-xl overflow-hidden z-50">
              {recentSearches.length > 0 && (
                <div className="p-2.5 border-b border-[var(--border)]">
                  <div className="flex items-center justify-between px-1.5 mb-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Recent</span>
                    <button
                      type="button"
                      onClick={() => { setRecentSearches([]); try { localStorage.removeItem('recentSearches') } catch {} }}
                      className="text-[11px] text-[var(--primary)] hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => executeSearch(term)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                      >
                        <Clock className="w-3 h-3 text-[var(--text-muted)]" /> {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {trendingSearches.length > 0 && (
                <div className="p-2.5">
                  <div className="px-1 mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    Trending searches
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {trendingSearches.map((item) => (
                      <button
                        key={item.query}
                        type="button"
                        onClick={() => executeSearch(item.query)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)] capitalize"
                      >
                        <TrendingUp className="w-3 h-3 text-[var(--primary)]" />
                        {item.query}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--bg)] px-6 py-4 space-y-2 shadow-lg">
          <div className="flex flex-col gap-1 text-base font-medium">
            <Link to="/" onClick={() => setMobileOpen(false)} className="py-2.5 border-b border-[var(--border)]">Overview</Link>
            <Link to="/products" onClick={() => setMobileOpen(false)} className="py-2.5 border-b border-[var(--border)]">Catalog</Link>
            <Link to="/sell" onClick={() => setMobileOpen(false)} className="py-2.5 border-b border-[var(--border)] flex items-center gap-2 text-[var(--primary)]">
              <Store className="w-4 h-4" /> Become a Seller
            </Link>
            {isAuthenticated && (
              <>
                <Link to="/cart" onClick={() => setMobileOpen(false)} className="py-2.5 border-b border-[var(--border)]">Cart ({cartCount})</Link>
                <Link to="/orders" onClick={() => setMobileOpen(false)} className="py-2.5 border-b border-[var(--border)]">Orders</Link>
                <Link to="/wishlist" onClick={() => setMobileOpen(false)} className="py-2.5 border-b border-[var(--border)]">Saved items</Link>
                <Link to="/addresses" onClick={() => setMobileOpen(false)} className="py-2.5 border-b border-[var(--border)]">Address book</Link>
                <Link to="/profile" onClick={() => setMobileOpen(false)} className="py-2.5 border-b border-[var(--border)]">Account summary</Link>
              </>
            )}
            {isAdmin && <Link to="/admin/analytics" onClick={() => setMobileOpen(false)} className="py-2.5 text-[var(--primary)]">Admin desk</Link>}
          </div>
        </div>
      )}
    </header>
  )
}

export function MobileBottomNav() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) { setCartCount(0); return }
    const fetchCartCount = () => {
      api.get('/cart')
        .then(({ data }) => setCartCount((data.items || []).reduce((acc, i) => acc + (i.quantity || 1), 0)))
        .catch(() => {})
    }
    fetchCartCount()
    const onCartUpdated = (e) => {
      const nextCount = e?.detail?.totalItems
      if (typeof nextCount === 'number') setCartCount(nextCount)
      else fetchCartCount()
    }
    window.addEventListener('cart:updated', onCartUpdated)
    return () => window.removeEventListener('cart:updated', onCartUpdated)
  }, [isAuthenticated, location.pathname])

  const itemCls = (path, exact = false) => {
    const active = exact ? location.pathname === path : location.pathname.startsWith(path)
    return `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
      active ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
    }`
  }

  return (
    <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[var(--bg)] border-t border-[var(--border)] flex items-center">
      <Link to="/" className={itemCls('/', true)}>
        <Home className="w-5 h-5" />
        <span>Home</span>
      </Link>
      <Link to="/products" className={itemCls('/products')}>
        <LayoutGrid className="w-5 h-5" />
        <span>Catalog</span>
      </Link>
      <Link to={isAuthenticated ? '/orders' : '/login'} className={itemCls('/orders')}>
        <Package className="w-5 h-5" />
        <span>Orders</span>
      </Link>
      <Link to={isAuthenticated ? '/wishlist' : '/login'} className={itemCls('/wishlist')}>
        <Heart className="w-5 h-5" />
        <span>Saved</span>
      </Link>
      <Link to={isAuthenticated ? '/cart' : '/login'} className={`${itemCls('/cart')} relative`}>
        <ShoppingCart className="w-5 h-5" />
        {cartCount > 0 && (
          <span className="absolute top-1.5 right-1/4 min-w-[16px] h-4 px-1 rounded-full bg-[var(--primary)] text-white font-mono text-[10px] flex items-center justify-center">
            {cartCount}
          </span>
        )}
        <span>Cart</span>
      </Link>
    </nav>
  )
}
