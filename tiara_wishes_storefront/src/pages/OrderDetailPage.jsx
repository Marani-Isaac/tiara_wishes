import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { initiatePayment } from '../api/checkout'
import { cancelOrder, getOrder, getPayment } from '../api/orders'
import { OrderStatusTimeline, statusTone } from '../components/account/OrderCard'
import MpesaPaybill from '../components/checkout/MpesaPaybill'
import { Button } from '../components/common/Button'
import { ErrorState, LoadingState } from '../components/common/States'
import { useToast } from '../context/ToastContext'
import { formatWhen, idempotencyKey, labelize, money } from '../utils/format'

export default function OrderDetailPage() {
  const { orderNumber } = useParams()
  const location = useLocation()
  const { push } = useToast()
  const [order, setOrder] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [payKey] = useState(idempotencyKey)

  async function load() {
    const body = await getOrder(orderNumber)
    setOrder(body.data)
    setStatus('ready')
    return body.data
  }

  useEffect(() => {
    let active = true
    setStatus('loading')
    load()
      .catch((err) => {
        if (!active) return
        setError(err)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [orderNumber])

  useEffect(() => {
    if (!order) return undefined
    const pending = ['unpaid', 'pending', 'failed'].includes(order.payment_status) && order.status === 'pending_payment'
    const reference = order.payments?.at(-1)?.merchant_reference
    if (!pending || !reference) return undefined
    const timer = window.setInterval(async () => {
      try {
        const payment = await getPayment(reference)
        if (['succeeded', 'failed', 'cancelled'].includes(payment.data.status)) {
          await load()
        }
      } catch {
        /* Keep the last trusted order until the next successful read. */
      }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [order?.payment_status, order?.order_number])

  async function retryPayment(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await initiatePayment(order.order_number, { provider: 'mpesa' }, payKey)
      await load()
      push('Payment started. It stays pending until the store confirms it.')
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onCancel() {
    if (!window.confirm('Cancel this unpaid order?')) return
    setBusy(true)
    try {
      const body = await cancelOrder(order.order_number, 'Cancelled by customer')
      setOrder(body.data)
      push('Order cancelled')
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') return <LoadingState label="Loading order" />
  if (status === 'error') return <ErrorState message={error?.message} />

  const address = order.delivery_address || {}
  const canPay = order.status === 'pending_payment' && ['unpaid', 'pending', 'failed'].includes(order.payment_status)
  const latest = order.payments?.at(-1)

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Order</p>
        <h2 className="display text-2xl">{order.order_number}</h2>
        <p className="text-sm text-muted">{formatWhen(order.created_at)}</p>
      </div>
      {location.state?.paymentError ? <p className="field-error" role="alert">{location.state.paymentError}</p> : null}
      {order.review_message ? <p className="panel p-4 text-sm" role="status">{order.review_message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <span className={`badge badge-${statusTone(order.payment_status)}`}>Payment {labelize(order.payment_status)}</span>
        <span className={`badge badge-${statusTone(order.status)}`}>{labelize(order.status)}</span>
        {latest ? <span className="badge badge-muted">Reference {latest.merchant_reference}</span> : null}
      </div>
      {canPay ? (
        <form className="panel space-y-3 p-5" onSubmit={retryPayment}>
          <MpesaPaybill amount={order.grand_total} currency={order.currency} />
          {order.reservation_expires_at ? <p className="text-sm">Reservation until {formatWhen(order.reservation_expires_at)}</p> : null}
          <div className="flex flex-wrap gap-2">
            {latest ? null : <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Save M-Pesa payment'}</Button>}
            <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Cancel order</Button>
          </div>
        </form>
      ) : null}
      <section className="panel p-5">
        <h3 className="display text-3xl">Items</h3>
        <ul className="mt-3 space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <span>{item.product_name} × {item.quantity}</span>
              <span className="price">{money(item.line_total, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal, order.currency)}</dd></div>
          <div className="flex justify-between"><dt>Discount</dt><dd>{money(order.discount_total, order.currency)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{money(order.delivery_fee, order.currency)}</dd></div>
          <div className="flex justify-between font-bold"><dt>Total</dt><dd>{money(order.grand_total, order.currency)}</dd></div>
        </dl>
      </section>
      <section className="panel p-5">
        <h3 className="display text-3xl">Delivery</h3>
        <p className="mt-2">{address.recipient_name}</p>
        <p className="text-sm text-muted">{address.recipient_phone}</p>
        <p className="mt-1 text-sm">{[address.building, address.house_or_unit, address.area_or_estate, address.town, address.county].filter(Boolean).join(', ')}</p>
        {address.delivery_instructions ? <p className="mt-2 text-sm text-muted">{address.delivery_instructions}</p> : null}
        <div className="mt-5">
          <OrderStatusTimeline order={order} />
        </div>
      </section>
      <Link to="/account/orders" className="text-sm font-semibold text-gold-deep">Back to orders</Link>
    </div>
  )
}
