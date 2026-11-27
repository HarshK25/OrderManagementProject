import { createContext, useContext, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Info, X, ShoppingCart, ArrowRight } from 'lucide-react'

const ToastContext = createContext(null)

/**
 * Helper to broadcast immediate cart badge updates to Navbar & MobileBottomNav.
 * Pass CartResponse (with totalItems or items[]) or omit to trigger a fresh /cart fetch.
 */
export function notifyCartUpdated(cartData) {
  let totalItems = null
  if (cartData) {
    if (typeof cartData.totalItems === 'number') {
      totalItems = cartData.totalItems
    } else if (Array.isArray(cartData.items)) {
      totalItems = cartData.items.reduce((acc, i) => acc + (i.quantity || 1), 0)
    }
  }
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: { totalItems } }))
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random()
    const duration = options.actionTo ? 5200 : 3800
    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
        type,
        actionLabel: options.actionLabel || null,
        actionTo: options.actionTo || null,
      },
    ])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-5 md:bottom-6 z-[60] flex flex-col gap-2 sm:max-w-sm sm:w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex flex-col gap-2.5 px-4 py-3.5 rounded-xl shadow-2xl border bg-[var(--bg)] border-[var(--border)] text-[var(--text)] transition-all"
          >
            <div className="flex items-start gap-3">
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[var(--success)] shrink-0 mt-0.5" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-[var(--danger)] shrink-0 mt-0.5" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-[var(--primary)] shrink-0 mt-0.5" />}
              <span className="text-sm font-medium flex-1 leading-snug">{t.message}</span>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss notification"
                className="text-[var(--text-muted)] hover:text-[var(--text)] shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {t.actionTo && t.actionLabel && (
              <div className="flex items-center justify-end pl-8">
                <Link
                  to={t.actionTo}
                  onClick={() => removeToast(t.id)}
                  className="ts-btn-primary !min-h-[34px] !px-3.5 text-xs w-full sm:w-auto"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>{t.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
