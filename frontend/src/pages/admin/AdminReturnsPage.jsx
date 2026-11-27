import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../api/axiosInstance'

const STATUS_COLORS = {
  RETURN_REQUESTED:  { bg: '#fef3c7', text: '#92400e', label: 'Requested' },
  RETURN_APPROVED:   { bg: '#d1fae5', text: '#065f46', label: 'Approved'  },
  RETURN_REJECTED:   { bg: '#fee2e2', text: '#991b1b', label: 'Rejected'  },
  PICKUP_COMPLETED:  { bg: '#dbeafe', text: '#1e40af', label: 'Pickup Done'},
  REFUNDED:          { bg: '#ede9fe', text: '#5b21b6', label: 'Refunded'  },
}

function formatINR(amount) {
  if (!amount) return '—'
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export default function AdminReturnsPage() {
  const [returns, setReturns]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState(null)   // return object being actioned
  const [action, setAction]     = useState('')      // 'approve' | 'reject' | 'pickup'
  const [adminNote, setAdminNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg]           = useState('')
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [aiLoading, setAiLoading]   = useState(false)

  const runAiAnalysis = useCallback(() => {
    setAiLoading(true)
    api.get('/admin/ai/returns-analysis')
      .then(({ data }) => setAiAnalysis(data))
      .catch(() => {})
      .finally(() => setAiLoading(false))
  }, [])

  const fetchReturns = useCallback(() => {
    setLoading(true)
    api.get('/admin/returns')
      .then(({ data }) => setReturns(data))
      .catch(() => setError('Failed to load returns'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchReturns(); runAiAnalysis() }, [fetchReturns, runAiAnalysis])

  const openModal = (ret, act) => {
    setSelected(ret)
    setAction(act)
    setAdminNote('')
    setMsg('')
  }

  const closeModal = () => {
    setSelected(null)
    setAction('')
    setAdminNote('')
  }

  const handleSubmit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      if (action === 'approve') {
        await api.patch(`/admin/returns/${selected.id}/approve`, { adminNote })
        setMsg('Return approved. Email sent to customer.')
      } else if (action === 'reject') {
        await api.patch(`/admin/returns/${selected.id}/reject`, { adminNote })
        setMsg('Return rejected. Email sent to customer.')
      } else if (action === 'pickup') {
        await api.patch(`/admin/returns/${selected.id}/pickup-completed`)
        setMsg('Pickup marked. Refund initiated. Email sent to customer.')
      }
      closeModal()
      fetchReturns()
    } catch (err) {
      setMsg(err.response?.data?.message || 'Action failed')
    } finally {
      setSubmitting(false)
    }
  }

  const pending  = returns.filter(r => r.returnStatus === 'RETURN_REQUESTED')
  const approved = returns.filter(r => r.returnStatus === 'RETURN_APPROVED')
  const others   = returns.filter(r => !['RETURN_REQUESTED', 'RETURN_APPROVED'].includes(r.returnStatus))

  return (
    <AdminLayout title="↩️ Returns & Refunds">
      {msg && (
        <div className="alert alert-success mb-2" onClick={() => setMsg('')} style={{ cursor: 'pointer' }}>
          {msg} (click to dismiss)
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div className="loading-center"><div className="spinner" /></div>}

      {!loading && (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Pending Review', count: pending.length,  color: '#fef3c7' },
              { label: 'Awaiting Pickup', count: approved.length, color: '#d1fae5' },
              { label: 'Completed',       count: others.length,   color: '#ede9fe' },
            ].map(s => (
              <div key={s.label} className="card" style={{ flex: 1, minWidth: 140, background: s.color, textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{s.count}</div>
                <div style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* #7 AI Return-Reason Analyzer & Risk Flagging */}
          <div className="ts-card p-5 mb-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--primary)]">
                  AI Operations Intelligence
                </div>
                <h3 className="text-base font-semibold text-[var(--text)]">
                  Return-Reason Analyzer &amp; Risk Flagging
                </h3>
              </div>
              <button
                type="button"
                onClick={runAiAnalysis}
                disabled={aiLoading}
                className="ts-btn-secondary !min-h-[34px] !px-3 text-xs"
              >
                {aiLoading ? 'Analyzing...' : 'Refresh AI Analysis'}
              </button>
            </div>

            {aiAnalysis ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5 p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-3">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    AI Summary
                  </div>
                  <div className="text-xs sm:text-sm text-[var(--text)] whitespace-pre-line leading-relaxed">
                    {aiAnalysis.aiSummary}
                  </div>
                </div>

                <div className="lg:col-span-3 p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-2.5">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    Reason Clusters
                  </div>
                  {Object.entries(aiAnalysis.clusters || {}).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text)] truncate pr-2">{label}</span>
                      <span className="font-mono font-semibold text-[var(--primary)] tabular">{count}</span>
                    </div>
                  ))}
                </div>

                <div className="lg:col-span-4 p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-2.5">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    Flagged Risk Accounts ({aiAnalysis.flaggedAccounts?.length || 0})
                  </div>
                  {!aiAnalysis.flaggedAccounts || aiAnalysis.flaggedAccounts.length === 0 ? (
                    <div className="text-xs text-[var(--text-muted)]">No unusual return or cancellation patterns detected.</div>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto">
                      {aiAnalysis.flaggedAccounts.map((acc) => (
                        <div key={acc.userId} className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[var(--text)] truncate">{acc.name}</span>
                            <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                              acc.riskLevel === 'HIGH'
                                ? 'border-[var(--danger)] text-[var(--danger)]'
                                : 'border-amber-500 text-amber-600 dark:text-amber-400'
                            }`}>
                              {acc.riskLevel}
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{acc.flagReason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)]">Loading AI returns analysis...</div>
            )}
          </div>

          {/* Pending */}
          {pending.length > 0 && (
            <Section title="🔔 Pending Review" returns={pending} openModal={openModal} />
          )}

          {/* Approved / Awaiting Pickup */}
          {approved.length > 0 && (
            <Section title="📦 Awaiting Pickup" returns={approved} openModal={openModal} />
          )}

          {/* Others (rejected / refunded) */}
          {others.length > 0 && (
            <Section title="✅ Completed / Rejected" returns={others} openModal={openModal} />
          )}

          {returns.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
              No return requests yet.
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>
                {action === 'approve' ? '✅ Approve Return' :
                 action === 'reject'  ? '❌ Reject Return'  : '📦 Mark Pickup Completed'}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={closeModal}>✕</button>
            </div>

            <div style={{ marginBottom: '1rem', background: 'var(--surface-2)', borderRadius: 8, padding: '1rem' }}>
              <div><strong>Order:</strong> {selected.orderNumber}</div>
              <div><strong>Customer:</strong> {selected.customerName} ({selected.customerEmail})</div>
              <div><strong>Reason:</strong> {selected.reason}</div>
              <div><strong>Condition:</strong> {selected.itemCondition}</div>
              <div><strong>Amount:</strong> {formatINR(selected.refundAmount) !== '—' ? formatINR(selected.refundAmount) : 'Full order total'}</div>
            </div>

            {action !== 'pickup' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '.5rem' }}>
                  Admin Note {action === 'reject' ? '(required — explain rejection reason)' : '(optional)'}
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  placeholder={action === 'approve'
                    ? 'e.g. Return approved. Courier will contact you within 24 hours.'
                    : 'e.g. Item is not eligible for return as per our policy.'}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            )}

            {action === 'pickup' && (
              <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                This will mark the item as picked up and <strong>automatically initiate a Razorpay refund</strong> for the full order amount. An email will be sent to the customer.
              </div>
            )}

            {msg && <div className="alert alert-error mb-1">{msg}</div>}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className={`btn w-full ${action === 'reject' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleSubmit}
                disabled={submitting || (action === 'reject' && !adminNote.trim())}
              >
                {submitting ? 'Processing...' :
                 action === 'approve' ? 'Approve & Notify Customer' :
                 action === 'reject'  ? 'Reject & Notify Customer'  : 'Mark Pickup & Initiate Refund'}
              </button>
              <button className="btn btn-secondary w-full" onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

function Section({ title, returns, openModal }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {returns.map(r => <ReturnCard key={r.id} ret={r} openModal={openModal} />)}
      </div>
    </div>
  )
}

function ReturnCard({ ret, openModal }) {
  const badge = STATUS_COLORS[ret.returnStatus] || { bg: '#f3f4f6', text: '#374151', label: ret.returnStatus }
  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{ret.orderNumber}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>{ret.customerName} &bull; {ret.customerEmail}</div>
        <div style={{ marginTop: '.4rem' }}>
          <strong>Reason:</strong> {ret.reason}
        </div>
        <div><strong>Condition:</strong> {ret.itemCondition?.replace('_', ' ')}</div>
        {ret.adminNote && <div style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}><strong>Admin note:</strong> {ret.adminNote}</div>}
        {ret.razorpayRefundId && (
          <div style={{ fontSize: '.8rem', color: '#5b21b6', marginTop: '.3rem' }}>
            Refund ID: <code>{ret.razorpayRefundId}</code> &bull; {formatINR(ret.refundAmount)}
          </div>
        )}
        <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>
          Requested: {formatDate(ret.createdAt)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '.5rem' }}>
        <span style={{
          background: badge.bg, color: badge.text,
          padding: '.25rem .75rem', borderRadius: 999, fontSize: '.8rem', fontWeight: 700,
        }}>
          {badge.label}
        </span>

        {ret.returnStatus === 'RETURN_REQUESTED' && (
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button className="btn btn-primary btn-sm" onClick={() => openModal(ret, 'approve')}>Approve</button>
            <button className="btn btn-danger btn-sm" onClick={() => openModal(ret, 'reject')}>Reject</button>
          </div>
        )}
        {ret.returnStatus === 'RETURN_APPROVED' && (
          <button className="btn btn-primary btn-sm" onClick={() => openModal(ret, 'pickup')}>
            Mark Pickup Done
          </button>
        )}
      </div>
    </div>
  )
}

