import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  MapPin, Ticket, CreditCard, Banknote, Smartphone, Landmark, Truck, Plus, Check, X, ShoppingCart
} from 'lucide-react'
import api from '../api/axiosInstance'
import { useToast } from '../context/ToastContext'
import { PageTransition, EmptyState, ProductImage, formatINR } from '../components/ui/GlassUI'
import { sanitizePhone, sanitizePincode, validateAddressFields, extractApiError } from '../utils/validation'

const PAYMENT_METHODS = [
  { id: 'UPI', label: 'UPI (Razorpay)', icon: Smartphone },
  { id: 'CARD', label: 'Credit / Debit Card', icon: CreditCard },
  { id: 'NET_BANKING', label: 'Net Banking', icon: Landmark },
  { id: 'COD', label: 'Cash on Delivery', icon: Banknote },
]

const EMPTY_NEW_ADDR = {
  label: 'Home', recipientName: '', phone: '', addressLine: '', city: '', state: '', pincode: '', defaultAddress: true,
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [form, setForm] = useState({
    shippingName: '', shippingPhone: '', shippingAddress: '',
    shippingCity: '', shippingState: '', shippingPincode: '',
    paymentMethod: 'UPI', couponCode: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAddr, setNewAddr] = useState(EMPTY_NEW_ADDR)
  const [newAddrErrors, setNewAddrErrors] = useState({})
  const [savingAddr, setSavingAddr] = useState(false)
  const [saveEnteredAddress, setSaveEnteredAddress] = useState(false)

  const [cart, setCart] = useState(null)
  const [cartLoading, setCartLoading] = useState(true)
  const [couponInfo, setCouponInfo] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectAddress = (a) => {
    setSelectedAddressId(a.id)
    setFieldErrors({})
    setForm((prev) => ({
      ...prev,
      shippingName: a.recipientName || '',
      shippingPhone: sanitizePhone(a.phone),
      shippingAddress: a.addressLine || '',
      shippingCity: a.city || '',
      shippingState: a.state || '',
      shippingPincode: sanitizePincode(a.pincode),
    }))
  }

  useEffect(() => {
    api.get('/addresses')
      .then((r) => {
        const list = r.data || []
        setAddresses(list)
        if (list.length > 0) {
          const def = list.find((a) => a.defaultAddress) || list[0]
          selectAddress(def)
        }
      })
      .catch(() => {})

    api.get('/cart')
      .then((r) => setCart(r.data))
      .catch(() => {})
      .finally(() => setCartLoading(false))
  }, [])

  const cartItems = cart?.items || []
  const cartTotal = Number(cart?.totalAmount ?? 0)
  const couponDiscount = Number(couponInfo?.discount ?? 0)
  const finalPayable = Math.max(0, cartTotal - couponDiscount)

  const handleSaveNewAddress = async (e) => {
    e.preventDefault()
    const errs = validateAddressFields({
      name: newAddr.recipientName,
      phone: newAddr.phone,
      address: newAddr.addressLine,
      city: newAddr.city,
      state: newAddr.state,
      pincode: newAddr.pincode,
    })
    setNewAddrErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSavingAddr(true)
    try {
      const payload = {
        ...newAddr,
        recipientName: newAddr.recipientName.trim(),
        phone: sanitizePhone(newAddr.phone),
        addressLine: newAddr.addressLine.trim(),
        city: newAddr.city.trim(),
        state: newAddr.state.trim(),
        pincode: sanitizePincode(newAddr.pincode),
      }
      const { data: created } = await api.post('/addresses', payload)
      toast(`Saved "${created.label}" address`, 'success')
      setAddresses((prev) => [created, ...prev.map((a) => (created.defaultAddress ? { ...a, defaultAddress: false } : a))])
      selectAddress(created)
      setNewAddr(EMPTY_NEW_ADDR)
      setNewAddrErrors({})
      setShowAddForm(false)
    } catch (err) {
      toast(extractApiError(err, 'Could not save address'), 'error')
    } finally {
      setSavingAddr(false)
    }
  }

  const applyCoupon = async () => {
    const code = form.couponCode.trim().toUpperCase()
    if (!code) return
    if (cartTotal <= 0) {
      toast('Add items to cart before applying a coupon', 'error')
      return
    }
    try {
      const { data } = await api.get('/coupons/validate', {
        params: { code, amount: cartTotal },
      })
      setCouponInfo(data)
      setForm((prev) => ({ ...prev, couponCode: code }))
      toast(`Coupon ${data.code} applied — saved ${formatINR(data.discount)}`, 'success')
    } catch (err) {
      setCouponInfo(null)
      toast(extractApiError(err, 'Invalid coupon'), 'error')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    let nextVal = value
    if (name === 'shippingPhone') nextVal = sanitizePhone(value)
    if (name === 'shippingPincode') nextVal = sanitizePincode(value)
    if (name === 'couponCode') setCouponInfo(null)
    if (name !== 'couponCode' && name !== 'paymentMethod') setSelectedAddressId(null)

    setForm((prev) => ({ ...prev, [name]: nextVal }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (cartItems.length === 0) {
      setError('Your cart is empty. Add items before placing an order.')
      return
    }

    const errs = validateAddressFields({
      name: form.shippingName,
      phone: form.shippingPhone,
      address: form.shippingAddress,
      city: form.shippingCity,
      state: form.shippingState,
      pincode: form.shippingPincode,
    })
    if (Object.keys(errs).length > 0) {
      setFieldErrors({
        shippingName: errs.name,
        shippingPhone: errs.phone,
        shippingAddress: errs.address,
        shippingCity: errs.city,
        shippingState: errs.state,
        shippingPincode: errs.pincode,
      })
      toast('Please fix the highlighted shipping fields', 'error')
      return
    }

    setLoading(true)
    const cleanedPayload = {
      shippingName: form.shippingName.trim(),
      shippingPhone: sanitizePhone(form.shippingPhone),
      shippingAddress: form.shippingAddress.trim(),
      shippingCity: form.shippingCity.trim(),
      shippingState: form.shippingState.trim(),
      shippingPincode: sanitizePincode(form.shippingPincode),
      paymentMethod: form.paymentMethod,
      couponCode: couponInfo?.code || (form.couponCode.trim() ? form.couponCode.trim().toUpperCase() : null),
    }

    try {
      if (saveEnteredAddress && !selectedAddressId) {
        try {
          await api.post('/addresses', {
            label: 'Home',
            recipientName: cleanedPayload.shippingName,
            phone: cleanedPayload.shippingPhone,
            addressLine: cleanedPayload.shippingAddress,
            city: cleanedPayload.shippingCity,
            state: cleanedPayload.shippingState,
            pincode: cleanedPayload.shippingPincode,
            defaultAddress: addresses.length === 0,
          })
        } catch {}
      }

      const { data: order } = await api.post('/orders', cleanedPayload)
      if (form.paymentMethod === 'COD') {
        toast(`Order ${order.orderNumber} confirmed (Cash on Delivery)`, 'success')
        navigate(`/orders/${order.id}`)
      } else {
        navigate('/payment', { state: { orderId: order.id, orderNumber: order.orderNumber, total: order.total } })
      }
    } catch (err) {
      setError(extractApiError(err, 'Could not place order'))
    } finally {
      setLoading(false)
    }
  }

  if (!cartLoading && cartItems.length === 0) {
    return (
      <PageTransition className="max-w-[1240px] mx-auto px-6 py-12">
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Add products to your cart before proceeding to checkout."
          action={<button className="ts-btn-primary" onClick={() => navigate('/products')}>Browse catalog</button>}
        />
      </PageTransition>
    )
  }

  const FieldErr = ({ msg }) => msg ? <p className="text-xs text-[var(--danger)] mt-1">{msg}</p> : null

  return (
    <PageTransition className="max-w-[1240px] mx-auto px-6 py-10">
      <div className="pb-6 border-b border-[var(--border)] mb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[var(--text)]">Checkout</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Select a saved address or add a new one — details auto-fill below.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Saved Addresses Selector + Inline Add New Address */}
          <div className="ts-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--primary)]" />
                <h2 className="text-base font-semibold text-[var(--text)]">
                  Saved addresses {addresses.length > 0 && <span className="font-mono text-xs text-[var(--text-muted)]">({addresses.length})</span>}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddForm((v) => !v); setNewAddrErrors({}) }}
                className="ts-btn-secondary !min-h-[36px] !px-3 text-xs"
              >
                {showAddForm ? <><X className="w-3.5 h-3.5" /> Close</> : <><Plus className="w-3.5 h-3.5" /> Add new address</>}
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleSaveNewAddress} noValidate className="mb-5 p-4 rounded-lg bg-[var(--bg)] border border-[var(--border)] space-y-3">
                <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">New address</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select value={newAddr.label} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })} className="select">
                    <option value="Home">Home</option>
                    <option value="Work">Work</option>
                    <option value="Other">Other</option>
                  </select>
                  <div>
                    <input placeholder="Recipient name" maxLength={100} value={newAddr.recipientName} onChange={(e) => setNewAddr({ ...newAddr, recipientName: e.target.value })} className="input" />
                    <FieldErr msg={newAddrErrors.name} />
                  </div>
                  <div>
                    <input placeholder="10-digit mobile" inputMode="numeric" value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: sanitizePhone(e.target.value) })} className="input" />
                    <FieldErr msg={newAddrErrors.phone} />
                  </div>
                </div>
                <div>
                  <input placeholder="House / Flat, Street, Landmark" maxLength={500} value={newAddr.addressLine} onChange={(e) => setNewAddr({ ...newAddr, addressLine: e.target.value })} className="input" />
                  <FieldErr msg={newAddrErrors.address} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <input placeholder="City" maxLength={100} value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} className="input" />
                    <FieldErr msg={newAddrErrors.city} />
                  </div>
                  <div>
                    <input placeholder="State" maxLength={100} value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} className="input" />
                    <FieldErr msg={newAddrErrors.state} />
                  </div>
                  <div>
                    <input placeholder="6-digit pincode" inputMode="numeric" value={newAddr.pincode} onChange={(e) => setNewAddr({ ...newAddr, pincode: sanitizePincode(e.target.value) })} className="input" />
                    <FieldErr msg={newAddrErrors.pincode} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                    <input type="checkbox" checked={newAddr.defaultAddress} onChange={(e) => setNewAddr({ ...newAddr, defaultAddress: e.target.checked })} />
                    Set as default address
                  </label>
                  <button type="submit" disabled={savingAddr} className="ts-btn-primary !min-h-[38px] text-xs">
                    {savingAddr ? 'Saving...' : 'Save & use this address'}
                  </button>
                </div>
              </form>
            )}

            {addresses.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No saved addresses yet. Click <strong>Add new address</strong> above or enter your shipping details below.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {addresses.map((a) => {
                  const isSelected = selectedAddressId === a.id
                  return (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => selectAddress(a)}
                      className={`p-4 rounded-lg border text-left transition-colors relative ${
                        isSelected
                          ? 'border-[var(--primary)] bg-[var(--bg)] ring-1 ring-[var(--primary)]'
                          : 'border-[var(--border)] bg-[var(--bg)] hover:border-[var(--text)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[var(--text)]">{a.recipientName}</span>
                          <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">
                            {a.label}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2">{a.addressLine}</p>
                      <p className="text-xs text-[var(--text-muted)]">{a.city}, {a.state} — {a.pincode}</p>
                      <p className="font-mono text-[11px] text-[var(--text-muted)] mt-1">Phone: {a.phone}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Main Checkout Form */}
          <form onSubmit={handleSubmit} noValidate className="ts-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--text)]">Shipping details</h2>
              {selectedAddressId && (
                <span className="font-mono text-[11px] text-[var(--primary)]">Auto-filled from selected address</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="shipping-name" className="text-xs font-semibold text-[var(--text)] block mb-1.5">Full name</label>
                <input id="shipping-name" name="shippingName" maxLength={100} value={form.shippingName} onChange={handleChange} placeholder="Full name" className="input" />
                <FieldErr msg={fieldErrors.shippingName} />
              </div>
              <div>
                <label htmlFor="shipping-phone" className="text-xs font-semibold text-[var(--text)] block mb-1.5">Phone number</label>
                <input id="shipping-phone" name="shippingPhone" inputMode="numeric" value={form.shippingPhone} onChange={handleChange} placeholder="10-digit mobile (6–9...)" className="input" />
                <FieldErr msg={fieldErrors.shippingPhone} />
              </div>
            </div>

            <div>
              <label htmlFor="shipping-address" className="text-xs font-semibold text-[var(--text)] block mb-1.5">Address line</label>
              <input id="shipping-address" name="shippingAddress" maxLength={500} value={form.shippingAddress} onChange={handleChange} placeholder="House / flat, street, landmark" className="input" />
              <FieldErr msg={fieldErrors.shippingAddress} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="shipping-city" className="text-xs font-semibold text-[var(--text)] block mb-1.5">City</label>
                <input id="shipping-city" name="shippingCity" maxLength={100} value={form.shippingCity} onChange={handleChange} placeholder="City" className="input" />
                <FieldErr msg={fieldErrors.shippingCity} />
              </div>
              <div>
                <label htmlFor="shipping-state" className="text-xs font-semibold text-[var(--text)] block mb-1.5">State</label>
                <input id="shipping-state" name="shippingState" maxLength={100} value={form.shippingState} onChange={handleChange} placeholder="State" className="input" />
                <FieldErr msg={fieldErrors.shippingState} />
              </div>
              <div>
                <label htmlFor="shipping-pincode" className="text-xs font-semibold text-[var(--text)] block mb-1.5">Pincode</label>
                <input id="shipping-pincode" name="shippingPincode" inputMode="numeric" value={form.shippingPincode} onChange={handleChange} placeholder="6-digit pincode" className="input" />
                <FieldErr msg={fieldErrors.shippingPincode} />
              </div>
            </div>

            {!selectedAddressId && (
              <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                <input type="checkbox" checked={saveEnteredAddress} onChange={(e) => setSaveEnteredAddress(e.target.checked)} />
                Save this address to my Address Book for future orders
              </label>
            )}

            <div className="pt-4 border-t border-[var(--border)]">
              <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5 mb-2">
                <Ticket className="w-3.5 h-3.5" /> Promo code (WELCOME10 or FLAT200)
              </label>
              <div className="flex gap-2">
                <input name="couponCode" value={form.couponCode} onChange={handleChange} placeholder="Enter coupon code" className="input flex-1 uppercase" />
                <button type="button" onClick={applyCoupon} className="ts-btn-secondary shrink-0">
                  Apply
                </button>
              </div>
              {couponInfo && (
                <div className="text-xs font-semibold text-[#0f7d45] dark:text-emerald-400 mt-1.5">
                  {couponInfo.code} applied — saving {formatINR(couponInfo.discount)}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[var(--border)]">
              <label className="text-xs font-semibold text-[var(--text)] mb-2 block">Payment method</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setForm({ ...form, paymentMethod: id })}
                    className={`p-3 rounded-lg border text-left transition-colors flex flex-col gap-1.5 ${
                      form.paymentMethod === id
                        ? 'border-[var(--primary)] bg-[var(--bg)] text-[var(--primary)]'
                        : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] hover:border-[var(--text)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <Truck className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span>Dispatched within 24 hours &middot; Estimated delivery in 3–4 days &middot; Free shipping</span>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <button type="button" onClick={() => navigate('/cart')} className="ts-btn-secondary w-full sm:w-auto">
                Back to cart
              </button>
              <button id="place-order-btn" type="submit" disabled={loading || cartItems.length === 0} className="ts-btn-primary w-full sm:w-auto">
                {loading ? 'Placing order...' : form.paymentMethod === 'COD' ? `Confirm COD (${formatINR(finalPayable)})` : `Place order & pay ${formatINR(finalPayable)}`}
              </button>
            </div>
          </form>
        </div>

        {/* Live Order Summary */}
        <aside className="lg:col-span-4 ts-card p-6 lg:sticky lg:top-24 space-y-4">
          <h2 className="text-base font-semibold text-[var(--text)]">Order summary</h2>
          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {cartItems.map((item) => (
              <div key={item.cartItemId ?? item.productId} className="py-3 flex items-center justify-between gap-3 text-sm">
                <Link
                  to={`/products/${item.productId}`}
                  className="flex items-center gap-3 min-w-0 flex-1 group"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--surface-2)] border border-[var(--border)] shrink-0">
                    <ProductImage src={item.imageUrl} alt={item.productName} iconSize="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--text)] group-hover:text-[var(--primary)] group-hover:underline truncate transition-colors">
                      {item.productName}
                    </div>
                    <div className="font-mono text-xs text-[var(--text-muted)] tabular">
                      {item.quantity} × {formatINR(item.effectivePrice ?? item.price)}
                    </div>
                  </div>
                </Link>
                <span className="font-semibold tabular shrink-0">{formatINR(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Cart total</span>
              <span className="text-[var(--text)] tabular">{formatINR(cartTotal)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-[#0f7d45] dark:text-emerald-400">
                <span>Coupon ({couponInfo?.code})</span>
                <span className="tabular">- {formatINR(couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Shipping</span>
              <span className="font-mono text-xs text-[var(--text)]">FREE</span>
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-4 flex justify-between items-baseline">
            <span className="font-semibold">Total payable</span>
            <span className="text-2xl font-semibold tabular">{formatINR(finalPayable)}</span>
          </div>
        </aside>
      </div>
    </PageTransition>
  )
}
