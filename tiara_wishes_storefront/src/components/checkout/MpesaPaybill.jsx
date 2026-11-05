import { money } from '../../utils/format'

export const MPESA_PAYBILL = '247247'
export const MPESA_ACCOUNT = '7770180121934'

export default function MpesaPaybill({ amount, currency = 'KES' }) {
  return (
    <section className="paybill" aria-label="M-Pesa paybill">
      <h3 className="font-bold text-plum-deep">Pay with M-Pesa</h3>
      <dl>
        <div className="paybill-row">
          <dt>Paybill No.</dt>
          <dd>{MPESA_PAYBILL}</dd>
        </div>
        <div className="paybill-row">
          <dt>Account No.</dt>
          <dd>{MPESA_ACCOUNT}</dd>
        </div>
        {amount != null && amount !== '' ? (
          <div className="paybill-row">
            <dt>Amount</dt>
            <dd>{money(amount, currency)}</dd>
          </div>
        ) : null}
      </dl>
      <ol className="paybill-steps">
        <li>Open M-Pesa, then Lipa na M-Pesa, then Paybill.</li>
        <li>Enter the paybill number, the account number, and the amount above.</li>
        <li>Confirm the payment with your M-Pesa PIN.</li>
      </ol>
      <p className="text-sm text-muted">The order stays unpaid until the shop confirms this M-Pesa payment.</p>
    </section>
  )
}
