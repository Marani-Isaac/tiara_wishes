import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboard } from '../api/dashboard'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/common/States'
import StatusBadge from '../components/common/StatusBadge'
import { formatWhen, money } from '../lib/format'

export default function DashboardPage() {
  const [range, setRange] = useState({ from: '', to: '' })
  const [applied, setApplied] = useState({ from: '', to: '' })
  const [state, setState] = useState({ loading: true, error: null, data: null })

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: null }))
    const params = {}
    if (applied.from && applied.to) {
      params.from = applied.from
      params.to = applied.to
    }
    getDashboard(params)
      .then((body) => {
        if (active) setState({ loading: false, error: null, data: body.data })
      })
      .catch((error) => {
        if (active) setState({ loading: false, error, data: null })
      })
    return () => {
      active = false
    }
  }, [applied])

  const data = state.data
  const periodLabel = applied.from && applied.to ? `${applied.from} to ${applied.to}` : 'today'

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Store activity"
        description="Paid sales come from the API. Pending and failed payments are counted separately and are not treated as revenue."
      />
      <form
        className="panel mb-6 flex flex-wrap items-end gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          if ((range.from && !range.to) || (!range.from && range.to)) return
          setApplied(range)
        }}
      >
        <label>
          <span className="field-label">From</span>
          <input className="field" type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} />
        </label>
        <label>
          <span className="field-label">To</span>
          <input className="field" type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} />
        </label>
        <button className="btn btn-gold" type="submit">
          Apply
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            setRange({ from: '', to: '' })
            setApplied({ from: '', to: '' })
          }}
        >
          Today
        </button>
        <p className="text-sm text-muted">Leave both dates empty for today in Africa/Nairobi.</p>
      </form>

      {state.loading ? <LoadingState label="Loading dashboard" /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={() => setApplied({ ...applied })} /> : null}
      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric to="/admin/reports" label={`Paid sales ${periodLabel}`} value={money(data.paid_sales)} hint="Succeeded payments, net of recorded refunds" />
            <Metric to="/admin/orders" label="Orders today" value={data.orders_today} hint="Order count, not revenue" />
            <Metric to="/admin/orders" label="Orders awaiting processing" value={data.pending_orders} hint="Pending payment through ready to dispatch" />
            <Metric to="/admin/payments?status=pending" label="Pending payments" value={data.pending_payments} hint="Not included in paid sales" />
            <Metric to="/admin/payments?status=failed" label="Failed payments" value={data.failed_payments} />
            <Metric to="/admin/inventory?low_stock=1" label="Low-stock products" value={data.low_stock_products?.length || 0} hint="Showing up to 8" />
            <Metric to="/admin/orders?payment_status=paid" label="Awaiting dispatch" value={data.orders_awaiting_dispatch} />
            <Metric to="/admin/deliveries?status=failed" label="Failed deliveries" value={data.failed_deliveries} />
            <Metric to="/admin/products?status=active" label="Active products" value={data.active_products} />
            <Metric to="/admin/customers" label="Active customers" value={data.active_customers} />
          </div>

          {isEmptyStore(data) ? (
            <div className="mt-6">
              <EmptyState
                title="The store is quiet"
                body="There are no orders or exceptions yet. Add a category, a product, and opening stock when you are ready to sell."
              />
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="panel p-5">
              <h2 className="display text-3xl">Recent orders</h2>
              {data.recent_orders?.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {data.recent_orders.map((order) => (
                    <li key={order.order_number} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <Link className="font-semibold underline-offset-2 hover:underline" to={`/admin/orders/${order.order_number}`}>
                          {order.order_number}
                        </Link>
                        <p className="text-sm text-muted">{formatWhen(order.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge value={order.payment_status} />
                        <span>{money(order.grand_total, order.currency)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-muted">No orders yet.</p>
              )}
            </section>
            <section className="panel p-5">
              <h2 className="display text-3xl">Exceptions</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <Exception to="/admin/orders" label="Orders requiring review" value={data.exceptions?.orders_requiring_review} />
                <Exception to="/admin/payments?status=failed" label="Failed payments" value={data.exceptions?.failed_payments} />
                <Exception to="/admin/deliveries?status=failed" label="Failed deliveries" value={data.exceptions?.failed_deliveries} />
              </ul>
              <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-muted">Low stock</h3>
              {data.low_stock_products?.length ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {data.low_stock_products.map((product) => (
                    <li key={product.id} className="flex justify-between gap-3">
                      <span>
                        {product.name} <span className="text-muted">{product.sku}</span>
                      </span>
                      <span>
                        {product.available} available
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">No products are at or below their threshold.</p>
              )}
              <p className="mt-4 text-xs text-muted">{data.sales_rule}</p>
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Metric({ to, label, value, hint }) {
  return (
    <Link to={to} className="panel block p-4 transition hover:-translate-y-0.5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="display mt-2 text-4xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Link>
  )
}

function Exception({ to, label, value }) {
  return (
    <li>
      <Link className="flex items-center justify-between rounded-xl bg-paper px-3 py-2" to={to}>
        <span>{label}</span>
        <strong>{value ?? 0}</strong>
      </Link>
    </li>
  )
}

function isEmptyStore(data) {
  return (
    !data.orders_today &&
    !data.pending_orders &&
    !data.active_products &&
    !Number(data.paid_sales) &&
    !data.recent_orders?.length
  )
}
