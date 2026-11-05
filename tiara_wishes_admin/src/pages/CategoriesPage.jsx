import { useEffect, useState } from 'react'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../api/categories'
import ConfirmDialog from '../components/common/ConfirmDialog'
import DataTable from '../components/common/DataTable'
import StatusBadge from '../components/common/StatusBadge'
import { EmptyState, ErrorState, FormField, LoadingState, PageHeader, SuccessNote } from '../components/common/States'
import { slugify } from '../lib/format'

const EMPTY = { name: '', slug: '', description: '', parent_id: '', sort_order: '0', is_active: true, specifications: [] }

export default function CategoriesPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [formError, setFormError] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setRows(await listCategories())
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function startEdit(row) {
    setEditing(row.id)
    setSlugTouched(true)
    setForm({
      name: row.name,
      slug: row.slug,
      description: row.description || '',
      parent_id: row.parent_id ? String(row.parent_id) : '',
      sort_order: String(row.sort_order ?? 0),
      is_active: Boolean(row.is_active),
      specifications: Array.isArray(row.specifications)
        ? row.specifications.map((item) => ({ label: item.label || '', value: item.value || '' }))
        : [],
    })
  }

  function updateSpecification(index, key, value) {
    setForm((current) => ({
      ...current,
      specifications: current.specifications.map((row, rowIndex) => (
        rowIndex === index ? { ...row, [key]: value } : row
      )),
    }))
  }

  async function save(event) {
    event.preventDefault()
    setError(null)
    setFormError('')
    const specifications = form.specifications
      .map((row) => ({ label: row.label.trim(), value: row.value.trim() }))
      .filter((row) => row.label || row.value)
    if (specifications.some((row) => !row.label || !row.value)) {
      setFormError('Each category specification needs both a label and a value. Leave the list empty if this category has none.')
      return
    }
    setBusy(true)
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim() || null,
      parent_id: form.parent_id ? Number(form.parent_id) : null,
      sort_order: Number(form.sort_order || 0),
      is_active: form.is_active,
      specifications,
    }
    try {
      const body = editing ? await updateCategory(editing, payload) : await createCategory(payload)
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
          ? await deleteCategory(confirm.row.id)
          : await updateCategory(confirm.row.id, { is_active: !confirm.row.is_active })
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
        title="Categories"
        description="Parents cannot form a loop, and nesting stops at four levels. The API refuses to delete a category that still has products or children."
      />
      <SuccessNote>{notice}</SuccessNote>
      {error ? <div className="mb-4"><ErrorState error={error} /></div> : null}
      <form className="panel mb-4 grid max-w-4xl gap-3 p-4 md:grid-cols-2" onSubmit={save}>
        <FormField id="cat-name" label="Name">
          <input
            id="cat-name"
            className="field"
            value={form.name}
            required
            onChange={(event) => {
              const name = event.target.value
              setForm((current) => ({ ...current, name, slug: slugTouched ? current.slug : slugify(name) }))
            }}
          />
        </FormField>
        <FormField id="cat-slug" label="Slug">
          <input
            id="cat-slug"
            className="field"
            value={form.slug}
            onChange={(event) => {
              setSlugTouched(true)
              setForm({ ...form, slug: event.target.value })
            }}
          />
        </FormField>
        <FormField id="cat-parent" label="Parent" hint="Leave empty for a main category. A category under a main category, then a subcategory, then a child category, is what the product form offers.">
          <select id="cat-parent" className="field" value={form.parent_id} onChange={(event) => setForm({ ...form, parent_id: event.target.value })}>
            <option value="">No parent</option>
            {rows
              .filter((row) => row.id !== editing)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
          </select>
        </FormField>
        <FormField id="cat-sort" label="Sort order">
          <input id="cat-sort" className="field" inputMode="numeric" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
        </FormField>
        <FormField id="cat-description" label="Description">
          <textarea id="cat-description" className="field" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </FormField>
        <div className="space-y-2 md:col-span-2">
          <p className="text-sm font-semibold">Specifications</p>
          <p className="text-sm text-muted">
            Optional. Add facts that describe this category, such as typical use or what shoppers should compare. A category can be saved with none.
          </p>
          {form.specifications.map((row, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input
                className="field"
                aria-label={`Category specification ${index + 1} label`}
                placeholder="Label, for example Power"
                value={row.label}
                onChange={(event) => updateSpecification(index, 'label', event.target.value)}
              />
              <input
                className="field"
                aria-label={`Category specification ${index + 1} value`}
                placeholder="Value, for example Electric"
                value={row.value}
                onChange={(event) => updateSpecification(index, 'value', event.target.value)}
              />
              <button className="btn btn-ghost" type="button" onClick={() => setForm((current) => ({
                ...current,
                specifications: current.specifications.filter((_, rowIndex) => rowIndex !== index),
              }))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setForm((current) => ({ ...current, specifications: [...current.specifications, { label: '', value: '' }] }))}
          >
            Add specification
          </button>
          {formError ? <p className="text-sm text-danger" role="alert">{formError}</p> : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
          Active
        </label>
        <div className="flex gap-2">
          <button className="btn btn-gold" type="submit" disabled={busy}>
            {editing ? 'Save category' : 'Create category'}
          </button>
          {editing ? (
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setEditing(null)
                setForm(EMPTY)
                setSlugTouched(false)
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      {loading ? <LoadingState label="Loading categories" /> : null}
      {!loading && rows.length === 0 ? <EmptyState title="No categories yet" body="Create the first category before adding products." /> : null}
      {rows.length > 0 ? (
        <div className="panel p-3">
          <DataTable
            rowKey={(row) => row.id}
            rows={rows}
            columns={[
              { key: 'name', header: 'Name', cell: (row) => row.name },
              { key: 'slug', header: 'Slug', cell: (row) => row.slug },
              {
                key: 'parent',
                header: 'Parent',
                cell: (row) => rows.find((item) => item.id === row.parent_id)?.name || '—',
              },
              { key: 'sort', header: 'Order', cell: (row) => row.sort_order },
              { key: 'status', header: 'Status', cell: (row) => <StatusBadge value={row.is_active ? 'active' : 'disabled'} /> },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-ghost" type="button" onClick={() => startEdit(row)}>
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
        danger={confirm?.action === 'delete' || confirm?.row?.is_active}
        title={confirm?.action === 'delete' ? 'Delete this category?' : confirm?.row?.is_active ? 'Deactivate this category?' : 'Activate this category?'}
        body={
          confirm?.action === 'delete'
            ? 'If products or subcategories still use it, the API will refuse the delete. Deactivate it instead.'
            : confirm?.row?.is_active
              ? 'Active products in this category may disappear from the storefront until you activate it again.'
              : 'The category will be available for the storefront again.'
        }
        confirmLabel="Continue"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </div>
  )
}
