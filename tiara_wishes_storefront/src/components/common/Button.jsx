export function Button({ variant = 'primary', block = false, className = '', type = 'button', children, ...props }) {
  const variantClass = variant === 'primary' ? '' : `btn-${variant}`
  return (
    <button type={type} className={`btn ${variantClass} ${block ? 'btn-block' : ''} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}

export function Field({ label, hint, error, id, as = 'input', children, ...props }) {
  const Tag = as
  return (
    <label className="field-wrap" htmlFor={id}>
      <span className="field-label">{label}</span>
      {as === 'select' ? (
        <select id={id} className="select" aria-invalid={Boolean(error)} {...props}>
          {children}
        </select>
      ) : (
        <Tag id={id} className="field" aria-invalid={Boolean(error)} {...props} />
      )}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}
