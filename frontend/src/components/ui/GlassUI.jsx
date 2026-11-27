import { useState, useRef, useEffect } from 'react'
import { Package, ChevronDown, Check } from 'lucide-react'

export function PageTransition({ children, className = '' }) {
  return (
    <div id="main-content" className={className}>
      {children}
    </div>
  )
}

export function GlassCard({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={`ts-card ${hover ? 'ts-card-link' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function GradientButton({ children, className = '', ...props }) {
  return (
    <button className={`ts-btn-primary ${className}`} {...props}>
      {children}
    </button>
  )
}

export function ProductImage({ src, alt, className = 'w-full h-full object-cover', iconSize = 'w-8 h-8' }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#ebebeb] dark:bg-[#1f2225] text-[#6b6b6b]">
        <Package className={iconSize} strokeWidth={1.5} />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt || 'Product photograph'}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`ts-photo ${className}`}
    />
  )
}

const STATUS_STYLE = {
  PENDING_PAYMENT:  'border-amber-600/40 text-amber-700 dark:text-amber-400',
  PAID:             'border-[#1a4be0]/40 text-[#1a4be0] dark:text-[#608eff]',
  CONFIRMED:        'border-[#1a4be0]/40 text-[#1a4be0] dark:text-[#608eff]',
  PACKED:           'border-[#0d7480]/40 text-[#0d7480] dark:text-[#38bdf8]',
  SHIPPED:          'border-[#0d7480]/40 text-[#0d7480] dark:text-[#38bdf8]',
  OUT_FOR_DELIVERY: 'border-[#0d7480]/40 text-[#0d7480] dark:text-[#38bdf8]',
  DELIVERED:        'border-[#0f7d45]/40 text-[#0f7d45] dark:text-emerald-400',
  CANCELLED:        'border-[#c62828]/40 text-[#c62828] dark:text-rose-400',
  EXPIRED:          'border-[#6b6b6b]/40 text-[#6b6b6b]',
  RETURN_REQUESTED: 'border-amber-600/40 text-amber-700 dark:text-amber-400',
  RETURN_APPROVED:  'border-[#1a4be0]/40 text-[#1a4be0] dark:text-[#608eff]',
  RETURN_REJECTED:  'border-[#c62828]/40 text-[#c62828] dark:text-rose-400',
  PICKUP_COMPLETED: 'border-[#0d7480]/40 text-[#0d7480]',
  REFUNDED:         'border-[#0f7d45]/40 text-[#0f7d45] dark:text-emerald-400',
}

export function StatusBadge({ status }) {
  const cls = STATUS_STYLE[status] || 'border-[#e5e5e5] text-[#6b6b6b]'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded font-mono text-[11px] font-medium uppercase tracking-wider border bg-[var(--bg)] ${cls}`}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  )
}

export function SkeletonCard({ className = 'h-72' }) {
  return <div className={`rounded-xl skeleton border border-[var(--border)] ${className}`} />
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="ts-card p-12 text-center flex flex-col items-center">
      {Icon && <Icon className="w-8 h-8 text-[var(--text-muted)] mb-3" strokeWidth={1.5} />}
      <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
      {description && <p className="text-sm text-[var(--text-muted)] mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function formatINR(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Reusable custom dropdown that always matches the active light/dark Sheet-and-Biro theme
 * (replaces inconsistent native OS <select> menus).
 */
export function ThemedSelect({ value, onChange, options = [], placeholder = 'Select...', ariaLabel, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const selected = options.find((o) => String(o.value) === String(value))

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 px-3.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--text)] text-sm font-medium text-[var(--text)] flex items-center justify-between gap-2 transition-colors"
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 min-w-full w-52 rounded-xl bg-[var(--bg)] border border-[var(--border)] shadow-xl py-1 z-40 max-h-72 overflow-y-auto"
        >
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value)
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                  isSelected
                    ? 'bg-[var(--surface)] text-[var(--primary)] font-semibold'
                    : 'text-[var(--text)] hover:bg-[var(--surface)]'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
