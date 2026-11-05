export function labelize(value) {
  if (value == null || value === '') return '—'
  return String(value).replaceAll('_', ' ')
}

export function money(value, currency = 'KES') {
  if (value == null || value === '') return '—'
  const amount = Number(value)
  if (Number.isNaN(amount)) return `${currency} ${value}`
  try {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
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

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)
}

export function personName(person) {
  if (!person) return '—'
  const name = [person.first_name, person.last_name].filter(Boolean).join(' ')
  return name || person.email || '—'
}

export function readPage(params) {
  const page = Number(params.get('page') || '1')
  return Number.isInteger(page) && page > 0 ? page : 1
}

export function detailMessage(error, field) {
  return error?.details?.[field] || ''
}
