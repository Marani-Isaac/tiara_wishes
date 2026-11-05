import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { updateDelivery } from '../api/deliveries'
import { getOrder } from '../api/orders'
import ConfirmDialog from '../components/common/ConfirmDialog'
import StatusBadge from '../components/common/StatusBadge'
import { FormField, PageHeader, SuccessNote } from '../components/common/States'
import { useAdminAuth } from '../context/AdminAuthContext'
import { DELIVERY_STATUSES } from '../lib/constants'
import { formatWhen, labelize } from '../lib/format'

export default function DeliveryDetailsPage() {
  const { id } = useParams()
  const location = useLocation()
  const { can } = useAdminAuth()
  const initial = location.state?.delivery
  const [delivery, setDelivery] = useState(initial && String(initial.id) === String(id) ? initial : null)
  const [events, setEvents] = useState([])
  const [form, setForm] = useState({
    status: initial?.status || 'pending',
    provider: initial?.provider || '',
    tracking_number: initial?.tracking_number || '',
    failure_reason: initial?.failure_reason || '',
    note: '',
  })
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!delivery?.order_number || !can('orders.manage')) return
    getOrder(delivery.order_number)
      .then((body) => setEvents(body.data?.delivery?.events || []))
      .catch(() => setEvents([]))
  }, [delivery?.order_number, can])

  if (!delivery) {
    return (
      <div className="panel p-6">
        <h1 className="display text-3xl">Open this delivery from the list</h1>
        <p className="mt-2 text-muted">The API updates a delivery by id, but it does not offer a single-delivery lookup.</p>
        <Link className="btn btn-ghost mt-4" to="/admin/deliveries">All deliveries</Link>
      </div>
    )
  }

  async function save() {
    if (form.status === 'failed' && form.failure_reason.trim().length < 3) {
      setError('Record a failure reason.')
      setConfirm(false)
      return
    }
    setBusy(true)
    setError('')
    try {
      const body = await updateDelivery(delivery.id, {
        status: form.status,
        provider: form.provider.trim() || null,
        tracking_number: form.tracking_number.trim() || null,
        failure_reason: form.failure_reason.trim() || null,
        note: form.note.trim() || null,
      })
      setDelivery(body.data)
      setNotice(body.message || 'Delivery updated')
      setConfirm(false)
    } catch (err) {
      setError(err.message)
      setConfirm(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Delivery"
        title={delivery.order_number || `Delivery ${delivery.id}`}
        description="Status changes also update the order fulfilment state through the API."
        actions={<Link className="btn btn-ghost" to="/admin/deliveries">All deliveries</Link>}
      />
      <SuccessNote>{notice}</SuccessNote>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <p>
        Current <StatusBadge value={delivery.status} />
      </p>
      <form
        className="panel grid max-w-4xl gap-3 p-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          setConfirm(true)
        }}
      >
        <FormField id="del-status" label="Status" hint="The API accepts these statuses. There is no live carrier feed.">
          <select id="del-status" className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            {DELIVERY_STATUSES.map((status) => (
              <option key={status} value={status}>{labelize(status)}</option>
            ))}
          </select>
        </FormField>
        <FormField id="del-provider" label="Provider">
          <input id="del-provider" className="field" value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} />
        </FormField>
        <FormField id="del-tracking" label="Tracking reference">
          <input id="del-tracking" className="field" value={form.tracking_number} onChange={(event) => setForm({ ...form, tracking_number: event.target.value })} />
        </FormField>
        <FormField id="del-failure" label="Failure reason" hint="Required in this form when the status is failed.">
          <input id="del-failure" className="field" value={form.failure_reason} onChange={(event) => setForm({ ...form, failure_reason: event.target.value })} />
        </FormField>
        <FormField id="del-note" label="Note">
          <input id="del-note" className="field" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        </FormField>
        <button className="btn btn-gold" type="submit">Review update</button>
      </form>
      <section className="panel p-5">
        <h2 className="display text-3xl">Event history</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Events are stored on the order delivery record. They appear here when this account can read orders.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {events.map((event) => (
              <li key={`${event.id}-${event.created_at}`}>
                {labelize(event.status)} · {formatWhen(event.created_at)} {event.note ? `· ${event.note}` : ''}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-muted">Dispatched {formatWhen(delivery.dispatched_at)} · Delivered {formatWhen(delivery.delivered_at)}</p>
      </section>
      <ConfirmDialog
        open={confirm}
        title="Update this delivery?"
        body={`Set the delivery to ${labelize(form.status)}. The order fulfilment status will follow.`}
        confirmLabel="Update delivery"
        busy={busy}
        onClose={() => setConfirm(false)}
        onConfirm={save}
      />
    </div>
  )
}
