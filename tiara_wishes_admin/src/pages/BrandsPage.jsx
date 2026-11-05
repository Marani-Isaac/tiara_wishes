import { useEffect, useState } from 'react'
import { createBrand, deleteBrand, listBrands, updateBrand } from '../api/brands'
import ConfirmDialog from '../components/common/ConfirmDialog'
import DataTable from '../components/common/DataTable'
import StatusBadge from '../components/common/StatusBadge'
import { EmptyState, ErrorState, FormField, LoadingState, PageHeader, SuccessNote } from '../components/common/States'
import { slugify } from '../lib/format'

const EMPTY = { name: '', slug: '', description: '', logo_url: '', is_active: true }

export default function BrandsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)

  async function load() {
    setLoading(true)
    try {
      setError(null)
      setRows(await listBrands())
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function save(event) {
    event.preventDefault()
    if (form.logo_url.trim().startsWith('http')) {
      setError({ message: 'Use an uploaded media path. External logo links are rejected.' })
      return
    }
    setBusy(true)
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim() || null,
      logo_url: form.logo_url.trim() || null,
      is_active: form.is_active,
    }
    try {
      const body = editing ? await updateBrand(editing, payload) : await createBrand(payload)
      setNotice(body.message)
      setForm(EMPTY)
      setEditing(null)
      setSlugTouched(false)
      await load()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function runConfirm() {
    setBusy(true)
    try {
      const body =
        confirm.action === 'delete'
          ? await deleteBrand(confirm.row.id)
          : await updateBrand(confirm.row.id, { is_active: !confirm.row.is_active })
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

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Brands"
        description="Deactivating a brand used by live products hides that association from shoppers. The API will not delete a brand that products still use."
      />
      <SuccessNote>{notice}</SuccessNote>
      {error ? <div className="mb-4"><ErrorState error={error} /></div> : null}
      <form className="panel mb-4 grid max-w-4xl gap-3 p-4 md:grid-cols-2" onSubmit={save}>
        <FormField id="brand-name" label="Name">
          <input
            id="brand-name"
            className="field"
            required
            value={form.name}
            onChange={(event) => {
              const name = event.target.value
              setForm((current) => ({ ...current, name, slug: slugTouched ? current.slug : slugify(name) }))
            }}
          />
        </FormField>
        <FormField id="brand-slug" label="Slug">
          <input
            id="brand-slug"
            className="field"
            value={form.slug}
            onChange={(event) => {
              setSlugTouched(true)
              setForm({ ...form, slug: event.target.value })
            }}
          />
        </FormField>
        <FormField id="brand-logo" label="Logo path" hint="Optional path such as /media/.... External URLs are not accepted.">
          <input id="brand-logo" className="field" value={form.logo_url} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} />
        </FormField>
        <FormField id="brand-description" label="Description">
          <textarea id="brand-description" className="field" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
          Active
        </label>
        <div className="flex gap-2">
          <button className="btn btn-gold" disabled={busy} type="submit">
            {editing ? 'Save brand' : 'Create brand'}
          </button>
          {editing ? (
            <button className="btn btn-ghost" type="button" onClick={() => { setEditing(null); setForm(EMPTY); setSlugTouched(false) }}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      {loading ? <LoadingState label="Loading brands" /> : null}
      {!loading && rows.length === 0 ? <EmptyState title="No brands yet" body="Brands are optional on a product." /> : null}
      {rows.length > 0 ? (
        <div className="panel p-3">
          <DataTable
            rowKey={(row) => row.id}
            rows={rows}
            columns={[
              { key: 'name', header: 'Name', cell: (row) => row.name },
              { key: 'slug', header: 'Slug', cell: (row) => row.slug },
              { key: 'status', header: 'Status', cell: (row) => <StatusBadge value={row.is_active ? 'active' : 'disabled'} /> },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => {
                        setEditing(row.id)
                        setSlugTouched(true)
                        setForm({
                          name: row.name,
                          slug: row.slug,
                          description: row.description || '',
                          logo_url: row.logo_url || '',
                          is_active: Boolean(row.is_active),
                        })
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => setConfirm({ action: 'toggle', row })}>
                      {row.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => setConfirm({ action: 'delete', row })}>
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        danger
        title={confirm?.action === 'delete' ? 'Delete this brand?' : confirm?.row?.is_active ? 'Deactivate this brand?' : 'Activate this brand?'}
        body={
          confirm?.action === 'delete'
            ? 'The API will refuse this if any product still points at the brand.'
            : 'Active products that use this brand stay in the catalogue, but the brand itself will be hidden while inactive.'
        }
        confirmLabel="Continue"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </div>
  )
}
