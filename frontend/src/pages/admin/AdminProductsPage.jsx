import { useState, useEffect } from 'react'
import api from '../../api/axiosInstance'
import AdminLayout from '../../components/AdminLayout'

function formatINR(a) {
  return '₹' + Number(a).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

const EMPTY_PRODUCT = {
  name: '', description: '', categoryId: '', price: '',
  discountPercent: 0, stock: 0, imageUrl: '', active: true,
}

export default function AdminProductsPage() {
  const [products, setProducts]     = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [page, setPage]             = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Product form
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState(null) // null = create
  const [form, setForm]           = useState(EMPTY_PRODUCT)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  // Stock adjust
  const [stockProductId, setStockProductId] = useState(null)
  const [stockDelta, setStockDelta]         = useState(0)

  // Category form
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory]   = useState(false)

  const fetchProducts = () => {
    setLoading(true)
    api.get('/products', { params: { page, size: 15 } })
      .then(({ data }) => { setProducts(data.content); setTotalPages(data.totalPages) })
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoading(false))
  }

  const fetchCategories = () => {
    api.get('/categories').then(({ data }) => setCategories(data)).catch(() => {})
  }

  useEffect(() => { fetchProducts() }, [page])
  useEffect(() => { fetchCategories() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_PRODUCT)
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (p) => {
    setEditing(p.id)
    setForm({
      name: p.name, description: p.description || '',
      categoryId: p.categoryId || '',
      price: p.price, discountPercent: p.discountPercent,
      stock: p.stock, imageUrl: p.imageUrl || '', active: p.active,
    })
    setFormError('')
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        discountPercent: parseInt(form.discountPercent),
        stock: parseInt(form.stock),
        categoryId: parseInt(form.categoryId) || null,
      }
      if (editing) {
        await api.put(`/admin/products/${editing}`, payload)
      } else {
        await api.post('/admin/products', payload)
      }
      setShowForm(false)
      fetchProducts()
    } catch (err) {
      setFormError(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return
    try {
      await api.delete(`/admin/products/${id}`)
      fetchProducts()
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed')
    }
  }

  const handleStockAdjust = async (productId) => {
    try {
      await api.patch(`/admin/products/${productId}/stock`, { delta: parseInt(stockDelta) })
      setStockProductId(null)
      setStockDelta(0)
      fetchProducts()
    } catch (err) {
      alert(err.response?.data?.message || 'Stock update failed')
    }
  }

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    setAddingCategory(true)
    try {
      await api.post('/admin/categories', { name: newCategoryName.trim() })
      setNewCategoryName('')
      fetchCategories()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add category')
    } finally {
      setAddingCategory(false)
    }
  }

  return (
    <AdminLayout title="Products Management">
      {error && <div className="alert alert-error">{error}</div>}

      {/* Category quick-add */}
      <div className="card mb-2" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '.9rem' }}>Add Category:</span>
        <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '.75rem', flex: 1 }}>
          <input
            className="input"
            placeholder="Category name"
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            style={{ maxWidth: '250px' }}
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={addingCategory}>
            {addingCategory ? 'Adding...' : '+ Add'}
          </button>
        </form>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          {categories.map(c => (
            <span key={c.id} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: '20px', padding: '.2rem .75rem', fontSize: '.8rem', color: 'var(--text-muted)',
            }}>{c.name}</span>
          ))}
        </div>
      </div>

      <div className="flex-between mb-2">
        <span style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>{products.length} products</span>
        <button id="add-product-btn" className="btn btn-primary btn-sm" onClick={openCreate}>
          + New Product
        </button>
      </div>

      {/* Product form modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>{editing ? 'Edit Product' : 'New Product'}</h3>
            {formError && <div className="alert alert-error">{formError}</div>}
            <form onSubmit={handleSave}>
              {[['name','Name',true],['description','Description',false],['imageUrl','Image URL',false]].map(([field, label, required]) => (
                <div className="form-group" key={field}>
                  <label>{label}</label>
                  <input
                    className="input"
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    required={required}
                  />
                </div>
              ))}
              <div className="form-group">
                <label>Category</label>
                <select className="select" value={form.categoryId}
                  onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">-- Select --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Price (₹)</label>
                  <input className="input" type="number" step="0.01" min="0" value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Discount %</label>
                  <input className="input" type="number" min="0" max="90" value={form.discountPercent}
                    onChange={e => setForm(f => ({ ...f, discountPercent: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Initial Stock</label>
                <input className="input" type="number" min="0" value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexDirection: 'row', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                  Active (visible in catalog)
                </label>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products table */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>{p.categoryName || '—'}</td>
                  <td>
                    {formatINR(p.price)}
                    {p.discountPercent > 0 && (
                      <span style={{ color: 'var(--success)', fontSize: '.8rem', marginLeft: '.4rem' }}>
                        -{p.discountPercent}%
                      </span>
                    )}
                  </td>
                  <td>
                    {stockProductId === p.id ? (
                      <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          className="input"
                          style={{ width: '70px' }}
                          value={stockDelta}
                          onChange={e => setStockDelta(e.target.value)}
                          placeholder="±"
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => handleStockAdjust(p.id)}>✓</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setStockProductId(null)}>✕</button>
                      </div>
                    ) : (
                      <span
                        style={{ cursor: 'pointer', color: p.stock === 0 ? 'var(--danger)' : 'var(--text)' }}
                        onClick={() => { setStockProductId(p.id); setStockDelta(0) }}
                        title="Click to adjust stock"
                      >
                        {p.stock} 📝
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ color: p.active ? 'var(--success)' : 'var(--danger)' }}>
                      {p.active ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '.5rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ color: 'var(--text-muted)' }}>Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </AdminLayout>
  )
}
