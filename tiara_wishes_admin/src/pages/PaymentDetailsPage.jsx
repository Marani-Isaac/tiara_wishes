import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPayment, reconcilePayment, recordRefund } from '../api/payments'
import ConfirmDialog from '../components/common/ConfirmDialog'
import StatusBadge from '../components/common/StatusBadge'
import { ErrorState, FormField, LoadingState, PageHeader, SuccessNote } from '../components/common/States'
import { useAdminAuth } from '../context/AdminAuthContext'
import { formatWhen, money } from '../lib/format'

export default function PaymentDetailsPage() {
  const { merchantReference } = useParams()
  const { can } = useAdminAuth()
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [status, setStatus] = useState('succeeded')
  const [note, setNote] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const body = await getPayment(merchantReference)
      setPayment(body.data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [merchantReference])

  async function run() {
    setBusy(true)
    try {
      const body =
        confirm === 'reconcile'
          ? await reconcilePayment(payment.id, { status, note: note.trim() })
          : await recordRefund({
              payment_id: payment.id,
              amount: refundAmount,
              reason: refundReason.trim(),
            })
      setNotice(body.message)
      setConfirm(null)
      if (confirm === 'reconcile') await load()
    } catch (err) {
      setError(err)
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState label="Loading payment" />
  if (error && !payment) return <ErrorState error={error} onRetry={load} />
  if (!payment) return null

  const summary = payment.provider_response_summary

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Payment"
        title={payment.merchant_reference}
        description="Provider secrets and raw callback bodies are not shown. Reconciliation is an audited staff action."
        actions={<Link className="btn btn-ghost" to="/admin/payments">All payments</Link>}
      />
      <SuccessNote>{notice}</SuccessNote>
      {error ? <ErrorState error={error} /> : null}
      <section className="panel space-y-2 p-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={payment.status} />
          <span>{money(payment.amount, payment.currency)}</span>
          <span className="text-muted">{payment.provider}</span>
        </div>
        {payment.order_number ? (
          <p>
            Order <Link className="underline" to={`/admin/orders/${payment.order_number}`}>{payment.order_number}</Link>
          </p>
        ) : null}
        <p>Initiated {formatWhen(payment.initiated_at)}</p>
        <p>Confirmed {formatWhen(payment.confirmed_at)}</p>
        <p>Provider reference {payment.provider_transaction_id || '—'}</p>
        <p>Response code {payment.provider_response_code || '—'}</p>
        <p>Phone {payment.phone_number || '—'}</p>
        {summary ? (
          <pre className="overflow-x-auto rounded-xl bg-paper p-3 text-xs">{formatSummary(summary)}</pre>
        ) : (
          <p className="text-muted">No provider summary was stored.</p>
        )}
      </section>
      <section className="panel p-5">
        <h2 className="display text-3xl">Reconcile</h2>
        <p className="mt-1 text-sm text-muted">
          Marking a payment succeeded tells the API to apply its payment rules and write an audit record. It does not call the provider, and it is refused without a note.
        </p>
        <form
          className="mt-3 grid max-w-4xl gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (note.trim().length < 8) {
              setError({ message: 'Enter a reconciliation note of at least 8 characters.' })
              return
            }
            setConfirm('reconcile')
          }}
        >
          <FormField id="pay-status" label="Recorded status">
            <select id="pay-status" className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </FormField>
          <FormField id="pay-note" label="Note">
            <input id="pay-note" className="field" value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>
          <button className="btn btn-gold" type="submit">Review reconciliation</button>
        </form>
      </section>
      {can('refunds.manage') ? (
        <section className="panel p-5">
          <h2 className="display text-3xl">Refund record</h2>
          <p className="mt-1 text-sm text-muted">
            This records a refund for reporting. It does not send money back through M-Pesa or any other provider.
          </p>
          <form
            className="mt-3 grid max-w-4xl gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              setConfirm('refund')
            }}
          >
            <FormField id="refund-amount" label="Amount">
              <input id="refund-amount" className="field" inputMode="decimal" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} required />
            </FormField>
            <FormField id="refund-reason" label="Reason">
              <input id="refund-reason" className="field" value={refundReason} onChange={(event) => setRefundReason(event.target.value)} required />
            </FormField>
            <button className="btn btn-ghost" type="submit">Review refund record</button>
          </form>
        </section>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        danger={confirm === 'reconcile' && status === 'succeeded'}
        title={confirm === 'refund' ? 'Record this refund?' : 'Reconcile this payment?'}
        body={
          confirm === 'refund'
            ? 'The API will store the refund and will not contact the payment provider.'
            : `Set this payment to ${status}. Success is recorded only if the API accepts the note and the payment rules.`
        }
        confirmLabel="Submit"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={run}
      />
    </div>
  )
}

function formatSummary(summary) {
  if (typeof summary === 'string') {
    try {
      return JSON.stringify(JSON.parse(summary), null, 2)
    } catch {
      return summary
    }
  }
  return JSON.stringify(summary, null, 2)
}
