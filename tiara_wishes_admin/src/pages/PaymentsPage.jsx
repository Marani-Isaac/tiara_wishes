import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listPayments } from '../api/payments'
import DataTable from '../components/common/DataTable'
import Pagination from '../components/common/Pagination'
import StatusBadge from '../components/common/StatusBadge'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/common/States'
import { PAYMENT_STATUSES } from '../lib/constants'
import { formatWhen, money, readPage } from '../lib/format'

export default function PaymentsPage() {
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState({ loading: true, error: null, rows: [], meta: null })

  useEffect(() => {
    let active = true
    listPayments({
      page: readPage(params),
      per_page: 20,
      status: params.get('status') || undefined,
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

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Payments"
        description="A payment is successful only when the API says so. This screen cannot invent a successful charge."
      />
      <div className="panel mb-4 p-4">
        <select
          className="field max-w-56"
          value={params.get('status') || ''}
          onChange={(event) => {
            const next = new URLSearchParams(params)
            if (event.target.value) next.set('status', event.target.value)
            else next.delete('status')
            next.delete('page')
            setParams(next)
          }}
        >
          <option value="">Any status</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      {state.loading ? <LoadingState label="Loading payments" /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={() => setParams(new URLSearchParams(params))} /> : null}
      {!state.loading && !state.error && state.rows.length === 0 ? (
        <EmptyState title="No payments" body="Payment attempts appear after checkout. Pending rows are not revenue." />
      ) : null}
      {state.rows.length > 0 ? (
        <div className="panel p-3">
          <DataTable
            rowKey={(row) => row.id}
            rows={state.rows}
            columns={[
              {
                key: 'ref',
                header: 'Reference',
                cell: (row) => (
                  <Link className="font-semibold underline-offset-2 hover:underline" to={`/admin/payments/${row.merchant_reference}`}>
                    {row.merchant_reference}
                  </Link>
                ),
              },
              {
                key: 'order',
                header: 'Order',
                cell: (row) =>
                  row.order_number ? <Link to={`/admin/orders/${row.order_number}`}>{row.order_number}</Link> : '—',
              },
              { key: 'provider', header: 'Provider', cell: (row) => row.provider },
              { key: 'amount', header: 'Amount', cell: (row) => money(row.amount, row.currency) },
              { key: 'status', header: 'Status', cell: (row) => <StatusBadge value={row.status} /> },
              { key: 'when', header: 'Initiated', cell: (row) => formatWhen(row.initiated_at) },
              { key: 'txn', header: 'Provider reference', cell: (row) => row.provider_transaction_id || '—' },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <Link className="btn btn-ghost" to={`/admin/payments/${row.merchant_reference}`}>
                    Review
                  </Link>
                ),
              },
            ]}
          />
          <Pagination
            meta={state.meta}
            onPage={(page) => {
              const next = new URLSearchParams(params)
              next.set('page', String(page))
              setParams(next)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
