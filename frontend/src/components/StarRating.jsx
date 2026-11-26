/**
 * Reusable star rating display component.
 * Shows filled/half/empty stars based on a numeric rating (0–5).
 */
export function StarDisplay({ rating, count, size = '1rem', showCount = true }) {
  const r = Number(rating) || 0

  const stars = Array.from({ length: 5 }, (_, i) => {
    const filled = r >= i + 1
    const half   = !filled && r >= i + 0.5
    return { filled, half }
  })

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.25rem' }}>
      <span style={{ display: 'inline-flex', gap: '1px' }}>
        {stars.map((s, i) => (
          <span key={i} style={{ fontSize: size, lineHeight: 1 }}>
            {s.filled ? (
              <span style={{ color: '#f59e0b' }}>★</span>
            ) : s.half ? (
              <span style={{ color: '#f59e0b', opacity: 0.6 }}>★</span>
            ) : (
              <span style={{ color: '#d1d5db' }}>★</span>
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
 * Interactive star picker for submitting a rating.
 */
export function StarPicker({ value, onChange, size = '1.8rem' }) {
  return (
    <span style={{ display: 'inline-flex', gap: '4px', cursor: 'pointer' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          onClick={() => onChange(star)}
          style={{ fontSize: size, color: star <= value ? '#f59e0b' : '#d1d5db', lineHeight: 1, userSelect: 'none' }}
        >
          ★
        </span>
      ))}
    </span>
  )
}

