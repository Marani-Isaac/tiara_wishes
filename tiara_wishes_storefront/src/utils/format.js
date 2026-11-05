export function money(value, currency = 'KES') {
  if (value == null || value === '') return '—'
  const amount = Number(value)
  if (Number.isNaN(amount)) return String(value)
  const formatted = new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  if (currency === 'KES') return `KSh ${formatted}`
  return `${currency} ${formatted}`
}

export function formatWhen(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nairobi',
  }).format(date)
}

export function formatDay(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeZone: 'Africa/Nairobi',
  }).format(date)
}

export function mediaUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const origin = import.meta.env.VITE_MEDIA_ORIGIN || ''
  return `${origin}${path}`
}

export function labelize(value) {
  if (value == null || value === '') return '—'
  return String(value).replaceAll('_', ' ')
}

export function validCompareAt(cash, compare) {
  const price = Number(cash)
  const was = Number(compare)
  if (!compare || Number.isNaN(price) || Number.isNaN(was)) return false
  return was > price
}

export function discountPercent(cash, compare) {
  if (!validCompareAt(cash, compare)) return null
  return Math.round((1 - Number(cash) / Number(compare)) * 100)
}

export function availabilityLabel(quantity) {
  const count = Number(quantity)
  if (!Number.isFinite(count) || count <= 0) return { text: 'Out of stock', tone: 'danger' }
  if (count < 5) return { text: 'Only a few left', tone: 'warn' }
  return { text: 'In stock', tone: 'ok' }
}

export function personName(person) {
  if (!person) return ''
  return [person.first_name, person.last_name].filter(Boolean).join(' ')
}

export function fieldError(error, name) {
  return error?.details?.[name] || ''
}

export function idempotencyKey() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return `tw-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function paymentProvider() {
  return (import.meta.env.VITE_PAYMENT_PROVIDER || 'mock').toLowerCase()
}
