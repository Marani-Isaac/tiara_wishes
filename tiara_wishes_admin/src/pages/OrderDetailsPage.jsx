import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOrder, updateOrderStatus } from '../api/orders'
import ConfirmDialog from '../components/common/ConfirmDialog'
import StatusBadge from '../components/common/StatusBadge'
import { ErrorState, FormField, LoadingState, PageHeader, SuccessNote } from '../components/common/States'
import OrderStatusTimeline from '../components/orders/OrderStatusTimeline'
import { ORDER_TRANSITIONS } from '../lib/constants'
import { formatWhen, labelize, money, personName } from '../lib/format'

export default function OrderDetailsPage() {
  const { orderNumber } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [status, setStatus] = useState('')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const body = await getOrder(orderNumber)
      setOrder(body.data)
      setStatus('')
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [orderNumber])

  async function saveStatus() {
    setBusy(true)
    try {
      const body = await updateOrderStatus(order.order_number, { status, note: note.trim() || null })
      setOrder(body.data)
      setNotice(body.message || 'Order updated')
      setConfirm(false)
      setNote('')
      setStatus('')
    } catch (err) {
      setError(err)
      setConfirm(false)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState label="Loading order" />
  if (error && !order) return <ErrorState error={error} onRetry={load} />
  if (!order) return null

  const nextStatuses = ORDER_TRANSITIONS[order.status] || []
  const paymentMismatch = (order.payments || []).some((payment) => {
    if (payment.status === 'succeeded' && order.payment_status !== 'paid' && order.payment_status !== 'partially_refunded' && order.payment_status !== 'refunded') return true
    if (payment.status === 'failed' && order.payment_status === 'paid') return true
    return false
  })

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={order.order_number}
        title="Order detail"
        description={`Placed ${formatWhen(order.created_at)}. Currency ${order.currency}.`}
        actions={<Link className="btn btn-ghost" to="/admin/orders">All orders</Link>}
      />
      <SuccessNote>{notice}</SuccessNote>
      {error ? <ErrorState error={error} /> : null}
      {order.requires_review ? (
        <p className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn" role="status">
          This order needs review{order.review_reason ? `: ${order.review_reason}` : ''}.
        </p>
      ) : null}
      {paymentMismatch ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="status">
          A payment record does not agree with the order payment status. Reconcile it from the payment screen. Do not mark it paid from here.
        </p>
      ) : null}
      <OrderStatusTimeline order={order} />
      <section className="panel p-5">
        <h2 className="display text-3xl">Customer</h2>
        <p className="mt-2">{personName(order.customer)}</p>
        <p className="text-sm text-muted">{order.customer?.email}</p>
        <p className="text-sm text-muted">{order.customer?.phone || 'No phone'}</p>
        {order.customer?.id ? (
          <Link className="mt-3 inline-block text-sm underline" to={`/admin/customers/${order.customer.id}`} state={{ customer: order.customer }}>
            Customer record
          </Link>
        ) : null}
      </section>
      <section className="panel p-5">
        <h2 className="display text-3xl">Items</h2>
        <ul className="mt-3 divide-y divide-line">
          {(order.items || []).map((item) => (
            <li key={item.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-semibold">{item.product_name}</p>
                <p className="text-muted">{item.sku} · {item.quantity} × {money(item.unit_price, order.currency)}</p>
              </div>
              <p>{money(item.line_total, order.currency)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 text-sm">
          <Row label="Subtotal" value={money(order.subtotal, order.currency)} />
          <Row label="Discounts" value={money(order.discount_total, order.currency)} />
          <Row label="Delivery" value={money(order.delivery_fee, order.currency)} />
          <Row label="Tax" value={money(order.tax_total, order.currency)} />
          <Row label="Total" value={money(order.grand_total, order.currency)} />
        </dl>
      </section>
      <section className="panel p-5">
        <h2 className="display text-3xl">Delivery address snapshot</h2>
        <Address address={order.delivery_address} />
        {order.delivery ? (
          <p className="mt-3 text-sm">
            Delivery status <StatusBadge value={order.delivery.status} />
            {order.delivery.tracking_number ? ` · ${order.delivery.tracking_number}` : ''}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">No delivery record yet.</p>
        )}
        {order.delivery?.events?.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {order.delivery.events.map((event) => (
              <li key={event.id}>
                {labelize(event.status)} · {formatWhen(event.created_at)} {event.note ? `· ${event.note}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="panel p-5">
        <h2 className="display text-3xl">Payments</h2>
        {(order.payments || []).length === 0 ? <p className="mt-2 text-sm text-muted">No payment attempts.</p> : null}
        <ul className="mt-3 space-y-3">
          {(order.payments || []).map((payment) => (
            <li key={payment.id} className="rounded-xl border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link className="font-semibold underline" to={`/admin/payments/${payment.merchant_reference}`}>
                  {payment.merchant_reference}
                </Link>
                <StatusBadge value={payment.status} />
              </div>
              <p className="mt-1 text-muted">
                {payment.provider} · {money(payment.amount, payment.currency)} · {formatWhen(payment.initiated_at)}
              </p>
              {payment.provider_transaction_id ? <p>Provider reference {payment.provider_transaction_id}</p> : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="panel p-5">
        <h2 className="display text-3xl">Move status</h2>
        {nextStatuses.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No further status changes are allowed from {labelize(order.status)}.</p>
        ) : (
          <form
            className="mt-3 grid max-w-4xl gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              setConfirm(true)
            }}
          >
            <FormField id="next-status" label="Next status" hint="Only transitions the API allows are listed.">
              <select id="next-status" className="field" required value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Choose</option>
                {nextStatuses.map((item) => (
                  <option key={item} value={item}>
                    {labelize(item)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="note" label="Internal note">
              <input id="note" className="field" value={note} onChange={(event) => setNote(event.target.value)} />
            </FormField>
            <button className="btn btn-gold" type="submit">
              Review change
            </button>
          </form>
        )}
        {order.cancellation_reason ? <p className="mt-3 text-sm text-muted">Cancellation: {order.cancellation_reason}</p> : null}
        {order.customer_note ? <p className="mt-2 text-sm">Customer note: {order.customer_note}</p> : null}
      </section>
      <ConfirmDialog
        open={confirm}
        title="Update this order?"
        body={`Move ${order.order_number} from ${labelize(order.status)} to ${labelize(status)}. Paid orders cannot be cancelled directly.`}
        confirmLabel="Update order"
        busy={busy}
        onClose={() => setConfirm(false)}
        onConfirm={saveStatus}
      />
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function Address({ address }) {
  if (!address) return <p className="text-sm text-muted">No address snapshot.</p>
  return (
    <p className="mt-2 text-sm">
      {address.recipient_name} · {address.recipient_phone}
      <br />
      {[address.building, address.house_or_unit, address.area_or_estate, address.town, address.county].filter(Boolean).join(', ')}
      {address.delivery_instructions ? <><br />{address.delivery_instructions}</> : null}
    </p>
  )
}
