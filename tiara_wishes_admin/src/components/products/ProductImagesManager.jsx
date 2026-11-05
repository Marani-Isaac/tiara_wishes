import { useState } from 'react'
import { deleteProductImage, reorderProductImages, uploadProductImage } from '../../api/products'
import ConfirmDialog from '../common/ConfirmDialog'
import { mediaUrl } from '../../lib/format'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

export default function ProductImagesManager({ productId, images, onChange }) {
  const [alt, setAlt] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!ALLOWED.includes(file.type)) {
      setError('Upload a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('That image is larger than 5 MB.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await uploadProductImage(productId, file, alt.trim())
      setAlt('')
      await onChange()
    } catch (err) {
      setError(err.details?.image || err.message)
    } finally {
      setBusy(false)
    }
  }

  async function move(index, direction) {
    const next = images.slice()
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setBusy(true)
    setError('')
    try {
      await reorderProductImages(productId, next.map((image) => image.id))
      await onChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteProductImage(productId, pending.id)
      setPending(null)
      await onChange()
    } catch (err) {
      setError(err.message)
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel p-5">
      <h2 className="display text-3xl">Images</h2>
      <p className="mt-1 text-sm text-muted">The first image is the primary image. Ordering is saved only after the API accepts it.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input className="field max-w-xs" placeholder="Alt text" value={alt} onChange={(event) => setAlt(event.target.value)} />
        <label className="btn btn-ghost">
          {busy ? 'Uploading…' : 'Upload image'}
          <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={busy} />
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
      <ul className="mt-4 space-y-3">
        {images.length === 0 ? <li className="text-sm text-muted">No images yet.</li> : null}
        {images.map((image, index) => (
          <li key={image.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
            <img className="h-16 w-16 rounded-lg object-cover" src={mediaUrl(image.image_url)} alt={image.alt_text || ''} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{index === 0 ? 'Primary' : `Image ${index + 1}`}</p>
              <p className="truncate text-muted">{image.alt_text}</p>
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => move(index, -1)} disabled={busy || index === 0}>
              Up
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => move(index, 1)} disabled={busy || index === images.length - 1}>
              Down
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setPending(image)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Remove this image?"
        body="The file will be deleted from the product. This is saved only if the API succeeds."
        confirmLabel="Remove image"
        danger
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={remove}
      />
    </section>
  )
}
