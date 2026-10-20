import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Sticky top navbar with:
 *  - Brand logo link
 *  - Public links (Products)
 *  - Authenticated links (Cart, My Orders)
 *  - Admin link (Admin Panel)
 *  - Login / Logout button
 */
export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path) => location.pathname.startsWith(path) ? 'active' : ''

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">🛍️ OrderMS</Link>

        <div className="navbar-links">
          <Link to="/products" className={isActive('/products')}>Products</Link>
          {isAuthenticated && (
            <>
              <Link to="/cart" className={isActive('/cart')}>🛒 Cart</Link>
              <Link to="/orders" className={isActive('/orders')}>My Orders</Link>
            </>
          )}
          {isAdmin && (
            <Link to="/admin" className={isActive('/admin')}>⚙️ Admin</Link>
          )}
        </div>

        <div className="navbar-actions">
          {isAuthenticated ? (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>
                {user?.name}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="btn btn-secondary btn-sm">Login</button>
              </Link>
              <Link to="/register">
                <button className="btn btn-primary btn-sm">Register</button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
