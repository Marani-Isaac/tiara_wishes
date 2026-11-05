import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listAuditLogs } from '../api/audit'
import DataTable from '../components/common/DataTable'
import Pagination from '../components/common/Pagination'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/common/States'
import { formatWhen, readPage } from '../lib/format'

const TYPES = ['', 'product', 'category', 'brand', 'order', 'payment', 'refund', 'delivery', 'promotion', 'site_content', 'user']

export default function AuditLogsPage() {
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState({ loading: true, error: null, rows: [], meta: null })

  useEffect(() => {
    let active = true
    listAuditLogs({
      page: readPage(params),
      per_page: 20,
      entity_type: params.get('entity_type') || undefined,
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
        eyebrow="History"
        title="Audit logs"
        description="Sensitive changes are recorded by the API. Secrets are redacted before they are stored."
      />
      <div className="panel mb-4 p-4">
        <select
          className="field max-w-56"
          value={params.get('entity_type') || ''}
          onChange={(event) => {
            const next = new URLSearchParams(params)
            if (event.target.value) next.set('entity_type', event.target.value)
            else next.delete('entity_type')
            next.delete('page')
            setParams(next)
          }}
        >
          {TYPES.map((type) => (
            <option key={type || 'all'} value={type}>
              {type || 'All records'}
            </option>
          ))}
        </select>
      </div>
      {state.loading ? <LoadingState label="Loading audit logs" /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={() => setParams(new URLSearchParams(params))} /> : null}
      {!state.loading && !state.error && state.rows.length === 0 ? (
        <EmptyState title="No audit rows" body="Changes to catalogue, stock, orders, payments, and access will appear here." />
      ) : null}
      {state.rows.length > 0 ? (
        <div className="panel p-3">
          <DataTable
            rowKey={(row) => row.id}
            rows={state.rows}
            columns={[
              { key: 'when', header: 'When', cell: (row) => formatWhen(row.created_at) },
              { key: 'action', header: 'Action', cell: (row) => row.action },
              { key: 'entity', header: 'Record', cell: (row) => `${row.entity_type} ${row.entity_id || ''}` },
              { key: 'actor', header: 'Actor', cell: (row) => row.actor_user_id || 'System' },
              {
                key: 'change',
                header: 'Change',
                cell: (row) => (
                  <pre className="max-w-md overflow-x-auto whitespace-pre-wrap text-xs">
                    {JSON.stringify({ before: row.before, after: row.after }, null, 2)}
                  </pre>
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
