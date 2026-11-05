export default function Pagination({ meta, onPage }) {
  if (!meta || meta.pages < 2) return null
  const page = meta.page
  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-sm text-muted">
        Page {page} of {meta.pages} · {meta.total} records
      </p>
      <div className="flex gap-2">
        <button className="btn btn-ghost" type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          disabled={page >= meta.pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  )
}
