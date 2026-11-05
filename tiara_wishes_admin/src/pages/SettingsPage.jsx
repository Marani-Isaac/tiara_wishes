import { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '../api/settings'
import { ErrorState, FormField, LoadingState, PageHeader, SuccessNote } from '../components/common/States'

const TABS = [
  ['contact', 'Contact'],
  ['social', 'Social'],
  ['store', 'Store'],
]

const CONTACT_FIELDS = [
  ['contact_email', 'Contact email', 'email'],
  ['contact_phone', 'Phone number', 'tel'],
  ['contact_whatsapp', 'WhatsApp number', 'tel'],
]

const SOCIAL_FIELDS = [
  ['social_facebook', 'Facebook', 'facebook'],
  ['social_instagram', 'Instagram', 'instagram'],
  ['social_tiktok', 'TikTok', 'tiktok'],
  ['social_youtube', 'YouTube', 'youtube'],
]

const STORE_FIELDS = [
  ['currency', 'Currency code'],
  ['delivery_fee_kes', 'Flat delivery fee (KES)'],
  ['free_delivery_threshold_kes', 'Free delivery from (KES)'],
]

export default function SettingsPage() {
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('contact')

  useEffect(() => {
    getSettings()
      .then((body) => setValues(body.data || {}))
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = await updateSettings(values)
      setValues(body.data || values)
      setNotice(body.message || 'Settings updated')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState label="Loading settings" />

  return (
    <div>
      <PageHeader
        eyebrow="Store"
        title="Settings"
        description="Phone, WhatsApp, and social links are saved for the storefront footer. Social values must be full http or https links. Place delivery fees are set on Deliveries."
      />
      <SuccessNote>{notice}</SuccessNote>
      {error ? <div className="mb-4"><ErrorState error={error} /></div> : null}
      <form className="panel grid max-w-xl gap-3 p-4" onSubmit={save}>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Settings">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? 'btn btn-gold' : 'btn btn-ghost'}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'contact'
          ? CONTACT_FIELDS.map(([key, label, type]) => (
              <FormField key={key} id={key} label={label} hint="Shown with an icon in the storefront footer.">
                <input
                  id={key}
                  className="field"
                  type={type}
                  value={values[key] || ''}
                  onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                />
              </FormField>
            ))
          : null}
        {tab === 'social'
          ? SOCIAL_FIELDS.map(([key, label]) => (
              <FormField key={key} id={key} label={`${label} link`} hint="Leave blank to hide this icon. Use a full https link.">
                <input
                  id={key}
                  className="field"
                  inputMode="url"
                  placeholder="https://"
                  value={values[key] || ''}
                  onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                />
              </FormField>
            ))
          : null}
        {tab === 'store'
          ? STORE_FIELDS.map(([key, label]) => (
              <FormField key={key} id={key} label={label}>
                <input
                  id={key}
                  className="field"
                  value={values[key] || ''}
                  onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                />
              </FormField>
            ))
          : null}
        <FooterPreview values={values} />
        <button className="btn btn-gold" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  )
}

function FooterPreview({ values }) {
  const socials = SOCIAL_FIELDS.filter(([key]) => String(values[key] || '').trim())
  const phone = String(values.contact_phone || '').trim()
  const whatsapp = String(values.contact_whatsapp || '').trim()
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Footer preview</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {phone ? (
          <span className="inline-flex items-center gap-2 text-sm">
            <FooterIcon name="phone" />
            {phone}
          </span>
        ) : null}
        {whatsapp ? (
          <span className="inline-flex items-center gap-2 text-sm">
            <FooterIcon name="whatsapp" />
            {whatsapp}
          </span>
        ) : null}
        {socials.map(([key, label, icon]) => (
          <a key={key} className="inline-flex items-center gap-2 text-sm underline" href={values[key]} target="_blank" rel="noreferrer">
            <FooterIcon name={icon} />
            {label}
          </a>
        ))}
        {!phone && !whatsapp && socials.length === 0 ? (
          <p className="text-sm text-muted">Add a phone, WhatsApp number, or social link to preview the footer icons.</p>
        ) : null}
      </div>
    </div>
  )
}

function FooterIcon({ name }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true }
  if (name === 'phone') {
    return (
      <svg {...common}>
        <path d="M7 3h3l1.5 4-2 1.5a12 12 0 0 0 6 6L17 13l4 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z" />
      </svg>
    )
  }
  if (name === 'whatsapp') {
    return (
      <svg {...common}>
        <path d="M5 19l1.2-3.4A8 8 0 1 1 8.4 18L5 19z" />
        <path d="M9 10c.4 2 2.2 3.6 4.2 4" />
      </svg>
    )
  }
  if (name === 'facebook') {
    return (
      <svg {...common}>
        <path d="M14 8h3V4h-3c-2.2 0-4 1.8-4 4v2H8v4h2v6h4v-6h3l1-4h-4V8c0-.6.4-1 1-1z" />
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
        <path d="M14 5c.6 2.4 2.2 4 4.6 4.4V13c-1.7 0-3.2-.5-4.6-1.4V16a5 5 0 1 1-5-5c.3 0 .6 0 .9.1V14a2.2 2.2 0 1 0 1.6 2.1V5H14z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M10 9.5V6.2A8 8 0 0 0 21 14v1.2a3.2 3.2 0 0 1-3.2 3.2h-.6A3.2 3.2 0 0 1 14 15.2V10" />
      <path d="M10 15V9.5l7-2" />
    </svg>
  )
}
