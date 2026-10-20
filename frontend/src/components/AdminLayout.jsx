import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

const ADMIN_LINKS = [
  { to: '/admin/products', label: '📦 Products' },
  { to: '/admin/orders',   label: '🧾 Orders'   },
  { to: '/admin/users',    label: '👥 Users'    },
]

export default function AdminLayout({ children, title }) {
  const location = useLocation()
  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px', flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        padding: '1.5rem 1rem',
        display: 'flex', flexDirection: 'column', gap: '.5rem',
      }}>
        <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>
          ⚙️ Admin Panel
        </div>
        {ADMIN_LINKS.map(link => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              display: 'block',
              padding: '.6rem 1rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '.9rem',
              color: location.pathname === link.to ? 'var(--text)' : 'var(--text-muted)',
              background: location.pathname === link.to ? 'var(--surface-2)' : 'transparent',
              textDecoration: 'none',
              transition: 'all .15s',
            }}
          >
            {link.label}
          </Link>
        ))}
      </aside>

      {/* Content */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {title && <h1 style={{ marginBottom: '1.5rem' }}>{title}</h1>}
        {children}
      </main>
    </div>
  )
}
