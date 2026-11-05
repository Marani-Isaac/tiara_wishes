import { useEffect, useState } from 'react'
import { createContent, deleteContent, listContent, updateContent } from '../api/content'
import { uploadMedia } from '../api/media'
import ConfirmDialog from '../components/common/ConfirmDialog'
import ImageField from '../components/common/ImageField'
import { EmptyState, ErrorState, FormField, LoadingState, PageHeader, SuccessNote } from '../components/common/States'
import { mediaUrl, slugify } from '../lib/format'

const EMPTY = {
  title: '',
  slug: '',
  body: '',
  image_url: '',
  link_url: '',
  kind: 'announcement',
  sort_order: '0',
  is_active: true,
}

const KINDS = [
  ['announcement', 'Announcement'],
  ['ad', 'Advertisement'],
  ['video', 'Video'],
]

export default function ContentSettingsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)
  const [file, setFile] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const body = await listContent()
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

  async function save(event) {
    event.preventDefault()
    if (form.kind === 'video' && !form.link_url.trim()) {
      setError({ message: 'A video needs a link shoppers can open.' })
      return
    }
    if (form.link_url.trim() && !/^https?:\/\//i.test(form.link_url.trim())) {
      setError({ message: 'The link must start with http:// or https://.' })
      return
    }
    setBusy(true)
    try {
      let imageUrl = form.image_url.trim() || null
      if (file) {
        const uploaded = await uploadMedia(file, 'content')
        imageUrl = uploaded.data.image_url
      }
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || slugify(form.title),
        body: form.body.trim(),
        image_url: imageUrl,
        link_url: form.link_url.trim() || null,
        kind: form.kind,
        sort_order: Number(form.sort_order || 0),
        is_active: form.is_active,
      }
      const result = editing ? await updateContent(editing, payload) : await createContent(payload)
      setNotice(result.message)
      setForm(EMPTY)
      setFile(null)
      setEditing(null)
      setSlugTouched(false)
      await load()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      const result = await deleteContent(pending.id)
      setNotice(result.message)
      setPending(null)
      await load()
    } catch (err) {
      setError(err)
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Storefront"
        title="Homepage content"
        description="Announcements, advertisements, and video links for the storefront. Choose an image from your files when the block should show one. A video still needs an https link."
      />
      <SuccessNote>{notice}</SuccessNote>
      {error ? <div className="mb-4"><ErrorState error={error} /></div> : null}
      <form className="panel mb-4 grid max-w-3xl gap-3 p-4" onSubmit={save}>
        <FormField id="content-title" label="Title">
          <input
            id="content-title"
            className="field"
            required
            value={form.title}
            onChange={(event) => {
              const title = event.target.value
              setForm((current) => ({ ...current, title, slug: slugTouched ? current.slug : slugify(title) }))
            }}
          />
        </FormField>
        <FormField id="content-slug" label="Slug">
          <input
            id="content-slug"
            className="field"
            value={form.slug}
            onChange={(event) => {
              setSlugTouched(true)
              setForm({ ...form, slug: event.target.value })
            }}
          />
        </FormField>
        <FormField id="content-kind" label="Type">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Content type">
            {KINDS.map(([value, label]) => (
              <button
                key={value}
                className={form.kind === value ? 'btn btn-gold' : 'btn btn-ghost'}
                type="button"
                role="tab"
                aria-selected={form.kind === value}
                onClick={() => setForm({ ...form, kind: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </FormField>
        <FormField
          id="content-link"
          label={form.kind === 'video' ? 'Video link' : 'Link'}
          hint={
            form.kind === 'ad'
              ? 'Where the advertisement opens on the storefront.'
              : form.kind === 'video'
                ? 'Where shoppers watch the video.'
                : 'Optional link for this announcement.'
          }
        >
          <input
            id="content-link"
            className="field"
            inputMode="url"
            placeholder="https://"
            value={form.link_url}
            onChange={(event) => setForm({ ...form, link_url: event.target.value })}
          />
        </FormField>
        <FormField id="content-body" label="Text">
          <textarea id="content-body" className="field" required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
        </FormField>
        <ImageField
          id="content-image"
          label="Image"
          hint="Optional. Choose a JPEG, PNG, or WebP from your files, up to 5 MB."
          value={form.image_url}
          file={file}
          onFile={setFile}
          onClear={() => {
            setFile(null)
            setForm((current) => ({ ...current, image_url: '' }))
          }}
        />
        <FormField id="content-sort" label="Sort order">
          <input id="content-sort" className="field" inputMode="numeric" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
          Visible on the homepage
        </label>
        <div className="flex gap-2">
          <button className="btn btn-gold" type="submit" disabled={busy}>{editing ? 'Save block' : 'Add block'}</button>
          {editing ? (
            <button className="btn btn-ghost" type="button" onClick={() => { setEditing(null); setForm(EMPTY); setFile(null); setSlugTouched(false) }}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      {loading ? <LoadingState label="Loading content" /> : null}
      {!loading && rows.length === 0 ? <EmptyState title="No homepage blocks" body="Add a banner or announcement when you want one on the storefront." /> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                {row.image_url ? <img className="h-16 w-16 rounded-lg object-cover" src={mediaUrl(row.image_url)} alt="" /> : null}
                <div>
                <h2 className="font-semibold">{row.title}</h2>
                <p className="text-xs uppercase tracking-wide text-muted">
                  {row.kind || 'announcement'} · {row.slug} · {row.is_active ? 'Visible' : 'Hidden'}
                </p>
                {row.link_url ? (
                  <a className="mt-1 inline-block text-sm underline" href={row.link_url} target="_blank" rel="noreferrer">
                    {row.link_url}
                  </a>
                ) : null}
                <p className="mt-2 text-sm">{row.body}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    setEditing(row.id)
                    setSlugTouched(true)
                    setForm({
                      title: row.title,
                      slug: row.slug,
                      body: row.body || '',
                      image_url: row.image_url || '',
                      link_url: row.link_url || '',
                      kind: row.kind || 'announcement',
                      sort_order: String(row.sort_order ?? 0),
                      is_active: Boolean(row.is_active),
                    })
                    setFile(null)
                  }}
                >
                  Edit
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setPending(row)}>
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(pending)}
        danger
        title="Delete this block?"
        body="It will leave the homepage after the API confirms the delete."
        confirmLabel="Delete block"
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={remove}
      />
    </div>
  )
}
