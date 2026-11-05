export default function DataTable({ columns, rows, rowKey }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-3 font-semibold">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line/80 align-top">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3">
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article key={rowKey(row)} className="rounded-xl border border-line bg-paper/60 p-4">
            {columns.map((column) => (
              <div key={column.key} className="grid grid-cols-[7.5rem_1fr] gap-2 py-1 text-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{column.header}</div>
                <div>{column.cell(row)}</div>
              </div>
            ))}
          </article>
        ))}
      </div>
    </>
  )
}
