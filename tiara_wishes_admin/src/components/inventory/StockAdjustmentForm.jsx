import { useState } from 'react'
import { MOVEMENT_TYPES } from '../../lib/constants'
import { FormField } from '../common/States'

export default function StockAdjustmentForm({ product, onSubmit, busy, error }) {
  const [movement, setMovement] = useState('restock')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState('')

  if (!product) return null
  const rule = MOVEMENT_TYPES.find((item) => item.value === movement)
  const change = Number(quantity)
  const signed = Number.isInteger(change) ? change : null
  const nextOnHand = signed == null ? null : product.on_hand + signed
  const nextAvailable = nextOnHand == null ? null : nextOnHand - product.reserved

  function submit(event) {
    event.preventDefault()
    setLocalError('')
    if (!Number.isInteger(change) || change === 0) {
      setLocalError('Enter a non-zero whole number.')
      return
    }
    if (rule.sign === 'positive' && change < 0) {
      setLocalError('This movement must increase stock.')
      return
    }
    if (reason.trim().length < 3) {
      setLocalError('Enter a short reason.')
      return
    }
    if (nextOnHand < 0 || nextOnHand < product.reserved) {
      setLocalError('That change would drop on-hand stock below the quantity reserved for orders.')
      return
    }
    onSubmit({
      product_id: product.product_id,
      quantity_change: change,
      movement_type: movement,
      reason: reason.trim(),
    })
  }

  return (
    <form className="panel mb-4 max-w-4xl space-y-3 p-4" onSubmit={submit}>
      <h2 className="display text-3xl">Adjust {product.name}</h2>
      <p className="text-sm text-muted">
        On hand {product.on_hand} · Reserved {product.reserved} · Available {product.available}. Reserved units for open orders cannot be removed.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <FormField id="movement" label="Reason type">
          <select id="movement" className="field" value={movement} onChange={(event) => setMovement(event.target.value)}>
            {MOVEMENT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="qty" label="Quantity change" hint={rule.sign === 'positive' ? 'Use a positive whole number.' : 'Use a positive or negative whole number.'}>
          <input id="qty" className="field" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </FormField>
        <FormField id="reason" label="Reason">
          <input id="reason" className="field" value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>
      </div>
      <p className="text-sm">
        Preview: on hand {product.on_hand}
        {signed == null ? '' : ` → ${nextOnHand}`} · available {product.available}
        {signed == null ? '' : ` → ${nextAvailable}`}
      </p>
      {localError ? <p className="text-sm text-danger" role="alert">{localError}</p> : null}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <button className="btn btn-gold" type="submit" disabled={busy}>
        Review adjustment
      </button>
    </form>
  )
}
