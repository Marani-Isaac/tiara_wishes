import { Link } from 'react-router-dom'
import { mediaUrl, money } from '../../utils/format'
import { Button } from '../common/Button'

export function CartLine({ item, image, busy, onQuantity, onRemove }) {
  const max = Math.max(1, Math.min(99, Number(item.available_quantity) || 99))
  return (
    <article className="panel grid grid-cols-[5.5rem_1fr] gap-4 p-4 sm:grid-cols-[6.5rem_1fr_auto]">
      <Link to={`/products/${item.slug}`} className="block">
        {image?.image ? (
          <img src={mediaUrl(image.image)} alt={image.alt || item.name} className="aspect-square w-full rounded-2xl object-cover" />
        ) : (
          <div className="media-fallback aspect-square rounded-2xl text-2xl">{item.name.slice(0, 1)}</div>
        )}
      </Link>
      <div>
        <h2 className="font-semibold">
          <Link to={`/products/${item.slug}`}>{item.name}</Link>
        </h2>
        <p className="mt-1 text-sm text-muted">{money(item.unit_price)} each</p>
        {!item.available ? <p className="mt-2 text-sm text-danger">This item is no longer available and is excluded from the total.</p> : null}
        {item.available && item.quantity > item.available_quantity ? (
          <p className="mt-2 text-sm text-warn">The requested quantity is higher than what is currently available.</p>
        ) : null}
        <div className="mt-3 flex items-center gap-3">
          <div className="qty" aria-label={`Quantity for ${item.name}`}>
            <button type="button" aria-label="Decrease quantity" disabled={busy || item.quantity <= 1} onClick={() => onQuantity(item.id, item.quantity - 1)}>
              −
            </button>
            <span>{item.quantity}</span>
            <button type="button" aria-label="Increase quantity" disabled={busy || item.quantity >= max} onClick={() => onQuantity(item.id, item.quantity + 1)}>
              +
            </button>
          </div>
          <Button variant="danger" disabled={busy} onClick={() => onRemove(item.id)}>
            Remove
          </Button>
        </div>
      </div>
      <p className="price sm:text-right">{money(item.line_subtotal)}</p>
    </article>
  )
}

export function CartSummary({ cart, action }) {
  return (
    <aside className="panel h-fit p-5">
      <h2 className="display text-2xl">Summary</h2>
      <div className="mt-4 flex items-center justify-between">
        <span>Subtotal</span>
        <span className="price">{money(cart?.subtotal, cart?.currency)}</span>
      </div>
      <p className="mt-3 text-sm text-muted">{cart?.note || 'Totals are recalculated from current prices at checkout.'}</p>
      <p className="mt-2 text-sm text-muted">Delivery is calculated when you review the order.</p>
      {action}
    </aside>
  )
}
