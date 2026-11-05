import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listOrders } from '../api/orders'
import DataTable from '../components/common/DataTable'
import Pagination from '../components/common/Pagination'
import StatusBadge from '../components/common/StatusBadge'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/common/States'
import { ORDER_PAYMENT_STATUSES, ORDER_STATUSES } from '../lib/constants'
import { formatWhen, money, personName, readPage } from '../lib/format'

export default function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState({ loading: true, error: null, rows: [], meta: null })

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: null }))
    listOrders({
      page: readPage(params),
      per_page: 20,
      status: params.get('status') || undefined,
      payment_status: params.get('payment_status') || undefined,
    })
      .then((body) => {
        if (active) setState({ loading: false, error: null, rows: body.data || [], meta: body.meta })
      })
      .catch((error) => {
        if (active) setState({ loading: false, error, rows: [], meta: null })
      })
    return () => {
      active = false
    }
  }, [params])

  function update(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Fulfilment"
        title="Orders"
        description="Statuses and totals are the order record. Item names and addresses are the snapshots taken at checkout."
      />
      <div className="panel mb-4 flex flex-wrap gap-3 p-4">
        <select className="field max-w-56" value={params.get('status') || ''} onChange={(event) => update('status', event.target.value)}>
          <option value="">Any order status</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <select className="field max-w-56" value={params.get('payment_status') || ''} onChange={(event) => update('payment_status', event.target.value)}>
          <option value="">Any payment status</option>
          {ORDER_PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      {state.loading ? <LoadingState label="Loading orders" /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={() => setParams(new URLSearchParams(params))} /> : null}
      {!state.loading && !state.error && state.rows.length === 0 ? (
        <EmptyState title="No orders" body="Orders appear here after a customer checks out. Nothing is invented for an empty store." />
      ) : null}
      {state.rows.length > 0 ? (
        <div className="panel p-3">
          <DataTable
            rowKey={(row) => row.order_number}
            rows={state.rows}
            columns={[
              {
                key: 'number',
                header: 'Order',
                cell: (row) => (
                  <Link className="font-semibold underline-offset-2 hover:underline" to={`/admin/orders/${row.order_number}`}>
                    {row.order_number}
                  </Link>
                ),
              },
              { key: 'customer', header: 'Customer', cell: (row) => personName(row.customer) },
              { key: 'created', header: 'Created', cell: (row) => formatWhen(row.created_at) },
              { key: 'total', header: 'Total', cell: (row) => money(row.grand_total, row.currency) },
              { key: 'pay', header: 'Payment', cell: (row) => <StatusBadge value={row.payment_status} /> },
              { key: 'fulfil', header: 'Fulfilment', cell: (row) => <StatusBadge value={row.fulfilment_status} /> },
              { key: 'status', header: 'Order', cell: (row) => <StatusBadge value={row.status} /> },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <Link className="btn btn-ghost" to={`/admin/orders/${row.order_number}`}>
                    Open
                  </Link>
                ),
              },
            ]}
          />
          <Pagination meta={state.meta} onPage={(page) => update('page', String(page))} />
        </div>
      ) : null}
    </div>
  )
}
