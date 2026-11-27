import { useState } from 'react'

const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
}

/**
 * Reusable star rating display component.
 * Shows filled/half/empty stars based on a numeric rating (0–5).
 */
export function StarDisplay({ rating, count, size = '1rem', showCount = true }) {
  const r = Number(rating) || 0

  const stars = Array.from({ length: 5 }, (_, i) => {
    const filled = r >= i + 1
    const half = !filled && r >= i + 0.5
    return { filled, half }
  })

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.25rem' }}>
      <span style={{ display: 'inline-flex', gap: '2px' }} aria-label={`${r.toFixed(1)} out of 5 stars`}>
        {stars.map((s, i) => (
          <span key={i} style={{ fontSize: size, lineHeight: 1 }}>
            {s.filled ? (
              <span style={{ color: '#f59e0b' }}>★</span>
            ) : s.half ? (
              <span style={{ color: '#f59e0b', opacity: 0.6 }}>★</span>
            ) : (
              <span style={{ color: 'var(--border)' }}>★</span>
            )}
          </span>
        ))}
      </span>
      {showCount && count != null && (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '2px' }}>
          {r > 0 ? r.toFixed(1) : ''} {count > 0 ? `(${count})` : '(No reviews)'}
        </span>
      )}
    </span>
  )
}

/**
 * Interactive star picker with hover preview, keyboard focus, and rating label.
 */
export function StarPicker({ value = 5, onChange, size = '2rem' }) {
  const [hovered, setHovered] = useState(0)
  const active = hovered || Number(value) || 0

  return (
    <div className="inline-flex items-center gap-3 flex-wrap">
      <div
        role="radiogroup"
        aria-label="Select star rating"
        className="inline-flex items-center gap-1"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={Number(value) === star}
            aria-label={`${star} star${star > 1 ? 's' : ''} - ${RATING_LABELS[star]}`}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(0)}
            onClick={() => onChange(star)}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--bg)] active:scale-95 transition-transform cursor-pointer border-0 bg-transparent"
            style={{
              fontSize: size,
              color: star <= active ? '#f59e0b' : '#9ca3af',
              lineHeight: 1,
            }}
          >
            ★
          </button>
        ))}
      </div>
      {active > 0 && (
        <span className="font-mono text-xs font-medium text-[var(--text-muted)]">
          {active}/5 — {RATING_LABELS[active]}
        </span>
      )}
    </div>
  )
}
