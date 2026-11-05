import { useEffect, useId, useRef } from 'react'
import { Button } from './Button'

export function Modal({ open, title, onClose, wide = false, children }) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return undefined
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    return undefined
  }, [open])

  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onClose={onClose}>
      <div className={wide ? 'modal-card modal-card-wide' : 'modal-card'}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id={titleId} className="display text-3xl">
            {title}
          </h2>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

export function LoadingState({ label = 'Loading the shop' }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="panel overflow-hidden">
          <div className="skeleton aspect-[4/5]" />
          <div className="space-y-2 p-4">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="panel px-6 py-10 text-center" role="alert">
      <p className="eyebrow">Store</p>
      <h2 className="display mt-2 text-2xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-muted">{message}</p>
      {onRetry ? (
        <Button className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="panel px-6 py-12 text-center">
      <h2 className="display text-2xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-muted">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
