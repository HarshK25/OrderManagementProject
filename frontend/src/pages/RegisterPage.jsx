import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { Mail, ArrowLeft, ShieldCheck } from 'lucide-react'
import { PageTransition } from '../components/ui/GlassUI'
import BrandLogo from '../components/BrandLogo'
import { validateEmail, extractApiError } from '../utils/validation'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('details') // 'details' | 'verify'
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [otp, setOtp] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setNotice('')

    const errs = {}
    if (form.name.trim().length < 2) errs.name = 'Enter your full name (at least 2 characters).'
    const emailErr = validateEmail(form.email)
    if (emailErr) errs.email = emailErr
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters.'

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/register/send-otp', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
      setNotice(data.message || 'Confirmation code sent to your email.')
      setStep('verify')
    } catch (err) {
      setError(extractApiError(err, 'Could not send confirmation email.'))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit confirmation code sent to your email.')
      return
    }

    setLoading(true)
    try {
      await axios.post('/api/auth/register/verify-otp', {
        email: form.email.trim().toLowerCase(),
        otp: otp.trim(),
      })
      navigate('/login', {
        state: { message: 'Email confirmed & account created! Sign in to continue.' },
      })
    } catch (err) {
      setError(extractApiError(err, 'Invalid confirmation code.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4 sm:px-6 py-10">
      <div className="ts-card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 pb-5 border-b border-[var(--border)]">
          <Link to="/"><BrandLogo size="md" /></Link>
        </div>
        {step === 'details' ? (
          <>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">Create account</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1 mb-6">
              Save addresses, track dispatches, and download invoices. We&apos;ll email a 6-digit code to confirm your address.
            </p>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSendOtp} noValidate className="space-y-4">
              <div className="form-group">
                <label htmlFor="name">Full name</label>
                <input id="name" name="name" value={form.name} onChange={handleChange} placeholder="Full name" maxLength={100} className="input" />
                {fieldErrors.name && <p className="text-xs text-[var(--danger)] mt-1">{fieldErrors.name}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="reg-email">Email</label>
                <input id="reg-email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@gmail.com" className="input" />
                {fieldErrors.email && <p className="text-xs text-[var(--danger)] mt-1">{fieldErrors.email}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="reg-password">Password</label>
                <input id="reg-password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="At least 8 characters" className="input" />
                {fieldErrors.password && <p className="text-xs text-[var(--danger)] mt-1">{fieldErrors.password}</p>}
              </div>
              <button type="submit" className="ts-btn-primary w-full" disabled={loading}>
                <Mail className="w-4 h-4" />
                {loading ? 'Sending confirmation email...' : 'Send confirmation code'}
              </button>
            </form>

            <p className="text-sm text-[var(--text-muted)] mt-6">
              Already have an account? <Link to="/login" className="ts-link">Sign in</Link>
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { setStep('details'); setError(''); setNotice('') }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Edit details
            </button>

            <div className="w-10 h-10 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)] mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">Confirm your email</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1 mb-5">
              Enter the 6-digit verification code we emailed to <strong className="text-[var(--text)]">{form.email}</strong>.
            </p>

            {notice && <div className="alert alert-success">{notice}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleVerifyOtp} noValidate className="space-y-4">
              <div className="form-group">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="reg-otp" className="!mb-0">Confirmation code</label>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSendOtp}
                    className="text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    Resend code
                  </button>
                </div>
                <input
                  id="reg-otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="input font-mono text-center text-lg tracking-[0.3em]"
                />
              </div>

              <button type="submit" className="ts-btn-primary w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & create account'}
              </button>
            </form>
          </>
        )}
      </div>
    </PageTransition>
  )
}
