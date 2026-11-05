const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function required(value, label) {
  if (value == null || String(value).trim() === '') return `${label} is required`
  return ''
}

export function emailError(value) {
  const missing = required(value, 'Email')
  if (missing) return missing
  if (!EMAIL_RE.test(String(value).trim())) return 'Enter a valid email address'
  return ''
}

export function passwordError(value) {
  if (!value || value.length < 8 || value.length > 128) return 'Use 8 to 128 characters'
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Include at least one letter and one number'
  return ''
}

export function phoneError(value, { required: must = false } = {}) {
  const text = String(value || '').trim()
  if (!text) return must ? 'Phone is required' : ''
  const compact = text.replace(/[\s\-()]+/g, '')
  const ok =
    /^\+254\d{9}$/.test(compact) ||
    /^254\d{9}$/.test(compact) ||
    /^0\d{9}$/.test(compact) ||
    /^[17]\d{8}$/.test(compact)
  return ok ? '' : 'Enter a Kenyan phone number'
}

export function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  if (value.startsWith('/admin')) return '/'
  return value
}
