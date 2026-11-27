import { useState, useEffect, useCallback } from 'react'
import { Store, CheckCircle2, Ban, Clock } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../api/axiosInstance'
import { useToast } from '../../context/ToastContext'

export default function AdminSellersPage() {
  const { toast } = useToast()
  const [sellers, setSellers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/admin/sellers')
      .then(({ data }) => setSellers(data || []))
      .catch(() => toast('Failed to load sellers', 'error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const changeStatus = async (sellerId, status) => {
    setBusyId(sellerId)
    try {
      await api.patch(`/admin/sellers/${sellerId}/status`, { status })
      toast(`Seller marked as ${status}`, 'success')
      load()
    } catch (err) {
      toast(err.response?.data?.message || 'Status update failed', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout
      title="Sellers"
      subtitle="Review registered storefronts, monitor listings, and manage seller status."
    >
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : sellers.length === 0 ? (
        <div className="ts-card p-12 text-center space-y-2">
          <Store className="w-8 h-8 mx-auto text-[var(--text-muted)]" strokeWidth={1.5} />
          <div className="font-semibold text-sm text-[var(--text)]">No sellers registered yet</div>
          <p className="text-xs text-[var(--text-muted)]">
            Sellers who register from the "Become a Seller" page will appear here.
          </p>
        </div>
      ) : (
        <div className="ts-card overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Store</th>
                <th>Owner</th>
                <th>Location &amp; GSTIN</th>
                <th>Listings</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="font-semibold text-[var(--text)]">{s.storeName}</div>
                    <div className="font-mono text-[11px] text-[var(--text-muted)]">{s.businessType}</div>
                  </td>
                  <td>
                    <div className="text-sm text-[var(--text)]">{s.ownerName}</div>
                    <div className="text-xs text-[var(--text-muted)]">{s.ownerEmail}</div>
                  </td>
                  <td>
                    <div className="text-xs text-[var(--text)]">{s.city}, {s.state} — {s.pincode}</div>
                    <div className="font-mono text-[11px] text-[var(--text-muted)]">{s.gstin || 'No GSTIN'}</div>
                  </td>
                  <td className="font-mono font-semibold tabular">{s.productCount}</td>
                  <td>
                    <span className={`badge ${
                      s.status === 'APPROVED' ? 'badge-delivered'
                        : s.status === 'SUSPENDED' || s.status === 'REJECTED' ? 'badge-cancelled'
                        : 'badge-pending'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {s.status !== 'APPROVED' && (
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => changeStatus(s.id, 'APPROVED')}
                          className="ts-btn-primary !min-h-[32px] !px-2.5 text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                      )}
                      {s.status !== 'SUSPENDED' && (
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => changeStatus(s.id, 'SUSPENDED')}
                          className="ts-btn-secondary !min-h-[32px] !px-2.5 text-xs text-[var(--danger)]"
                        >
                          <Ban className="w-3.5 h-3.5" /> Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
