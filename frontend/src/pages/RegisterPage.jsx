import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await axios.post('/api/auth/register', form)
      navigate('/login', { state: { message: 'Account created! Please log in.' } })
    } catch (err) {
      const msg = err.response?.data?.message
          || err.response?.data?.errors?.join(', ')
          || 'Registration failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Create Account</h1>
        <p style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Start shopping today</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              name="name"
              className="input"
              value={form.name}
              onChange={handleChange}
              placeholder="John Doe"
              required
              minLength={2}
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              name="email"
              type="email"
              className="input"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              name="password"
              type="password"
              className="input"
              value={form.password}
              onChange={handleChange}
              placeholder="Min 8 characters"
              required
              minLength={8}
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '.9rem' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
