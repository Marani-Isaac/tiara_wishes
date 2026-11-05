import { useState } from 'react'
import { productReport, salesReport } from '../api/reports'
import DataTable from '../components/common/DataTable'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/common/States'
import { money } from '../lib/format'

export default function ReportsPage() {
  const [range, setRange] = useState({ from: '', to: '' })
  const [state, setState] = useState({ loading: false, error: null, sales: null, products: null })

  async function load(event) {
    event?.preventDefault()
    if ((range.from && !range.to) || (!range.from && range.to)) {
      setState({ loading: false, error: { message: 'Choose both dates, or leave both empty for today.' }, sales: null, products: null })
      return
    }
    setState({ loading: true, error: null, sales: null, products: null })
    const params = range.from && range.to ? { from: range.from, to: range.to } : {}
    try {
      const [sales, products] = await Promise.all([salesReport(params), productReport(params)])
      setState({ loading: false, error: null, sales: sales.data, products: products.data })
    } catch (error) {
      setState({ loading: false, error, sales: null, products: null })
    }
  }

  const sales = state.sales
  const products = state.products?.products || []

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Sales and products"
        description="Figures are calculated by the API. Pending, failed, cancelled, and fully refunded payments are not paid sales. CSV export is not available."
      />
      <form className="panel mb-4 flex flex-wrap items-end gap-3 p-4" onSubmit={load}>
        <label>
          <span className="field-label">From</span>
          <input className="field" type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} />
        </label>
        <label>
          <span className="field-label">To</span>
          <input className="field" type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} />
        </label>
        <button className="btn btn-gold" type="submit">Run report</button>
      </form>
      {!state.sales && !state.loading && !state.error ? (
        <EmptyState title="Choose a period" body="Leave the dates empty to report on today in Africa/Nairobi, or pick a range of up to 366 days." />
      ) : null}
      {state.loading ? <LoadingState label="Calculating report" /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={load} /> : null}
      {sales ? (
        <div className="space-y-4">
          <section className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              {sales.from || 'Today'} {sales.to ? `to ${sales.to}` : ''} · {sales.currency}
            </p>
            <p className="display mt-2 text-5xl">{money(sales.paid_sales, sales.currency)}</p>
            <p className="mt-1 text-sm">Paid orders {sales.paid_orders}</p>
            <p className="mt-3 text-sm text-muted">{sales.rule}</p>
          </section>
          {products.length === 0 ? (
            <EmptyState title="No paid product sales" body="Nothing in this period qualified as a paid, non-cancelled order." />
          ) : (
            <div className="panel p-3">
              <DataTable
                rowKey={(row) => `${row.product_id}-${row.sku}`}
                rows={products}
                columns={[
                  { key: 'name', header: 'Product', cell: (row) => row.name },
                  { key: 'sku', header: 'SKU', cell: (row) => row.sku },
                  { key: 'units', header: 'Units', cell: (row) => row.units },
                  { key: 'revenue', header: 'Revenue', cell: (row) => money(row.revenue, sales.currency) },
                ]}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
