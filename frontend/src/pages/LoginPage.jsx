import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import axios from 'axios'
import { Mail, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { PageTransition } from '../components/ui/GlassUI'
import BrandLogo from '../components/BrandLogo'
import { validateEmail, extractApiError } from '../utils/validation'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  // 'login' | 'forgot-email' | 'forgot-reset'
  const [mode, setMode] = useState('login')

  // Login state
  const [form, setForm] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.message || '')
  const [loading, setLoading] = useState(false)

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('')
  const [resetOtp, setResetOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')

    const errs = {}
    const emailErr = validateEmail(form.email)
    if (emailErr) errs.email = emailErr
    if (!form.password) errs.password = 'Password is required.'
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    setLoading(true)
    try {
      await login(form.email.trim().toLowerCase(), form.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(extractApiError(err, 'Sign in failed. Check your email and password.'))
    } finally {
      setLoading(false)
    }
  }

  const handleSendResetCode = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setNotice('')
    const emailErr = validateEmail(resetEmail)
    if (emailErr) { setError(emailErr); return }

    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/forgot-password', {
        email: resetEmail.trim().toLowerCase(),
      })
      setNotice(data.message || 'Reset code sent to your email.')
      setMode('forgot-reset')
    } catch (err) {
      setError(extractApiError(err, 'Could not send reset code.'))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!/^\d{6}$/.test(resetOtp.trim())) {
      setError('Enter the 6-digit verification code from your email.')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/reset-password', {
        email: resetEmail.trim().toLowerCase(),
        otp: resetOtp.trim(),
        newPassword,
      })
      setForm((prev) => ({ ...prev, email: resetEmail.trim().toLowerCase(), password: '' }))
      setResetOtp(''); setNewPassword(''); setConfirmPassword('')
      setNotice(data.message || 'Password updated! Sign in with your new password.')
      setMode('login')
    } catch (err) {
      setError(extractApiError(err, 'Could not reset password.'))
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
        {mode === 'login' && (
          <>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">Sign in</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1 mb-6">Enter your account credentials to continue.</p>

            {notice && (
              <div className="alert alert-success flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@gmail.com"
                  autoComplete="email"
                  className="input"
                />
                {fieldErrors.email && <p className="text-xs text-[var(--danger)] mt-1">{fieldErrors.email}</p>}
              </div>

              <div className="form-group">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="!mb-0">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(form.email)
                      setError('')
                      setNotice('')
                      setMode('forgot-email')
                    }}
                    className="text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Your password"
                  autoComplete="current-password"
                  className="input"
                />
                {fieldErrors.password && <p className="text-xs text-[var(--danger)] mt-1">{fieldErrors.password}</p>}
              </div>

              <button type="submit" className="ts-btn-primary w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="text-sm text-[var(--text-muted)] mt-6">
              New here? <Link to="/register" className="ts-link">Create an account</Link>
            </p>
          </>
        )}

        {mode === 'forgot-email' && (
          <>
            <button
              type="button"
              onClick={() => { setError(''); setNotice(''); setMode('login') }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </button>

            <div className="w-10 h-10 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)] mb-3">
              <Mail className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">Forgot password</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1 mb-6">
              Enter your registered email and we&apos;ll send a 6-digit security code to reset your password.
            </p>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSendResetCode} noValidate className="space-y-4">
              <div className="form-group">
                <label htmlFor="reset-email">Registered email</label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="input"
                />
              </div>
              <button type="submit" className="ts-btn-primary w-full" disabled={loading}>
                {loading ? 'Sending code...' : 'Send reset code'}
              </button>
            </form>
          </>
        )}

        {mode === 'forgot-reset' && (
          <>
            <button
              type="button"
              onClick={() => { setError(''); setNotice(''); setMode('forgot-email') }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Change email
            </button>

            <div className="w-10 h-10 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)] mb-3">
              <KeyRound className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">Reset password</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1 mb-5">
              Enter the 6-digit code sent to <strong className="text-[var(--text)]">{resetEmail}</strong>.
            </p>

            {notice && <div className="alert alert-success">{notice}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleResetPassword} noValidate className="space-y-4">
              <div className="form-group">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="reset-otp" className="!mb-0">6-digit code</label>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSendResetCode}
                    className="text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    Resend code
                  </button>
                </div>
                <input
                  id="reset-otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="input font-mono text-center text-lg tracking-[0.3em]"
                />
              </div>

              <div className="form-group">
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="input"
                />
              </div>

              <button type="submit" className="ts-btn-primary w-full" disabled={loading}>
                {loading ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </PageTransition>
  )
}
