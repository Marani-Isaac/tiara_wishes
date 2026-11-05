const ACCOUNTS = [
  { key: 'contact_phone', label: 'Call', icon: 'phone', kind: 'phone' },
  { key: 'contact_whatsapp', label: 'WhatsApp', icon: 'whatsapp', kind: 'whatsapp' },
  { key: 'social_facebook', label: 'Facebook', icon: 'facebook', kind: 'link' },
  { key: 'social_instagram', label: 'Instagram', icon: 'instagram', kind: 'link' },
  { key: 'social_tiktok', label: 'TikTok', icon: 'tiktok', kind: 'link' },
  { key: 'social_youtube', label: 'YouTube', icon: 'youtube', kind: 'link' },
]

function accountHref(kind, value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (kind === 'phone') return `tel:${raw.replace(/[^\d+]/g, '')}`
  if (kind === 'whatsapp') {
    const digits = raw.replace(/\D/g, '')
    return digits ? `https://wa.me/${digits}` : ''
  }
  return /^https?:\/\//i.test(raw) ? raw : ''
}

export function socialAccounts(settings) {
  return ACCOUNTS.flatMap((account) => {
    const href = accountHref(account.kind, settings?.[account.key])
    return href ? [{ ...account, href, external: account.kind !== 'phone' }] : []
  })
}

export default function SocialAccounts({ settings, label }) {
  const accounts = socialAccounts(settings)
  if (!accounts.length) return null
  const row = (
    <div className="social-row">
      {accounts.map((account) => (
        <a
          key={account.key}
          className="social-icon"
          href={account.href}
          aria-label={account.label}
          {...(account.external ? { target: '_blank', rel: 'noreferrer' } : {})}
        >
          <SocialIcon name={account.icon} />
        </a>
      ))}
    </div>
  )
  if (!label) return row
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-3">{row}</div>
    </div>
  )
}

function SocialIcon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    'aria-hidden': true,
  }
  if (name === 'phone') {
    return (
      <svg {...common}>
        <path d="M7 3h3l1.5 4-2 1.5a12 12 0 0 0 6 6L17 13l4 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'whatsapp') {
    return (
      <svg {...common}>
        <path d="M5 19l1.2-3.4A8 8 0 1 1 8.4 18L5 19z" strokeLinejoin="round" />
        <path d="M9 10c.4 2 2.2 3.6 4.2 4" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'facebook') {
    return (
      <svg {...common}>
        <path d="M14 8h3V4h-3c-2.2 0-4 1.8-4 4v2H8v4h2v6h4v-6h3l1-4h-4V8c0-.6.4-1 1-1z" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'instagram') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <circle cx="12" cy="12" r="3.5" />
        <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (name === 'tiktok') {
    return (
      <svg {...common}>
        <path d="M14 5c.6 2.4 2.2 4 4.6 4.4V13c-1.7 0-3.2-.5-4.6-1.4V16a5 5 0 1 1-5-5c.3 0 .6 0 .9.1V14a2.2 2.2 0 1 0 1.6 2.1V5H14z" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M10 9.5V6.2A8 8 0 0 0 21 14v1.2a3.2 3.2 0 0 1-3.2 3.2h-.6A3.2 3.2 0 0 1 14 15.2V10" strokeLinejoin="round" />
      <path d="M10 15V9.5l7-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
