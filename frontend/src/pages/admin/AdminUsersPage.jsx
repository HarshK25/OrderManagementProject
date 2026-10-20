import { useState, useEffect } from 'react'
import api from '../../api/axiosInstance'
import AdminLayout from '../../components/AdminLayout'

/** Always displays in Indian Standard Time (IST, UTC+5:30) */
function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

export default function AdminUsersPage() {
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [actionLoading, setActionLoading] = useState(null)

  const fetchUsers = () => {
    setLoading(true)
    const params = { page, size: 20 }
    if (search.trim()) params.search = search.trim()
    api.get('/admin/users', { params })
      .then(({ data }) => { setUsers(data.content); setTotalPages(data.totalPages) })
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [page])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(0)
    fetchUsers()
  }

  const toggleBlock = async (user) => {
    const action = user.status === 'BLOCKED' ? 'unblock' : 'block'
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} user ${user.email}?`)) return
    setActionLoading(user.id + '-block')
    try {
      await api.patch(`/admin/users/${user.id}/${action}`)
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action} user`)
    } finally {
      setActionLoading(null)
    }
  }

  const deleteUser = async (user) => {
    if (!window.confirm(`Permanently delete user "${user.name}" (${user.email})?\nThis cannot be undone.`)) return
    setActionLoading(user.id + '-delete')
    try {
      await api.delete(`/admin/users/${user.id}`)
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <AdminLayout title="Users Management">
      {error && <div className="alert alert-error">{error}</div>}

      {/* Search */}
      <form onSubmit={handleSearch} className="filter-bar mb-2">
        <input
          className="input"
          placeholder="🔍 Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
        <button type="submit" className="btn btn-secondary btn-sm">Search</button>
        {search && (
          <button type="button" className="btn btn-secondary btn-sm"
            onClick={() => { setSearch(''); setPage(0); setTimeout(fetchUsers, 0) }}>
            Clear
          </button>
        )}
      </form>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 600 }}>{user.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>{user.email}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '.15rem .6rem',
                      borderRadius: '20px',
                      fontSize: '.75rem',
                      fontWeight: 700,
                      background: user.role === 'ADMIN' ? 'rgba(99,102,241,.2)' : 'rgba(148,163,184,.1)',
                      color: user.role === 'ADMIN' ? 'var(--primary)' : 'var(--text-muted)',
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '.15rem .6rem',
                      borderRadius: '20px',
                      fontSize: '.75rem',
                      fontWeight: 700,
                      background: user.status === 'ACTIVE'
                        ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
                      color: user.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {user.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                    {formatDate(user.createdAt)}
                  </td>
                  <td>
                    {user.role !== 'ADMIN' && (
                      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                        {/* Block / Unblock */}
                        <button
                          className={`btn btn-sm ${user.status === 'BLOCKED' ? 'btn-primary' : 'btn-secondary'}`}
                          disabled={actionLoading === user.id + '-block' || actionLoading === user.id + '-delete'}
                          onClick={() => toggleBlock(user)}
                        >
                          {actionLoading === user.id + '-block'
                            ? '...'
                            : user.status === 'BLOCKED' ? 'Unblock' : 'Block'
                          }
                        </button>

                        {/* Delete */}
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={actionLoading === user.id + '-delete' || actionLoading === user.id + '-block'}
                          onClick={() => deleteUser(user)}
                        >
                          {actionLoading === user.id + '-delete' ? '...' : 'Delete'}
                        </button>
                      </div>
                    )}
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
