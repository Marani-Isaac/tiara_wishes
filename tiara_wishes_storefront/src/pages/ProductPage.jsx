import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProduct, listProducts, listReviews } from '../api/catalog'
import ProductGallery from '../components/catalog/ProductGallery'
import WatchVideo from '../components/catalog/WatchVideo'
import { ProductGrid } from '../components/catalog/ProductCard'
import Breadcrumbs from '../components/layout/Breadcrumbs'
import { Button } from '../components/common/Button'
import { ErrorState, LoadingState } from '../components/common/States'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { availabilityLabel, formatDay, money, validCompareAt } from '../utils/format'

export default function ProductPage() {
  const { slug } = useParams()
  const { add } = useCart()
  const { push } = useToast()
  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [reviews, setReviews] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setStatus('loading')
    setQuantity(1)
    getProduct(slug)
      .then(async (body) => {
        if (!active) return
        setProduct(body.data)
        setStatus('ready')
        const [relatedBody, reviewBody] = await Promise.all([
          body.data.category_slug
            ? listProducts({ category: body.data.category_slug, per_page: 4, sort: 'newest' })
            : Promise.resolve({ data: [] }),
          Number(body.data.review_count) > 0 ? listReviews(slug, { per_page: 6 }) : Promise.resolve({ data: [] }),
        ])
        if (!active) return
        setRelated((relatedBody.data || []).filter((item) => item.slug !== slug))
        setReviews(reviewBody.data || [])
      })
      .catch((err) => {
        if (!active) return
        setError(err)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [slug])

  if (status === 'loading') {
    return <div className="shell py-8"><LoadingState label="Loading product" /></div>
  }
  if (status === 'error') {
    return <div className="shell py-8"><ErrorState message={error?.message} /></div>
  }

  const stock = availabilityLabel(product.available_quantity)
  const max = Math.max(1, Math.min(99, Number(product.available_quantity) || 1))
  const showCompare = validCompareAt(product.cash_price, product.compare_at_price)
  const out = stock.tone === 'danger'
  const path = product.category_path?.length
    ? product.category_path.map((item) => ({ label: item.name, to: `/categories/${item.slug}` }))
    : product.category_slug
      ? [{ label: product.category_name, to: `/categories/${product.category_slug}` }]
      : []
  const specs = specificationRows(product)
  const savings = showCompare ? discountPercent(product.cash_price, product.compare_at_price) : 0

  async function onAdd() {
    setBusy(true)
    try {
      await add(product, quantity)
      push(`${product.name} added to your cart`)
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shell py-8">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Shop', to: '/shop' },
          ...path,
          { label: product.name },
        ]}
      />
      <article className="product-sheet panel">
        <ProductGallery images={product.images} name={product.name} />
        <div className="product-summary">
          <div>
            {product.brand_name ? <p className="eyebrow">{product.brand_name}</p> : null}
            <h1 className="display mt-2 text-2xl">{product.name}</h1>
            <p className="mt-3 text-lg">
              <span className="price">{money(product.cash_price, product.currency)}</span>
              {showCompare ? <span className="compare">{money(product.compare_at_price, product.currency)}</span> : null}
              {savings ? <span className="badge ml-2">{savings}% less than the comparison price</span> : null}
            </p>
            <p className={`badge badge-${stock.tone} mt-3`}>{stock.text}</p>
            {product.short_description ? <p className="mt-3 text-muted">{product.short_description}</p> : null}
          </div>
          <div className="product-buy">
            <div className="qty">
              <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)}>−</button>
              <span>{quantity}</span>
              <button type="button" aria-label="Increase quantity" disabled={quantity >= max || out} onClick={() => setQuantity((value) => value + 1)}>+</button>
            </div>
            <Button disabled={busy || out} onClick={onAdd}>
              {busy ? 'Adding…' : out ? 'Out of stock' : 'Add to cart'}
            </Button>
            <WatchVideo url={product.usage_video_url} name={product.name} />
            {out ? <Link to={`/contact?product=${encodeURIComponent(product.name)}`} className="btn btn-ghost">Request it</Link> : null}
          </div>
          {product.key_features?.length || specs.length || product.box_contents?.length || product.description ? (
            <div>
              {product.key_features?.length ? (
                <section className="detail-block">
                  <h2>Key features</h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {product.key_features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {specs.length ? (
                <section className="detail-block">
                  <h2>Specifications</h2>
                  <dl className="spec-list">
                    {specs.map(([label, value], index) => (
                      <div key={`${label}-${index}`} className="spec-row">
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}
              {product.box_contents?.length ? (
                <section className="detail-block">
                  <h2>What&apos;s in the box</h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {product.box_contents.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {product.description ? (
                <section className="detail-block">
                  <h2>Product details</h2>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted">{product.description}</p>
                </section>
              ) : null}
            </div>
          ) : null}
          <p className="text-sm text-muted">
            Chama purchasing is coming soon.{' '}
            <Link to="/chamas" className="font-semibold text-gold-deep">Read about Chamas</Link>
          </p>
        </div>
      </article>
      {Number(product.review_count) > 0 ? (
        <section className="mt-12">
          <h2 className="display text-2xl">Reviews</h2>
          <p className="mt-2 text-sm text-muted">
            {product.average_rating} from {product.review_count} approved {product.review_count === 1 ? 'review' : 'reviews'}
          </p>
          <div className="mt-4 grid gap-3">
            {reviews.map((review) => (
              <article key={review.id} className="panel p-4">
                <p className="font-semibold">{review.title || `${review.rating} of 5`}</p>
                <p className="text-sm text-muted">{review.reviewer_first_name} · {formatDay(review.created_at)} · {review.rating} of 5</p>
                {review.comment ? <p className="mt-2">{review.comment}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {related.length ? (
        <section className="mt-12">
          <h2 className="display text-2xl">More in this category</h2>
          <div className="product-scroller mt-4">
            <ProductGrid products={related} explore />
          </div>
        </section>
      ) : null}
    </div>
  )
}

function specificationRows(product) {
  const rows = []
  if (product.sku) rows.push(['SKU', product.sku])
  if (product.model_name) rows.push(['Model', product.model_name])
  if (product.size_label) rows.push(['Size', product.size_label])
  if (product.length || product.width || product.height) {
    rows.push(['Dimensions (cm)', [product.length, product.width, product.height].map((part) => part || '—').join(' × ')])
  }
  if (product.weight) rows.push(['Weight (kg)', product.weight])
  if (product.material) rows.push(['Main material', product.material])
  if (product.warranty) rows.push(['Warranty', product.warranty])
  if (product.brand_name) rows.push(['Brand', product.brand_name])
  for (const row of product.specifications || []) {
    if (row?.label && row?.value) rows.push([row.label, row.value])
  }
  return rows
}

function discountPercent(cash, compare) {
  const current = Number(cash)
  const previous = Number(compare)
  if (!previous || Number.isNaN(current) || Number.isNaN(previous) || previous <= current) return 0
  return Math.round((1 - current / previous) * 100)
}
