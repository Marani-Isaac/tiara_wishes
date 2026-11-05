import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listDeliveries } from '../api/deliveries'
import { createDeliveryPlace, deleteDeliveryPlace, listCounties, listDeliveryPlaces, updateDeliveryPlace } from '../api/deliveryPlaces'
import ConfirmDialog from '../components/common/ConfirmDialog'
import DataTable from '../components/common/DataTable'
import Pagination from '../components/common/Pagination'
import StatusBadge from '../components/common/StatusBadge'
import { EmptyState, ErrorState, FormField, LoadingState, PageHeader, SuccessNote } from '../components/common/States'
import { DELIVERY_STATUSES } from '../lib/constants'
import { formatWhen, money, readPage } from '../lib/format'

export default function DeliveriesPage() {
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState({ loading: true, error: null, rows: [], meta: null })

  useEffect(() => {
    let active = true
    listDeliveries({
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
        eyebrow="Fulfilment"
        title="Deliveries"
        description="Set a delivery fee for each checkout county. An order uses that county’s fee automatically. A county without a fee uses the flat delivery fee in Settings. Tracking numbers are entered by staff."
      />
      <DeliveryPlaces />
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
          {DELIVERY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      {state.loading ? <LoadingState label="Loading deliveries" /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={() => setParams(new URLSearchParams(params))} /> : null}
      {!state.loading && !state.error && state.rows.length === 0 ? (
        <EmptyState title="No deliveries" body="A delivery record is created with an order." />
      ) : null}
      {state.rows.length > 0 ? (
        <div className="panel p-3">
          <DataTable
            rowKey={(row) => row.id}
            rows={state.rows}
            columns={[
              {
                key: 'order',
                header: 'Order',
                cell: (row) => <Link to={`/admin/orders/${row.order_number}`}>{row.order_number}</Link>,
              },
              { key: 'provider', header: 'Provider', cell: (row) => row.provider || '—' },
              { key: 'tracking', header: 'Tracking', cell: (row) => row.tracking_number || '—' },
              { key: 'status', header: 'Status', cell: (row) => <StatusBadge value={row.status} /> },
              { key: 'dispatched', header: 'Dispatched', cell: (row) => formatWhen(row.dispatched_at) },
              { key: 'delivered', header: 'Delivered', cell: (row) => formatWhen(row.delivered_at) },
              { key: 'failure', header: 'Failure', cell: (row) => row.failure_reason || '—' },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <Link className="btn btn-ghost" to={`/admin/deliveries/${row.id}`} state={{ delivery: row }}>
                    Update
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

const PLACE_EMPTY = {
  name: '',
  normal_fee: '',
  delicate_fee: '',
  perishable_fee: '',
  sort_order: '0',
  is_active: true,
}

function DeliveryPlaces() {
  const [rows, setRows] = useState([])
  const [counties, setCounties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(PLACE_EMPTY)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [placesBody, countyBody] = await Promise.all([listDeliveryPlaces(), listCounties()])
      setRows(placesBody.data || [])
      setCounties(countyBody.data || [])
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    const payload = {
      name: form.name.trim(),
      normal_fee: form.normal_fee,
      delicate_fee: form.delicate_fee,
      perishable_fee: form.perishable_fee,
      sort_order: Number(form.sort_order || 0),
      is_active: form.is_active,
    }
    try {
      const body = editing ? await updateDeliveryPlace(editing, payload) : await createDeliveryPlace(payload)
      setNotice(body.message || 'Delivery place saved')
      setForm(PLACE_EMPTY)
      setEditing(null)
      await load()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      const body = await deleteDeliveryPlace(pending.id)
      setNotice(body.message || 'Delivery place deleted')
      setPending(null)
      await load()
    } catch (err) {
      setError(err)
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-8">
      <h2 className="display mb-2 text-3xl">County fees</h2>
      <p className="mb-4 text-sm text-muted">
        Choose a county from the same list the shopper sees when placing an order, then enter the fee. Checkout uses the normal, delicate, or perishable fee that matches the products in the cart. A county left out of this list keeps the flat delivery fee from Settings.
      </p>
      <SuccessNote>{notice}</SuccessNote>
      {error ? <div className="mb-4"><ErrorState error={error} /></div> : null}
      <form className="panel mb-4 grid max-w-4xl gap-3 p-4 md:grid-cols-2" onSubmit={save}>
        <FormField id="place-name" label="County">
          <select
            id="place-name"
            className="field"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          >
            <option value="">Choose a county</option>
            {counties.map((county) => {
              const taken = rows.some((row) => row.name === county && row.id !== editing)
              return (
                <option key={county} value={county} disabled={taken}>
                  {county}
                  {taken ? ' (fee already set)' : ''}
                </option>
              )
            })}
          </select>
        </FormField>
        <FormField id="place-sort" label="Sort order">
          <input id="place-sort" className="field" inputMode="numeric" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
        </FormField>
        <FormField id="place-normal" label="Normal fee (KES)">
          <input id="place-normal" className="field" required inputMode="decimal" value={form.normal_fee} onChange={(event) => setForm({ ...form, normal_fee: event.target.value })} />
        </FormField>
        <FormField id="place-delicate" label="Delicate fee (KES)">
          <input id="place-delicate" className="field" required inputMode="decimal" value={form.delicate_fee} onChange={(event) => setForm({ ...form, delicate_fee: event.target.value })} />
        </FormField>
        <FormField id="place-perishable" label="Perishable fee (KES)">
          <input id="place-perishable" className="field" required inputMode="decimal" value={form.perishable_fee} onChange={(event) => setForm({ ...form, perishable_fee: event.target.value })} />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
          Show this county at checkout
        </label>
        <div className="flex gap-2 md:col-span-2">
          <button className="btn btn-gold" type="submit" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save county fee' : 'Add county fee'}
          </button>
          {editing ? (
            <button className="btn btn-ghost" type="button" onClick={() => { setEditing(null); setForm(PLACE_EMPTY) }}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      {loading ? <LoadingState label="Loading places" /> : null}
      {!loading && rows.length === 0 ? <EmptyState title="No county fees" body="Add a county when checkout should use its own delivery fee." /> : null}
      {rows.length > 0 ? (
        <div className="panel p-3">
          <DataTable
            rowKey={(row) => row.id}
            rows={rows}
            columns={[
              { key: 'name', header: 'County', cell: (row) => row.name },
              { key: 'normal', header: 'Normal', cell: (row) => money(row.normal_fee) },
              { key: 'delicate', header: 'Delicate', cell: (row) => money(row.delicate_fee) },
              { key: 'perishable', header: 'Perishable', cell: (row) => money(row.perishable_fee) },
              { key: 'status', header: 'Storefront', cell: (row) => (row.is_active ? 'Shown' : 'Hidden') },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <div className="flex gap-2">
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => {
                        setEditing(row.id)
                        setForm({
                          name: row.name,
                          normal_fee: row.normal_fee,
                          delicate_fee: row.delicate_fee,
                          perishable_fee: row.perishable_fee,
                          sort_order: String(row.sort_order ?? 0),
                          is_active: Boolean(row.is_active),
                        })
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => setPending(row)}>
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pending)}
        danger
        title="Delete this county fee?"
        body="Orders to this county will use the flat delivery fee in Settings until you add it again."
        confirmLabel="Delete county fee"
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={remove}
      />
    </section>
  )
}
