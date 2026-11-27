/**
 * ShopVerse geometric brand mark + wordmark.
 * Styled to match the Sheet-and-Biro theme (--primary + --text).
 */
export default function BrandLogo({ size = 'md', showWordmark = true, inverted = false, subtitle = '' }) {
  const iconCls =
    size === 'sm' ? 'w-7 h-7' :
    size === 'lg' ? 'w-10 h-10' :
    'w-8 h-8'

  const textCls =
    size === 'sm' ? 'text-base' :
    size === 'lg' ? 'text-xl' :
    'text-lg'

  return (
    <span className="inline-flex items-center gap-2.5 shrink-0 select-none">
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconCls} shrink-0`}
        aria-hidden="true"
      >
        <rect width="64" height="64" rx="16" className="fill-[var(--primary)]" />
        <path
          d="M23 24V20C23 15.0294 27.0294 11 32 11C36.9706 11 41 15.0294 41 20V24"
          stroke="#FFFFFF"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <rect x="14" y="23" width="36" height="29" rx="7" fill="#FFFFFF" />
        <path
          d="M24 33L32 43L40 33"
          className="stroke-[var(--primary)]"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="44" cy="29" r="2.7" className="fill-[var(--primary)]" />
      </svg>

      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={`${textCls} font-bold tracking-[-0.035em] whitespace-nowrap ${
              inverted ? 'text-white' : 'text-[var(--text)]'
            }`}
          >
            Shop<span className="text-[var(--primary)]">Verse</span>
          </span>
          {subtitle && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-0.5">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
