import { useEffect, useId, useRef } from 'react'

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}) {
  const titleId = useId()
  const cancelRef = useRef(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="panel w-full max-w-md p-6"
      >
        <h2 id={titleId} className="display text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-muted">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancelRef} className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={danger ? 'btn btn-danger' : 'btn btn-gold'}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
