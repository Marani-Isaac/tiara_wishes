import { labelize } from '../../lib/format'

const TONE = {
  paid: 'ok',
  succeeded: 'ok',
  active: 'ok',
  delivered: 'ok',
  approved: 'ok',
  confirmed: 'ok',
  pending: 'warn',
  pending_payment: 'warn',
  initiated: 'warn',
  processing: 'warn',
  packed: 'warn',
  draft: 'warn',
  failed: 'danger',
  cancelled: 'danger',
  refunded: 'danger',
  archived: 'muted',
  disabled: 'danger',
  partially_refunded: 'warn',
  refund_pending: 'warn',
  unpaid: 'muted',
  ready_to_dispatch: 'warn',
  dispatched: 'ok',
  in_transit: 'warn',
  returned: 'danger',
  failed_delivery: 'danger',
}

const CLASS_BY_TONE = {
  ok: 'badge-ok',
  warn: 'badge-warn',
  danger: 'badge-danger',
  muted: 'badge-muted',
}

export default function StatusBadge({ value }) {
  const tone = TONE[value] || 'muted'
  return <span className={`badge ${CLASS_BY_TONE[tone]}`}>{labelize(value)}</span>
}
