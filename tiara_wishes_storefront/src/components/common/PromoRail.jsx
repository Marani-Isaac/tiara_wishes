import { Link } from 'react-router-dom'
import { mediaUrl, money } from '../../utils/format'

export function promotionOffer(promo) {
  const amount = Number(promo.value)
  if (promo.type === 'percentage' && Number.isFinite(amount)) return `${amount}% off`
  if (Number.isFinite(amount) && amount > 0) return money(promo.value)
  return ''
}

export default function PromoRail({ promotions = [], products = [] }) {
  if (promotions.length) {
    return (
      <div className="grid gap-3">
        {promotions.map((promo) => {
          const detail = promotionOffer(promo)
          return (
            <article key={promo.id} className={promo.image_url ? 'panel split-card has-media overflow-hidden' : 'panel overflow-hidden'}>
              <div className="split-copy">
                <p className="badge">Store promotion</p>
                <h3 className="mt-2 font-bold text-plum-deep">{promo.name}</h3>
                {detail ? <p className="mt-1 text-sm">{detail}</p> : null}
                {promo.code ? <p className="mt-1 text-sm text-muted">Code {promo.code}, checked at checkout.</p> : null}
                <Link to="/shop" className="mt-3 inline-block text-sm font-semibold text-plum">Shop with this offer</Link>
              </div>
              {promo.image_url ? <img className="split-media" src={mediaUrl(promo.image_url)} alt="" /> : null}
            </article>
          )
        })}
      </div>
    )
  }

  if (products.length) {
    return (
      <article className="panel p-4">
        <p className="badge">In the shop</p>
        <ul className="mt-3 space-y-2 text-sm">
          {products.slice(0, 3).map((product) => (
            <li key={product.id}>
              <Link to={`/products/${product.slug}`} className="font-semibold text-plum-deep">{product.name}</Link>
              <span className="ml-2 text-muted">{money(product.cash_price, product.currency)}</span>
            </li>
          ))}
        </ul>
      </article>
    )
  }

  return (
    <article className="panel p-4">
      <p className="badge">Not listed?</p>
      <h3 className="mt-2 font-bold text-plum-deep">Ask the shop to source it</h3>
      <Link to="/contact" className="mt-3 inline-block text-sm font-semibold text-plum">Request a product</Link>
    </article>
  )
}
