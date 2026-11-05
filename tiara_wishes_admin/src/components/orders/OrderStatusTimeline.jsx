import { labelize } from '../../lib/format'

export default function OrderStatusTimeline({ order }) {
  const steps = [
    { label: 'Placed', done: true, detail: order.created_at },
    { label: 'Payment', done: order.payment_status === 'paid' || order.payment_status === 'partially_refunded', detail: order.payment_status },
    { label: 'Fulfilment', done: ['packed', 'dispatched', 'delivered'].includes(order.fulfilment_status), detail: order.fulfilment_status },
    { label: 'Current', done: true, detail: order.status },
  ]
  return (
    <ol className="grid gap-3 sm:grid-cols-4">
      {steps.map((step) => (
        <li key={step.label} className="rounded-xl border border-line bg-paper px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{step.label}</p>
          <p className="mt-1 capitalize">{labelize(step.detail)}</p>
          <p className="text-xs text-muted">{step.done ? 'Recorded' : 'Not recorded'}</p>
        </li>
      ))}
    </ol>
  )
}
