import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Store, ArrowRight, CheckCircle2, Truck, Wallet, ShieldCheck, Sparkles,
  Plus, Package, TrendingUp, Layers, IndianRupee, Pause, Play, MapPin
} from 'lucide-react'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { PageTransition, ProductImage, ThemedSelect, formatINR } from '../components/ui/GlassUI'
import BrandLogo from '../components/BrandLogo'
import { sanitizePhone, sanitizePincode, extractApiError } from '../utils/validation'

const BUSINESS_TYPES = [
  { value: 'INDIVIDUAL', label: 'Individual / Sole Proprietor' },
  { value: 'PARTNERSHIP', label: 'Partnership Firm' },
  { value: 'PVT_LTD', label: 'Private Limited (Pvt. Ltd.)' },
  { value: 'BRAND', label: 'Direct Brand / Manufacturer' },
]

const BENEFITS = [
  { icon: IndianRupee, title: '0% listing fee', desc: 'List unlimited products across 10 categories with zero upfront subscription charges.' },
  { icon: Wallet, title: '7-day bank payout', desc: 'Fast, automated settlement directly to your verified bank account after delivery.' },
  { icon: Truck, title: 'Doorstep pickup', desc: 'Schedule courier pickups from your warehouse or home across Indian pincodes.' },
  { icon: Sparkles, title: 'AI catalog tools', desc: 'Generate product descriptions in one click and reach buyers via smart & Hinglish search.' },
]

const STEPS = [
  { num: '01', title: 'Create your store', desc: 'Enter store name, pickup address, and optional GSTIN.' },
  { num: '02', title: 'List your products', desc: 'Add pricing, stock, photos, and AI-assisted descriptions.' },
  { num: '03', title: 'Receive orders', desc: 'Customers discover your items via search, deals, and bundles.' },
  { num: '04', title: 'Ship & get paid', desc: 'Hand over packed orders and receive settlements on schedule.' },
]

