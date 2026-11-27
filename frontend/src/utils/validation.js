/**
 * Sanitizes Indian mobile numbers:
 * - Strips spaces, dashes, parentheses, and non-digits
 * - Strips leading country code "91" (12 digits) or trunk "0" (11 digits)
 * - Caps at 10 digits
 */
export function sanitizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 10)
}

/** Digits-only 6-character Indian pincode */
export function sanitizePincode(raw) {
  return String(raw || '').replace(/\D/g, '').slice(0, 6)
}

/**
 * Validates shipping / address fields and returns a map of { fieldName: errorMessage }.
 * Empty object means valid.
 */
export function validateAddressFields({ name, phone, address, city, state, pincode }) {
  const errors = {}
  const cleanName = (name || '').trim()
  const cleanPhone = sanitizePhone(phone)
  const cleanAddress = (address || '').trim()
  const cleanCity = (city || '').trim()
  const cleanState = (state || '').trim()
  const cleanPin = sanitizePincode(pincode)

  if (cleanName.length < 2) errors.name = 'Enter recipient full name (at least 2 characters).'
  else if (cleanName.length > 100) errors.name = 'Name must be 100 characters or fewer.'

  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    errors.phone = 'Enter a valid 10-digit Indian mobile number starting with 6–9.'
  }

  if (cleanAddress.length < 5) errors.address = 'Enter a complete street / flat address (at least 5 characters).'
  else if (cleanAddress.length > 500) errors.address = 'Address must be 500 characters or fewer.'

  if (cleanCity.length < 2) errors.city = 'Enter a valid city name.'
  else if (cleanCity.length > 100) errors.city = 'City must be 100 characters or fewer.'

  if (cleanState.length < 2) errors.state = 'Enter a valid state name.'
  else if (cleanState.length > 100) errors.state = 'State must be 100 characters or fewer.'

  if (!/^[1-9]\d{5}$/.test(cleanPin)) {
    errors.pincode = 'Enter a valid 6-digit pincode (cannot start with 0).'
  }

  return errors
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/

const COMMON_DOMAIN_TYPOS = {
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
}

/**
 * Validates an email address strictly (format, TLD, no consecutive dots, typo check).
 * Returns an error string, or null if valid.
 */
export function validateEmail(raw) {
  const email = String(raw || '').trim().toLowerCase()
  if (!email) return 'Email address is required.'
  if (email.length > 254) return 'Email address is too long.'
  if (email.includes('..')) return 'Email cannot contain consecutive dots.'
  const [local, domain] = email.split('@')
  if (!local || !domain || local.startsWith('.') || local.endsWith('.')) {
    return 'Enter a valid email address (e.g. name@gmail.com).'
  }
  if (!EMAIL_REGEX.test(email)) {
    return 'Enter a valid email address with a valid domain (e.g. name@gmail.com).'
  }
  if (COMMON_DOMAIN_TYPOS[domain]) {
    return `Did you mean ${local}@${COMMON_DOMAIN_TYPOS[domain]}?`
  }
  return null
}

export function extractApiError(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.response?.data
  if (!data) return fallback
  if (Array.isArray(data.fieldErrors) && data.fieldErrors.length > 0) {
    return data.fieldErrors.map((f) => `${f.field}: ${f.message}`).join(' · ')
  }
  return data.message || fallback
}
