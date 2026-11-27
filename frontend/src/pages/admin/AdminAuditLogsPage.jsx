import { useState, useEffect } from 'react'
import { ShieldCheck, Search } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../api/axiosInstance'

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [q, setQ] = useState('')

  useEffect(() => {
    api.get('/admin/audit-logs').then((r) => setLogs(r.data)).catch(() => {})
  }, [])

  const filtered = logs.filter((l) =>
    `${l.actorEmail} ${l.action} ${l.entityType} ${l.entityId} ${l.details}`.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <AdminLayout title="Audit Logs" subtitle="System, RabbitMQ event, and admin activity trail">
      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search actor, action, order number..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        />
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Action</th>
              <th className="px-5 py-3">Actor</th>
              <th className="px-5 py-3">Entity</th>
              <th className="px-5 py-3">Details</th>
              <th className="px-5 py-3">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-500">No audit logs recorded yet.</td></tr>
            ) : filtered.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-3 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> {l.action}
                </td>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{l.actorEmail}</td>
                <td className="px-5 py-3 text-xs text-slate-500">{l.entityType} #{l.entityId}</td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{l.details}</td>
                <td className="px-5 py-3 text-xs text-slate-400">{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  )
}
