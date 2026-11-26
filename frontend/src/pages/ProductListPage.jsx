import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axiosInstance'
import { StarDisplay } from '../components/StarRating'

const SORT_OPTIONS = [
  { value: 'createdAt,desc', label: 'Newest First' },
  { value: 'price,asc',      label: 'Price: Low → High' },
  { value: 'price,desc',     label: 'Price: High → Low' },
  { value: 'name,asc',       label: 'Name A–Z' },
]

function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

function ProductCard({ product }) {
  const hasDiscount = product.discountPercent > 0
  const effectivePrice = hasDiscount
    ? product.price * (1 - product.discountPercent / 100)
    : product.price

  return (
    <Link to={`/products/${product.id}`} style={{ textDecoration: 'none' }}>
      <div className="product-card">
        {product.imageUrl
          ? <img className="product-card-img" src={product.imageUrl} alt={product.name} />
          : <div className="product-card-img" style={{ display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>No Image</div>
        }
        <div className="product-card-body">
          <div className="product-card-name">{product.name}</div>
          {product.categoryName && (
            <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
              {product.categoryName}
            </span>
          )}
          {product.avgRating > 0 && (
            <div style={{ marginTop: '.25rem' }}>
              <StarDisplay rating={product.avgRating} count={product.reviewCount} size=".82rem" />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem' }}>
            <span className="product-card-price">{formatINR(effectivePrice)}</span>
            {hasDiscount && (
              <>
                <span className="product-card-original">{formatINR(product.price)}</span>
                <span className="product-card-discount">-{product.discountPercent}%</span>
              </>
            )}
          </div>
          <div className="product-card-stock">
            {product.stock > 0
              ? `${product.stock} in stock`
              : <span style={{ color: 'var(--danger)' }}>Out of stock</span>
            }
          </div>
        </div>
        <div className="product-card-footer">
          <button className="btn btn-primary w-full btn-sm">View Details</button>
        </div>
      </div>
    </Link>
  )
}

export default function ProductListPage() {
  const [products, setProducts]     = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [page, setPage]             = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [filters, setFilters] = useState({
    q: '', category: '', minPrice: '', maxPrice: '', sort: 'createdAt,desc',
  })

  useEffect(() => {
    api.get('/categories')
      .then(({ data }) => setCategories(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    const params = { page, size: 12, sort: filters.sort }
    if (filters.q)        params.q        = filters.q
    if (filters.category) params.category = filters.category
    if (filters.minPrice) params.minPrice = filters.minPrice
    if (filters.maxPrice) params.maxPrice = filters.maxPrice

    api.get('/products', { params })
      .then(({ data }) => {
        const loaded = data.content
        setProducts(loaded)
        setTotalPages(data.totalPages)
        // Fetch bulk ratings and merge into product list
        if (loaded && loaded.length > 0) {
          const ids = loaded.map(p => p.id).join(',')
          api.get(`/products/reviews/summaries?ids=${ids}`)
            .then(({ data: ratings }) => {
              setProducts(prev => prev.map(p => ({
                ...p,
                avgRating:   ratings[p.id]?.avgRating   ?? 0,
                reviewCount: ratings[p.id]?.totalReviews ?? 0,
              })))
            })
            .catch(() => {}) // non-critical — ratings are enhancement only
        }
      })
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoading(false))
  }, [page, filters])

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setPage(0)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Browse Products</h1>
        <p>Discover our curated collection</p>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <input
          className="input"
          name="q"
          placeholder="🔍 Search products..."
          value={filters.q}
          onChange={handleFilterChange}
        />
        <select className="select" name="category" value={filters.category} onChange={handleFilterChange}>
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        <input
          className="input"
          name="minPrice"
          type="number"
          placeholder="Min Price"
          value={filters.minPrice}
          onChange={handleFilterChange}
          style={{ maxWidth: '120px' }}
        />
        <input
          className="input"
          name="maxPrice"
          type="number"
          placeholder="Max Price"
          value={filters.maxPrice}
          onChange={handleFilterChange}
          style={{ maxWidth: '120px' }}
        />
        <select className="select" name="sort" value={filters.sort} onChange={handleFilterChange}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <h3>No products found</h3>
          <p>Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid-4">
          {products.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              className={i === page ? 'active' : ''}
              onClick={() => setPage(i)}
            >
              {i + 1}
            </button>
          ))}
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  )
}
