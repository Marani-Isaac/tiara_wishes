import { Link } from 'react-router-dom'
import { formatWhen, labelize, money } from '../../utils/format'

const FLOW = ['pending_payment', 'confirmed', 'processing', 'ready_to_dispatch', 'dispatched', 'delivered']

export function statusTone(status) {
  if (['paid', 'succeeded', 'delivered', 'confirmed'].includes(status)) return 'ok'
  if (['pending', 'pending_payment', 'unpaid', 'processing', 'initiated'].includes(status)) return 'warn'
  if (['failed', 'cancelled', 'refunded'].includes(status)) return 'danger'
  return 'muted'
}

export function OrderCard({ order }) {
  return (
    <article className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            <Link to={`/account/orders/${order.order_number}`}>{order.order_number}</Link>
          </h2>
          <p className="text-sm text-muted">{formatWhen(order.created_at)}</p>
        </div>
        <p className="price">{money(order.grand_total, order.currency)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`badge badge-${statusTone(order.payment_status)}`}>Payment {labelize(order.payment_status)}</span>
        <span className={`badge badge-${statusTone(order.status)}`}>{labelize(order.status)}</span>
      </div>
    </article>
  )
}

export function OrderStatusTimeline({ order }) {
  const cancelled = ['cancelled', 'failed', 'refunded', 'refund_pending'].includes(order.status)
  const current = FLOW.indexOf(order.status)
  const events = order.delivery?.events || []

  return (
    <div>
      {cancelled ? <p className={`badge badge-${statusTone(order.status)} mb-4`}>{labelize(order.status)}</p> : null}
      <ol className="timeline">
        {FLOW.map((status, index) => (
          <li key={status}>
            <span className={index <= current ? 'dot on' : 'dot'} />
            <div>
              <p className="font-semibold capitalize">{labelize(status)}</p>
              {index === current ? <p className="text-sm text-muted">Current order status</p> : null}
            </div>
          </li>
        ))}
      </ol>
      {events.length ? (
        <div className="mt-6">
          <h3 className="font-semibold">Delivery updates</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {events.map((event) => (
              <li key={event.id}>
                <span className="font-semibold capitalize">{labelize(event.status)}</span>
                {event.note ? ` — ${event.note}` : ''}
                <span className="block text-muted">{formatWhen(event.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
