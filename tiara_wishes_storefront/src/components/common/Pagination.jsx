export default function Pagination({ page, pages, onPage }) {
  if (!pages || pages < 2) return null
  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
      <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <p className="text-sm text-muted">
        Page {page} of {pages}
      </p>
      <button type="button" className="btn btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  )
}
