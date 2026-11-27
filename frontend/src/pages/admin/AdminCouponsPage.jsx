import { useState, useEffect } from 'react'
import { Plus, Trash2, Ticket } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../api/axiosInstance'
import { useToast } from '../../context/ToastContext'

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([])
  const [form, setForm] = useState({ code: '', discountType: 'PERCENTAGE', discountValue: 10, minOrderAmount: 500, maxDiscount: 500, usageLimit: 100 })
  const { toast } = useToast()

  const load = () => {
    api.get('/admin/coupons').then((r) => setCoupons(r.data)).catch(() => toast('Failed to load coupons', 'error'))
  }
  useEffect(load, [])

  const create = async (e) => {
    e.preventDefault()
    try {
      await api.post('/admin/coupons', form)
      toast(`Coupon ${form.code.toUpperCase()} created`, 'success')
      setForm({ code: '', discountType: 'PERCENTAGE', discountValue: 10, minOrderAmount: 500, maxDiscount: 500, usageLimit: 100 })
      load()
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to create coupon', 'error')
    }
  }

  const toggle = async (c) => {
    await api.patch(`/admin/coupons/${c.id}/toggle?active=${!c.active}`)
    toast(`Coupon ${c.code} ${!c.active ? 'activated' : 'deactivated'}`, 'info')
    load()
  }

  const remove = async (id) => {
    await api.delete(`/admin/coupons/${id}`)
    toast('Coupon deleted', 'success')
    load()
  }

  return (
    <AdminLayout title="Coupon Management" subtitle="Create and manage promotional discount codes">
      <form onSubmit={create} className="rounded-2xl p-5 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
        <div>
          <label className="text-xs font-semibold text-slate-500">Code</label>
          <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SAVE20" className="w-full mt-1 px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Type</label>
          <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700">
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="FIXED">Fixed (₹)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Value</label>
          <input type="number" required value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Min Order (₹)</label>
          <input type="number" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Usage Limit</label>
          <input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700" />
        </div>
        <button type="submit" className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white">
          <Plus className="w-4 h-4" /> Create
        </button>
      </form>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Code</th>
              <th className="px-5 py-3">Discount</th>
              <th className="px-5 py-3">Min Order</th>
              <th className="px-5 py-3">Usage</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="px-5 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <Ticket className="w-4 h-4" /> {c.code}
                </td>
                <td className="px-5 py-3">{c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `₹${c.discountValue}`}</td>
                <td className="px-5 py-3">₹{c.minOrderAmount}</td>
                <td className="px-5 py-3">{c.usedCount} / {c.usageLimit || '∞'}</td>
                <td className="px-5 py-3">
                  <button onClick={() => toggle(c)} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {c.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => remove(c.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  )
}
