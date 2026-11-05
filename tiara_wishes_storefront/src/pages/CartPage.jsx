import { Link } from 'react-router-dom'
import { CartLine, CartSummary } from '../components/cart/CartLine'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'

export default function CartPage() {
  const { cart, status, error, images, refresh, update, remove } = useCart()
  const { push } = useToast()
  const items = cart?.items || []
  const blocked = items.some((item) => !item.available || item.quantity > item.available_quantity)

  async function change(id, quantity) {
    try {
      await update(id, quantity)
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function drop(id) {
    try {
      await remove(id)
      push('Item removed')
    } catch (err) {
      push(err.message, 'error')
    }
  }

  return (
    <div className="shell py-8">
      <p className="eyebrow">Cart</p>
      <h1 className="display mt-2 text-3xl text-plum">Your cart</h1>
      {status === 'loading' ? <div className="mt-6"><LoadingState label="Loading cart" /></div> : null}
      {status === 'error' ? <div className="mt-6"><ErrorState message={error?.message} onRetry={refresh} /></div> : null}
      {status === 'ready' && items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Your cart is empty"
            message="Add something from the shop. You can browse without creating an account."
            action={<Link to="/shop" className="btn">Continue shopping</Link>}
          />
        </div>
      ) : null}
      {status === 'ready' && items.length > 0 ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            {items.map((item) => (
              <CartLine
                key={item.id}
                item={item}
                image={images[item.product_id]}
                onQuantity={change}
                onRemove={drop}
              />
            ))}
          </div>
          <CartSummary
            cart={cart}
            action={
              <div className="mt-5 grid gap-2">
                <Link to="/checkout" className={`btn btn-block ${blocked ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={blocked}>
                  Proceed to checkout
                </Link>
                {blocked ? <p className="text-sm text-danger">Remove unavailable items, or lower the quantity, before checkout.</p> : null}
                <Link to="/shop" className="btn btn-ghost btn-block">Continue shopping</Link>
              </div>
            }
          />
        </div>
      ) : null}
    </div>
  )
}
