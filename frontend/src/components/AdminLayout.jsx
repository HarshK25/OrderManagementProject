import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BarChart3, Package, ShoppingCart, RotateCcw, Users, Ticket, ShieldCheck, Store,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import BrandLogo from './BrandLogo'

const ADMIN_LINKS = [
  { to: '/admin/analytics',  label: 'Analytics & AI',   icon: BarChart3 },
  { to: '/admin/orders',     label: 'Orders',           icon: ShoppingCart },
  { to: '/admin/products',   label: 'Products & stock', icon: Package },
  { to: '/admin/returns',    label: 'Returns',          icon: RotateCcw },
  { to: '/admin/coupons',    label: 'Coupons',          icon: Ticket },
  { to: '/admin/users',      label: 'Customers',        icon: Users },
  { to: '/admin/sellers',    label: 'Sellers',          icon: Store },
  { to: '/admin/audit-logs', label: 'Audit log',        icon: ShieldCheck },
]

export default function AdminLayout({ children, title, subtitle, actions }) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div id="main-content" className="flex min-h-[calc(100vh-4rem)] bg-[var(--bg)]">
      <aside className={`hidden lg:flex flex-col shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-3 transition-all duration-200 ${collapsed ? 'w-[72px]' : 'w-60'}`}>
        <div className="flex items-center justify-between px-2 py-2 mb-3 border-b border-[var(--border)] pb-3">
          <Link to="/admin/analytics" aria-label="ShopVerse Admin">
            <BrandLogo size="sm" showWordmark={!collapsed} subtitle={collapsed ? '' : 'Admin'} />
          </Link>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)]"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <nav aria-label="Admin sections" className="flex flex-col gap-1">
          {ADMIN_LINKS.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--bg)] text-[var(--primary)] border border-[var(--border)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)]/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="flex-1 p-6 sm:p-10 overflow-x-hidden">
        <div className="max-w-[1140px] mx-auto">
          <div className="flex lg:hidden gap-1.5 overflow-x-auto pb-4 mb-4">
            {ADMIN_LINKS.map(({ to, label }) => {
              const active = location.pathname === to
              return (
                <Link key={to} to={to} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border ${active ? 'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
                  {label}
                </Link>
              )
            })}
          </div>

          {(title || actions) && (
            <div className="flex flex-wrap items-end justify-between gap-4 pb-6 mb-8 border-b border-[var(--border)]">
              <div>
                {title && <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.035em] text-[var(--text)]">{title}</h1>}
                {subtitle && <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>}
              </div>
              {actions && <div className="flex items-center gap-2.5">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}
