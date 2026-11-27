import { useState, useEffect } from 'react'
import { MapPin, Plus, Trash2, Star } from 'lucide-react'
import api from '../api/axiosInstance'
import { useToast } from '../context/ToastContext'
import { PageTransition } from '../components/ui/GlassUI'
import { sanitizePhone, sanitizePincode, validateAddressFields, extractApiError } from '../utils/validation'

export default function AddressesPage() {
  const [addresses, setAddresses] = useState([])
  const [form, setForm] = useState({
    label: 'Home', recipientName: '', phone: '', addressLine: '', city: '', state: '', pincode: '', defaultAddress: true,
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = () => api.get('/addresses').then((r) => setAddresses(r.data || [])).catch(() => {})
  useEffect(load, [])

  const save = async (e) => {
    e.preventDefault()
    const errs = validateAddressFields({
      name: form.recipientName,
      phone: form.phone,
      address: form.addressLine,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
    })
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      await api.post('/addresses', {
        ...form,
        recipientName: form.recipientName.trim(),
        phone: sanitizePhone(form.phone),
        addressLine: form.addressLine.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: sanitizePincode(form.pincode),
      })
      toast('Address saved', 'success')
      setForm({ label: 'Home', recipientName: '', phone: '', addressLine: '', city: '', state: '', pincode: '', defaultAddress: false })
      setErrors({})
      load()
    } catch (err) {
      toast(extractApiError(err, 'Could not save address'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    await api.delete(`/addresses/${id}`)
    toast('Address deleted', 'info')
    load()
  }

  const Err = ({ msg }) => msg ? <p className="text-xs text-[var(--danger)] mt-1">{msg}</p> : null

  return (
    <PageTransition className="max-w-[1240px] mx-auto px-6 py-10">
      <div className="pb-6 border-b border-[var(--border)] mb-8 flex items-center gap-3">
        <MapPin className="w-5 h-5 text-[var(--primary)]" />
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[var(--text)]">Address book</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form onSubmit={save} noValidate className="lg:col-span-5 ts-card p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--text)]">Add new address</h2>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="select">
              <option value="Home">Home</option>
              <option value="Work">Work</option>
              <option value="Other">Other</option>
            </select>
            <div>
              <input placeholder="Recipient name" maxLength={100} value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} className="input" />
              <Err msg={errors.name} />
            </div>
          </div>
          <div>
            <input placeholder="10-digit mobile (6–9...)" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: sanitizePhone(e.target.value) })} className="input" />
            <Err msg={errors.phone} />
          </div>
          <div>
            <input placeholder="House / flat, street, landmark" maxLength={500} value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} className="input" />
            <Err msg={errors.address} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <input placeholder="City" maxLength={100} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" />
              <Err msg={errors.city} />
            </div>
            <div>
              <input placeholder="State" maxLength={100} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="input" />
              <Err msg={errors.state} />
            </div>
            <div>
              <input placeholder="6-digit pincode" inputMode="numeric" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: sanitizePincode(e.target.value) })} className="input" />
              <Err msg={errors.pincode} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
            <input type="checkbox" checked={form.defaultAddress} onChange={(e) => setForm({ ...form, defaultAddress: e.target.checked })} />
            Set as default shipping address
          </label>
          <button type="submit" disabled={saving} className="ts-btn-primary w-full">
            <Plus className="w-4 h-4" /> {saving ? 'Saving...' : 'Save address'}
          </button>
        </form>

        <div className="lg:col-span-7 space-y-3">
          {addresses.length === 0 ? (
            <div className="ts-card p-8 text-center text-sm text-[var(--text-muted)]">
              No saved addresses yet.
            </div>
          ) : addresses.map((a) => (
            <div key={a.id} className="ts-card p-5 flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text)]">{a.recipientName}</span>
                  <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">{a.label}</span>
                  {a.defaultAddress && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase px-2 py-0.5 rounded border border-[var(--primary)] text-[var(--primary)]">
                      <Star className="w-3 h-3" /> Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-muted)] mt-1">{a.addressLine}</p>
                <p className="text-sm text-[var(--text-muted)]">{a.city}, {a.state} — {a.pincode}</p>
                <p className="font-mono text-xs text-[var(--text-muted)] mt-1">Phone: {a.phone}</p>
              </div>
              <button onClick={() => remove(a.id)} aria-label="Delete address" className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg)]">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  )
}
