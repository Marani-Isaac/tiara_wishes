export function LoadingState({ label = 'Loading records' }) {
  return (
    <div className="panel p-8" role="status" aria-live="polite">
      <div className="h-2 w-24 rounded-full bg-gold" />
      <p className="mt-4 text-muted">{label}</p>
    </div>
  )
}

export function EmptyState({ title, body }) {
  return (
    <div className="panel px-6 py-10 text-center">
      <h2 className="display text-3xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-muted">{body}</p>
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const denied = error?.status === 403
  return (
    <div className="panel px-6 py-8" role="alert">
      <p className="eyebrow">{denied ? 'Access denied' : 'Something needs attention'}</p>
      <h2 className="display mt-2 text-3xl">{denied ? 'You cannot open this' : 'The request failed'}</h2>
      <p className="mt-2 max-w-xl text-muted">{error?.message || 'Try again in a moment.'}</p>
      {onRetry && !denied ? (
        <button className="btn btn-ghost mt-5" type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}

export function SuccessNote({ children }) {
  if (!children) return null
  return (
    <p className="rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok" role="status">
      {children}
    </p>
  )
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="eyebrow">{eyebrow}</p>
        ) : null}
        <h1 className="display text-4xl leading-none">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function FormField({ id, label, hint, error, children }) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  )
}
