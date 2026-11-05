import { useEffect, useState } from 'react'
import { mediaUrl } from '../../lib/format'
import { FormField } from './States'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

export default function ImageField({ id, label, hint, value, file, error, onFile, onClear }) {
  const [preview, setPreview] = useState('')
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!file) {
      setPreview(value ? mediaUrl(value) : '')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file, value])

  function choose(event) {
    const next = event.target.files?.[0]
    event.target.value = ''
    if (!next) return
    if (!ALLOWED.includes(next.type)) {
      setLocalError('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (next.size > MAX_BYTES) {
      setLocalError('That image is larger than 5 MB.')
      return
    }
    setLocalError('')
    onFile(next)
  }

  return (
    <FormField id={id} label={label} hint={hint} error={error || localError}>
      {preview ? <img className="mb-3 h-40 w-full rounded-xl object-cover" src={preview} alt="" /> : null}
      <div className="flex flex-wrap gap-2">
        <label className="btn btn-ghost">
          {file || value ? 'Replace image' : 'Choose image'}
          <input id={id} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} />
        </label>
        {file || value ? (
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setLocalError('')
              onClear()
            }}
          >
            Remove image
          </button>
        ) : null}
      </div>
    </FormField>
  )
}