export default function BecomeSellerPage() {
  const { isAuthenticated, user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(isAuthenticated)
  const [dashboard, setDashboard] = useState(null)
  const [categories, setCategories] = useState([])

  // Onboarding form
  const [regForm, setRegForm] = useState({
    storeName: '',
    businessType: 'INDIVIDUAL',
    gstin: '',
    phone: '',
    pickupAddress: '',
    city: '',
    state: '',
    pincode: '',
    bankAccountHolder: user?.name || '',
    bankIfsc: '',
  })
  const [regError, setRegError] = useState('')
  const [regSubmitting, setRegSubmitting] = useState(false)

  // Seller product creation form
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [prodForm, setProdForm] = useState({
    name: '',
    categoryId: '',
    price: '',
    discountPercent: '0',
    stock: '10',
    imageUrl: '',
    description: '',
  })
  const [prodBusy, setProdBusy] = useState(false)
  const [aiDescBusy, setAiDescBusy] = useState(false)
  const [stockEdits, setStockEdits] = useState({})

  const loadDashboard = useCallback(() => {
    if (!isAuthenticated) { setLoading(false); setDashboard(null); return }
    setLoading(true)
    api.get('/seller/me')
      .then(({ data }) => setDashboard(data))
      .catch(() => setDashboard({ registered: false }))
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  useEffect(() => {
    loadDashboard()
    api.get('/categories').then(({ data }) => setCategories(data || [])).catch(() => {})
  }, [loadDashboard])

  useEffect(() => {
    if (user?.name && !regForm.bankAccountHolder) {
      setRegForm((prev) => ({ ...prev, bankAccountHolder: user.name }))
    }
  }, [user?.name])

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) { navigate('/login'); return }
    setRegError('')
    setRegSubmitting(true)
    try {
      const { data } = await api.post('/seller/register', regForm)
      setDashboard(data)
      toast('Welcome to ShopVerse Seller Hub! Your store is now live.', 'success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setRegError(extractApiError(err, 'Could not complete seller registration.'))
    } finally {
      setRegSubmitting(false)
    }
  }

  const handleGenerateDescription = async () => {
    if (!prodForm.name.trim()) {
      toast('Enter a product name first', 'info')
      return
    }
    setAiDescBusy(true)
    try {
      const catName = categories.find((c) => String(c.id) === String(prodForm.categoryId))?.name || 'General'
      const { data } = await api.post('/seller/ai/generate-description', {
        name: prodForm.name.trim(),
        category: catName,
        price: Number(prodForm.price || 999),
        keywords: prodForm.name.trim(),
      })
      setProdForm((prev) => ({ ...prev, description: data.description || '' }))
      toast('AI description generated', 'success')
    } catch (err) {
      toast(extractApiError(err, 'Could not generate AI description'), 'error')
    } finally {
      setAiDescBusy(false)
    }
  }

  const handleCreateProduct = async (e) => {
    e.preventDefault()
    if (!prodForm.name.trim() || !prodForm.price) {
      toast('Product name and price are required', 'error')
      return
    }
    setProdBusy(true)
    try {
      await api.post('/seller/products', {
        name: prodForm.name.trim(),
        categoryId: prodForm.categoryId ? Number(prodForm.categoryId) : null,
        price: Number(prodForm.price),
        discountPercent: Number(prodForm.discountPercent || 0),
        stock: Number(prodForm.stock || 0),
        imageUrl: prodForm.imageUrl.trim() || null,
        description: prodForm.description.trim() || null,
        active: true,
      })
      toast('Product listed live in catalog!', 'success')
      setProdForm({ name: '', categoryId: '', price: '', discountPercent: '0', stock: '10', imageUrl: '', description: '' })
      setShowAddProduct(false)
      loadDashboard()
    } catch (err) {
      toast(extractApiError(err, 'Failed to list product'), 'error')
    } finally {
      setProdBusy(false)
    }
  }

  const handleUpdateStock = async (productId, fallbackStock) => {
    const val = stockEdits[productId] !== undefined ? Number(stockEdits[productId]) : fallbackStock
    if (Number.isNaN(val) || val < 0) { toast('Enter a valid non-negative stock', 'error'); return }
    try {
      await api.patch(`/seller/products/${productId}/stock`, { stock: val })
      toast('Stock updated', 'success')
      loadDashboard()
    } catch (err) {
      toast(extractApiError(err, 'Failed to update stock'), 'error')
    }
  }

  const handleToggleProduct = async (productId) => {
    try {
      await api.patch(`/seller/products/${productId}/toggle-active`)
      toast('Listing status updated', 'info')
      loadDashboard()
    } catch (err) {
      toast(extractApiError(err, 'Failed to update listing'), 'error')
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW A: REGISTERED SELLER HUB DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════
  if (isAuthenticated && dashboard?.registered) {
    const { profile, stats, products = [] } = dashboard
    const isApproved = profile.status === 'APPROVED'

    return (
      <PageTransition className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-6 pb-24 md:py-10 space-y-8">
        {/* Store Header */}
        <div className="ts-card p-5 sm:p-7 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--primary)]">
                <Store className="w-3.5 h-3.5" /> Seller Hub
              </span>
              <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded border bg-[var(--bg)] ${
                isApproved
                  ? 'border-[var(--success)]/40 text-[var(--success)]'
                  : 'border-amber-500/40 text-amber-600 dark:text-amber-400'
              }`}>
                {profile.status}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-[var(--text)]">
              {profile.storeName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {profile.city}, {profile.state} — {profile.pincode}
              </span>
              {profile.gstin && <span className="font-mono">GSTIN: {profile.gstin}</span>}
              <span className="font-mono">Phone: {profile.phone}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={!isApproved}
            onClick={() => setShowAddProduct((v) => !v)}
            className="ts-btn-primary w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> {showAddProduct ? 'Close form' : 'List new product'}
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {[
            { label: 'Total listings', value: stats?.totalProducts ?? 0, icon: Package },
            { label: 'Active in store', value: stats?.activeProducts ?? 0, icon: CheckCircle2 },
            { label: 'Units in stock', value: stats?.totalStock ?? 0, icon: Layers },
            { label: 'Catalog value', value: formatINR(stats?.inventoryValue ?? 0), icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="ts-card p-4 sm:p-5">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
                <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider">{label}</span>
                <Icon className="w-4 h-4 text-[var(--primary)]" />
              </div>
              <div className="text-xl sm:text-2xl font-semibold text-[var(--text)] tabular">{value}</div>
            </div>
          ))}
        </div>

        {/* Add New Product Panel */}
        {showAddProduct && (
          <form onSubmit={handleCreateProduct} className="ts-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
              <h2 className="text-base font-semibold text-[var(--text)]">Add a product to your store</h2>
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={aiDescBusy}
                className="ts-btn-secondary !min-h-[34px] !px-3 text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
                {aiDescBusy ? 'Generating...' : 'AI description'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Product name *</label>
                <input
                  required
                  className="input"
                  placeholder="e.g. Handcrafted Leather Messenger Bag"
                  value={prodForm.name}
                  onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Category</label>
                <ThemedSelect
                  value={prodForm.categoryId}
                  onChange={(val) => setProdForm({ ...prodForm, categoryId: val })}
                  placeholder="Select category"
                  options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                  ariaLabel="Product category"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">MRP Price (₹) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  className="input"
                  placeholder="e.g. 2499"
                  value={prodForm.price}
                  onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  className="input"
                  value={prodForm.discountPercent}
                  onChange={(e) => setProdForm({ ...prodForm, discountPercent: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Initial stock *</label>
                <input
                  required
                  type="number"
                  min="0"
                  className="input"
                  value={prodForm.stock}
                  onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Image URL</label>
              <input
                type="url"
                className="input"
                placeholder="https://images.unsplash.com/..."
                value={prodForm.imageUrl}
                onChange={(e) => setProdForm({ ...prodForm, imageUrl: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Description</label>
              <textarea
                rows={3}
                className="input"
                placeholder="Describe material, dimensions, warranty, or click 'AI description' above..."
                value={prodForm.description}
                onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-1">
              <button type="button" onClick={() => setShowAddProduct(false)} className="ts-btn-secondary w-full sm:w-auto">
                Cancel
              </button>
              <button type="submit" disabled={prodBusy} className="ts-btn-primary w-full sm:w-auto">
                {prodBusy ? 'Publishing...' : 'Publish listing'}
              </button>
            </div>
          </form>
        )}

        {/* Seller Listings */}
        <div className="ts-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h2 className="text-base font-semibold text-[var(--text)]">Your product listings ({products.length})</h2>
            <Link to="/products" className="ts-link text-xs">View storefront</Link>
          </div>

          {products.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <Package className="w-8 h-8 mx-auto text-[var(--text-muted)]" strokeWidth={1.5} />
              <div className="text-sm font-medium text-[var(--text)]">No products listed yet</div>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Add your first product to make it immediately searchable by all customers on ShopVerse.
              </p>
              <button type="button" onClick={() => setShowAddProduct(true)} className="ts-btn-primary !min-h-[38px] text-xs">
                <Plus className="w-3.5 h-3.5" /> Add first product
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {products.map((p) => (
                <div key={p.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <Link to={`/products/${p.id}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-[var(--surface-2)] border border-[var(--border)] shrink-0">
                      <ProductImage src={p.imageUrl} alt={p.name} iconSize="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-[var(--text)] group-hover:text-[var(--primary)] truncate">
                        {p.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 font-mono text-xs text-[var(--text-muted)]">
                        <span>{p.category?.name || 'General'}</span>
                        <span>·</span>
                        <span className="text-[var(--text)] font-semibold">{formatINR(p.effectivePrice)}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                          p.active
                            ? 'border-[var(--success)]/40 text-[var(--success)]'
                            : 'border-[var(--border)] text-[var(--text-muted)]'
                        }`}>
                          {p.active ? 'LIVE' : 'PAUSED'}
                        </span>
                      </div>
                    </div>
                  </Link>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">Stock:</span>
                      <input
                        type="number"
                        min="0"
                        value={stockEdits[p.id] ?? p.stock}
                        onChange={(e) => setStockEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="input !w-20 !min-h-[34px] !py-1 !px-2 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateStock(p.id, p.stock)}
                        className="ts-btn-secondary !min-h-[34px] !px-2.5 text-xs"
                      >
                        Save
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleProduct(p.id)}
                      className="ts-btn-secondary !min-h-[34px] !px-2.5 text-xs"
                    >
                      {p.active ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Resume</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageTransition>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW B: FLIPKART-STYLE "BECOME A SELLER" LANDING + ONBOARDING FORM
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <PageTransition className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-6 pb-24 md:py-10 space-y-12">
      {/* Hero Banner */}
      <section data-enter className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-5">
          <BrandLogo size="md" subtitle="Seller Hub" />

          <h1 className="text-3xl sm:text-5xl font-semibold tracking-[-0.035em] leading-[1.1] text-[var(--text)]">
            Sell online to shoppers across India.
          </h1>

          <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-xl leading-relaxed">
            Launch your storefront in minutes with zero listing fees, AI-assisted product descriptions, live inventory controls, and direct bank payouts.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {isAuthenticated ? (
              <a href="#seller-onboarding" className="ts-btn-primary">
                Start selling now <ArrowRight className="w-4 h-4" />
              </a>
            ) : (
              <Link to="/login" className="ts-btn-primary">
                Sign in to register store <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <a href="#how-it-works" className="ts-btn-secondary">
              How it works
            </a>
          </div>
        </div>

        {/* Highlights Box */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3">
          {[
            { stat: '0%', label: 'Listing fee' },
            { stat: '7 Days', label: 'Settlement cycle' },
            { stat: '10+', label: 'Live categories' },
            { stat: '24×7', label: 'AI seller tools' },
          ].map((m) => (
            <div key={m.label} className="p-4 sm:p-5 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
              <div className="font-mono text-2xl sm:text-3xl font-bold text-[var(--primary)] tabular">{m.stat}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Sell With Us */}
      <section className="space-y-5">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--primary)]">Why sell on ShopVerse</span>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[var(--text)] mt-1">
            Built for independent brands &amp; growing sellers
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="ts-card p-5 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-sm text-[var(--text)]">{title}</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4-Step Process */}
      <section id="how-it-works" className="ts-card p-6 sm:p-8 space-y-6">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--primary)]">4 Simple Steps</span>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[var(--text)] mt-1">
            Go live in under 5 minutes
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s) => (
            <div key={s.num} className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-2">
              <span className="font-mono text-xs font-semibold text-[var(--primary)]">{s.num}</span>
              <h3 className="font-semibold text-sm text-[var(--text)]">{s.title}</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Seller Onboarding Form */}
      <section id="seller-onboarding" className="ts-card p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--primary)]">
            <ShieldCheck className="w-4 h-4" /> Instant Onboarding
          </div>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text)] mt-1">
            Register your seller account
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1 mb-6">
            Fill in your business &amp; pickup details below to unlock your Seller Hub immediately.
          </p>

          {!isAuthenticated ? (
            <div className="p-6 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-sm text-[var(--text)]">Sign in required</div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Log in or create a free ShopVerse account to register your store and list products.
                </p>
              </div>
              <div className="flex gap-2.5">
                <Link to="/login" className="ts-btn-primary !min-h-[40px] text-xs">Sign in</Link>
                <Link to="/register" className="ts-btn-secondary !min-h-[40px] text-xs">Create account</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Store / Display name *</label>
                  <input
                    required
                    maxLength={150}
                    className="input"
                    placeholder="e.g. Urban Craft India"
                    value={regForm.storeName}
                    onChange={(e) => setRegForm({ ...regForm, storeName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Business type *</label>
                  <ThemedSelect
                    value={regForm.businessType}
                    onChange={(val) => setRegForm({ ...regForm, businessType: val })}
                    options={BUSINESS_TYPES}
                    ariaLabel="Business type"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Mobile number *</label>
                  <input
                    required
                    inputMode="numeric"
                    className="input"
                    placeholder="10-digit Indian mobile (6–9...)"
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: sanitizePhone(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">GSTIN (optional)</label>
                  <input
                    maxLength={15}
                    className="input uppercase font-mono"
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    value={regForm.gstin}
                    onChange={(e) => setRegForm({ ...regForm, gstin: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '') })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Pickup address *</label>
                <input
                  required
                  maxLength={500}
                  className="input"
                  placeholder="Warehouse / shop / flat, street, landmark"
                  value={regForm.pickupAddress}
                  onChange={(e) => setRegForm({ ...regForm, pickupAddress: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">City *</label>
                  <input
                    required
                    className="input"
                    placeholder="e.g. Bengaluru"
                    value={regForm.city}
                    onChange={(e) => setRegForm({ ...regForm, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">State *</label>
                  <input
                    required
                    className="input"
                    placeholder="e.g. Karnataka"
                    value={regForm.state}
                    onChange={(e) => setRegForm({ ...regForm, state: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Pincode *</label>
                  <input
                    required
                    inputMode="numeric"
                    className="input font-mono"
                    placeholder="6-digit pincode"
                    value={regForm.pincode}
                    onChange={(e) => setRegForm({ ...regForm, pincode: sanitizePincode(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Bank account holder</label>
                  <input
                    className="input"
                    placeholder="Name as on bank account"
                    value={regForm.bankAccountHolder}
                    onChange={(e) => setRegForm({ ...regForm, bankAccountHolder: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1.5">Bank IFSC (optional)</label>
                  <input
                    maxLength={11}
                    className="input uppercase font-mono"
                    placeholder="e.g. HDFC0001234"
                    value={regForm.bankIfsc}
                    onChange={(e) => setRegForm({ ...regForm, bankIfsc: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '') })}
                  />
                </div>
              </div>

              {regError && <div className="alert alert-error !mb-0">{regError}</div>}

              <div className="pt-2">
                <button type="submit" disabled={regSubmitting} className="ts-btn-primary w-full sm:w-auto">
                  <Store className="w-4 h-4" />
                  {regSubmitting ? 'Activating store...' : 'Create Seller Account'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </PageTransition>
  )
}
