import { useEffect, useState } from 'react'
import { createPromotion, deactivatePromotion, listPromotions, updatePromotion } from '../api/promotions'
import { uploadMedia } from '../api/media'
import ConfirmDialog from '../components/common/ConfirmDialog'
import DataTable from '../components/common/DataTable'
import ImageField from '../components/common/ImageField'
import StatusBadge from '../components/common/StatusBadge'
import { EmptyState, ErrorState, FormField, LoadingState, PageHeader, SuccessNote } from '../components/common/States'
import { formatWhen, mediaUrl, money } from '../lib/format'

const EMPTY = {
  name: '',
  code: '',
  type: 'percentage',
  value: '',
  starts_at: '',
  ends_at: '',
  minimum_order_amount: '',
  usage_limit: '',
  is_active: false,
  hover_in_empty_space: true,
  image_url: '',
}

export default function PromotionsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [tab, setTab] = useState('details')
  const [file, setFile] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const body = await listPromotions()
      setRows(body.data || [])
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function payloadFrom(source) {
    return {
      name: source.name.trim(),
      code: source.code.trim() || null,
      type: source.type,
      value: source.value,
      starts_at: source.starts_at ? `${source.starts_at}:00` : null,
      ends_at: source.ends_at ? `${source.ends_at}:00` : null,
      minimum_order_amount: source.minimum_order_amount === '' ? null : source.minimum_order_amount,
      usage_limit: source.usage_limit === '' ? null : Number(source.usage_limit),
      is_active: source.is_active,
      hover_in_empty_space: source.hover_in_empty_space,
    }
  }

  async function save(event) {
    event.preventDefault()
    if (!form.name.trim() || form.value === '') {
      setTab('details')
      setError({ message: 'Name and value are required before the promotion can be saved.' })
      return
    }
    if (form.is_active) {
      setConfirm({ kind: 'save' })
      return
    }
    await persist(false)
  }

  async function persist() {
    setBusy(true)
    try {
      let imageUrl = form.image_url.trim() || null
      if (file) {
        const uploaded = await uploadMedia(file, 'promotions')
        imageUrl = uploaded.data.image_url
      }
      const payload = { ...payloadFrom(form), image_url: imageUrl }
      const body = editing ? await updatePromotion(editing, payload) : await createPromotion(payload)
      setNotice(body.message)
      setForm(EMPTY)
      setFile(null)
      setTab('details')
      setEditing(null)
      setConfirm(null)
      await load()
    } catch (err) {
      setError(err)
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  async function deactivate() {
    setBusy(true)
    try {
      const body = await deactivatePromotion(confirm.row.id)
      setNotice(body.message)
      setConfirm(null)
      await load()
    } catch (err) {
      setError(err)
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  const preview = `${form.type === 'percentage' ? `${form.value || '0'}%` : money(form.value || 0)} off${
    form.minimum_order_amount ? `, minimum ${money(form.minimum_order_amount)}` : ''
  }${form.usage_limit ? `, limit ${form.usage_limit}` : ''}. Checkout calculates the real discount.`

  return (
    <div>
      <PageHeader
        eyebrow="Offers"
        title="Promotions"
        description="Percentage and fixed-amount codes only. Activation asks for confirmation. Active promotions marked to hover are included in the public homepage payload so the storefront can float them in empty space."
      />
      <SuccessNote>{notice}</SuccessNote>
      {error ? <div className="mb-4"><ErrorState error={error} /></div> : null}
      <form className="panel mb-4 max-w-4xl space-y-3 p-4" onSubmit={save}>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Promotion form">
          <button className={tab === 'details' ? 'btn btn-gold' : 'btn btn-ghost'} type="button" role="tab" aria-selected={tab === 'details'} onClick={() => setTab('details')}>
            Details
          </button>
          <button className={tab === 'image' ? 'btn btn-gold' : 'btn btn-ghost'} type="button" role="tab" aria-selected={tab === 'image'} onClick={() => setTab('image')}>
            Image
          </button>
        </div>
        {tab === 'image' ? (
          <ImageField
            id="promo-image"
            label="Promotion image"
            hint="Optional. Shoppers see this with the offer. JPEG, PNG, or WebP, up to 5 MB."
            value={form.image_url}
            file={file}
            onFile={setFile}
            onClear={() => {
              setFile(null)
              setForm((current) => ({ ...current, image_url: '' }))
            }}
          />
        ) : (
        <div className="grid gap-3 md:grid-cols-2">
        <FormField id="promo-name" label="Name">
          <input id="promo-name" className="field" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </FormField>
        <FormField id="promo-code" label="Code" hint="Letters, numbers, and hyphens. Stored in uppercase.">
          <input id="promo-code" className="field" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        </FormField>
        <FormField id="promo-type" label="Type">
          <select id="promo-type" className="field" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option value="percentage">Percentage</option>
            <option value="fixed_amount">Fixed amount (KES)</option>
          </select>
        </FormField>
        <FormField id="promo-value" label="Value">
          <input id="promo-value" className="field" required inputMode="decimal" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
        </FormField>
        <FormField id="promo-start" label="Starts">
          <input id="promo-start" className="field" type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} />
        </FormField>
        <FormField id="promo-end" label="Ends">
          <input id="promo-end" className="field" type="datetime-local" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} />
        </FormField>
        <FormField id="promo-min" label="Minimum order (KES)">
          <input id="promo-min" className="field" inputMode="decimal" value={form.minimum_order_amount} onChange={(event) => setForm({ ...form, minimum_order_amount: event.target.value })} />
        </FormField>
        <FormField id="promo-limit" label="Usage limit">
          <input id="promo-limit" className="field" inputMode="numeric" value={form.usage_limit} onChange={(event) => setForm({ ...form, usage_limit: event.target.value })} />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={form.hover_in_empty_space}
            onChange={(event) => setForm({ ...form, hover_in_empty_space: event.target.checked })}
          />
          Hover in empty spaces on the storefront
        </label>
        <p className="text-sm text-muted md:col-span-2">{preview}</p>
        </div>
        )}
        <div className="flex gap-2">
          <button className="btn btn-gold" type="submit" disabled={busy}>{editing ? 'Save promotion' : 'Create promotion'}</button>
          {editing ? <button className="btn btn-ghost" type="button" onClick={() => { setEditing(null); setForm(EMPTY); setFile(null); setTab('details') }}>Cancel</button> : null}
        </div>
      </form>
      {loading ? <LoadingState label="Loading promotions" /> : null}
      {!loading && rows.length === 0 ? <EmptyState title="No promotions" body="Create a code when you are ready. It stays inactive until you confirm activation." /> : null}
      {rows.length > 0 ? (
        <div className="panel p-3">
          <DataTable
            rowKey={(row) => row.id}
            rows={rows}
            columns={[
              { key: 'name', header: 'Name', cell: (row) => (
                <span className="inline-flex items-center gap-2">
                  {row.image_url ? <img className="h-10 w-10 rounded-lg object-cover" src={mediaUrl(row.image_url)} alt="" /> : null}
                  {row.name}
                </span>
              ) },
              { key: 'code', header: 'Code', cell: (row) => row.code || '—' },
              { key: 'value', header: 'Value', cell: (row) => (row.type === 'percentage' ? `${row.value}%` : money(row.value)) },
              { key: 'uses', header: 'Uses', cell: (row) => `${row.usage_count}${row.usage_limit ? ` / ${row.usage_limit}` : ''}` },
              { key: 'ends', header: 'Ends', cell: (row) => formatWhen(row.ends_at) },
              {
                key: 'status',
                header: 'Status',
                cell: (row) => (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <StatusBadge value={row.is_active ? 'active' : 'disabled'} />
                    {row.hover_in_empty_space ? <span className="text-xs text-muted">Hovers</span> : null}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <div className="flex gap-2">
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => {
                        setEditing(row.id)
                        setForm({
                          name: row.name,
                          code: row.code || '',
                          type: row.type,
                          value: row.value,
                          starts_at: toLocal(row.starts_at),
                          ends_at: toLocal(row.ends_at),
                          minimum_order_amount: row.minimum_order_amount || '',
                          usage_limit: row.usage_limit ?? '',
                          is_active: Boolean(row.is_active),
                          hover_in_empty_space: row.hover_in_empty_space !== false,
                          image_url: row.image_url || '',
                        })
                        setFile(null)
                        setTab('details')
                      }}
                    >
                      Edit
                    </button>
                    {row.is_active ? (
                      <button className="btn btn-ghost" type="button" onClick={() => setConfirm({ kind: 'off', row })}>
                        Deactivate
                      </button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === 'off' ? 'Deactivate this promotion?' : 'Activate this promotion?'}
        body={confirm?.kind === 'off' ? 'Shoppers will no longer be able to use the code.' : preview}
        confirmLabel="Confirm"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.kind === 'off' ? deactivate : persist}
      />
    </div>
  )
}

function toLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
