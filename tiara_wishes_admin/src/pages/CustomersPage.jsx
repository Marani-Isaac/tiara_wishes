import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listCustomers, updateCustomerStatus } from '../api/customers'
import ConfirmDialog from '../components/common/ConfirmDialog'
import DataTable from '../components/common/DataTable'
import Pagination from '../components/common/Pagination'
import SearchInput from '../components/common/SearchInput'
import StatusBadge from '../components/common/StatusBadge'
import { EmptyState, ErrorState, LoadingState, PageHeader, SuccessNote } from '../components/common/States'
import { useAdminAuth } from '../context/AdminAuthContext'
import { formatDay, personName, readPage } from '../lib/format'

export default function CustomersPage() {
  const { can } = useAdminAuth()
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState({ loading: true, error: null, rows: [], meta: null })
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: null }))
    listCustomers({
      page: readPage(params),
      per_page: 20,
      q: params.get('q') || undefined,
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

  async function changeStatus() {
    setBusy(true)
    try {
      const next = pending.status === 'active' ? 'disabled' : 'active'
      const body = await updateCustomerStatus(pending.id, next)
      setNotice(body.message)
      setPending(null)
      setParams(new URLSearchParams(params))
    } catch (error) {
      setState((current) => ({ ...current, error }))
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Customers"
        description="This list is accounts with the customer role. Order counts are not returned by the API, so they are not shown as zero."
      />
      <SuccessNote>{notice}</SuccessNote>
      <div className="panel mb-4 p-4">
        <SearchInput
          value={params.get('q') || ''}
          placeholder="Search name, email, or phone"
          onChange={(value) => {
            const next = new URLSearchParams(params)
            if (value.trim()) next.set('q', value.trim())
            else next.delete('q')
            next.delete('page')
            setParams(next)
          }}
        />
      </div>
      {state.loading ? <LoadingState label="Loading customers" /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={() => setParams(new URLSearchParams(params))} /> : null}
      {!state.loading && !state.error && state.rows.length === 0 ? (
        <EmptyState title="No customers" body="Customers appear after they register on the storefront." />
      ) : null}
      {state.rows.length > 0 ? (
        <div className="panel p-3">
          <DataTable
            rowKey={(row) => row.id}
            rows={state.rows}
            columns={[
              { key: 'name', header: 'Name', cell: (row) => personName(row) },
              { key: 'email', header: 'Email', cell: (row) => row.email },
              { key: 'phone', header: 'Phone', cell: (row) => row.phone || '—' },
              { key: 'joined', header: 'Registered', cell: (row) => formatDay(row.created_at) },
              { key: 'status', header: 'Status', cell: (row) => <StatusBadge value={row.status} /> },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <Link className="btn btn-ghost" to={`/admin/customers/${row.id}`} state={{ customer: row }}>
                      Open
                    </Link>
                    {can('customers.manage') ? (
                      <button className="btn btn-ghost" type="button" onClick={() => setPending(row)}>
                        {row.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    ) : null}
                  </div>
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
      <ConfirmDialog
        open={Boolean(pending)}
        danger={pending?.status === 'active'}
        title={pending?.status === 'active' ? 'Disable this account?' : 'Enable this account?'}
        body="Disabling an account revokes its refresh tokens. Staff cannot set a customer's password from here."
        confirmLabel="Update account"
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={changeStatus}
      />
    </div>
  )
}
