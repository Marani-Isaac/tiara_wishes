import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { availabilityLabel, discountPercent, mediaUrl, money, validCompareAt } from '../../utils/format'

const WELLS = ['#f3e6c4', '#efe6f6', '#e8d7a4', '#f7f1e8', '#e7ddf0', '#f6e7c8']

export function ProductMedia({ product, className = 'product-media' }) {
  const image = product.primary_image || product.images?.[0]
  if (!image?.image_url) {
    return (
      <div className="media-fallback" aria-hidden="true">
        {(product.name || 'T').slice(0, 1)}
      </div>
    )
  }
  return <img className={className} src={mediaUrl(image.image_url)} alt={image.alt_text || product.name} />
}

export default function ProductCard({ product }) {
  const stock = availabilityLabel(product.available_quantity)
  const showCompare = validCompareAt(product.cash_price, product.compare_at_price)
  const off = discountPercent(product.cash_price, product.compare_at_price)
  return (
    <article className="product-card">
      <Link to={`/products/${product.slug}`} className="card-media block" aria-label={product.name}>
        <ProductMedia product={product} />
        {off ? <span className="deal-flag" aria-hidden="true">-{off}%</span> : product.is_featured ? <span className="deal-flag" aria-hidden="true">Featured</span> : null}
      </Link>
      <div className="flex flex-1 flex-col p-3">
        {product.brand_name ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-plum">{product.brand_name}</p> : null}
        <h3 className="mt-1 font-semibold leading-snug">
          <Link to={`/products/${product.slug}`}>{product.name}</Link>
        </h3>
        <p className="mt-2">
          <span className="price text-plum">{money(product.cash_price, product.currency)}</span>
          {showCompare ? <span className="compare">{money(product.compare_at_price, product.currency)}</span> : null}
        </p>
        <p className={`badge badge-${stock.tone} mt-3 w-fit`}>{stock.text}</p>
      </div>
    </article>
  )
}

function rowsOf(products, size) {
  const rows = []
  for (let index = 0; index < products.length; index += size) {
    rows.push(products.slice(index, index + size))
  }
  return rows
}

function ProductRow({ products, index }) {
  const scroller = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  function measure() {
    const element = scroller.current
    if (!element) return
    setCanLeft(element.scrollLeft > 4)
    setCanRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 4)
  }

  useEffect(() => {
    measure()
    const element = scroller.current
    if (!element) return undefined
    element.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      element.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [products])

  function move(direction) {
    const element = scroller.current
    if (!element) return
    const card = element.querySelector('.product-card')
    const distance = (card ? card.getBoundingClientRect().width : 180) + 14
    element.scrollBy({ left: direction * distance * 2, behavior: 'smooth' })
  }

  return (
    <div className="product-row">
      <button type="button" className="row-arrow" aria-label={`Scroll row ${index + 1} left`} disabled={!canLeft} onClick={() => move(-1)}>
        <span aria-hidden="true">‹</span>
      </button>
      <div className="product-row-scroller" ref={scroller}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <button type="button" className="row-arrow" aria-label={`Scroll row ${index + 1} right`} disabled={!canRight} onClick={() => move(1)}>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  )
}

export function ProductGrid({ products, explore = false }) {
  if (explore) {
    return (
      <div className="product-rows">
        {rowsOf(products, 8).map((row, index) => (
          <ProductRow key={row[0].id} products={row} index={index} />
        ))}
      </div>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

export function CategoryIcon({ category }) {
  const label = `${category.slug || ''} ${category.name || ''}`.toLowerCase()
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true }
  if (/home|living|furniture|bed/.test(label)) {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    )
  }
  if (/kitchen|cook|food|dining/.test(label)) {
    return (
      <svg {...common}>
        <path d="M8 3v8M6 3v4a2 2 0 0 0 4 0V3M14 3v18M14 8h4a2 2 0 0 0 0-4h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (/electron|phone|tech|tv|appliance/.test(label)) {
    return (
      <svg {...common}>
        <rect x="6" y="3" width="12" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M11 18h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }
  if (/personal|care|beauty|health/.test(label)) {
    return (
      <svg {...common}>
        <path d="M12 3c2.2 3.2 4 5.4 4 8a4 4 0 0 1-8 0c0-2.6 1.8-4.8 4-8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M12 21v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }
  if (/attire|cloth|fashion|apparel|wear|shoe/.test(label)) {
    return (
      <svg {...common}>
        <path d="M8 6 4 8v3l4-1.2V20h8V9.8L20 11V8l-4-2-4 3-4-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    )
  }
  if (/accessor|jewel|watch|bag/.test(label)) {
    return (
      <svg {...common}>
        <path d="M12 3 15 9l6 .7-4.5 4.2 1.3 6.1L12 17l-5.8 3 1.3-6.1L3 9.7 9 9l3-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

export function CategoryRow({ categories }) {
  const scroller = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  function measure() {
    const element = scroller.current
    if (!element) return
    setCanLeft(element.scrollLeft > 4)
    setCanRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 4)
  }

  useEffect(() => {
    measure()
    const element = scroller.current
    if (!element) return undefined
    element.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      element.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [categories])

  function move(direction) {
    const element = scroller.current
    if (!element) return
    const card = element.querySelector('.dept-card')
    const distance = (card ? card.getBoundingClientRect().width : 232) + 14
    element.scrollBy({ left: direction * distance, behavior: 'smooth' })
  }

  return (
    <div className="product-row category-row">
      <button type="button" className="row-arrow" aria-label="Scroll categories left" disabled={!canLeft} onClick={() => move(-1)}>
        <span aria-hidden="true">‹</span>
      </button>
      <div className="product-row-scroller" ref={scroller}>
        {categories.map((category, index) => (
          <CategoryTile key={category.id} category={category} index={index} />
        ))}
      </div>
      <button type="button" className="row-arrow" aria-label="Scroll categories right" disabled={!canRight} onClick={() => move(1)}>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  )
}

export function CategoryTile({ category, index = 0 }) {
  return (
    <Link to={`/categories/${category.slug}`} className="dept-card" style={{ '--well': WELLS[index % WELLS.length] }}>
      <div className="dept-well">
        <span className="dept-icon">
          <CategoryIcon category={category} />
        </span>
      </div>
      <div className="dept-body">
        <h3 className="font-bold text-plum-deep">{category.name}</h3>
        <p className="dept-copy line-clamp-2 text-muted">{category.description || 'Browse the collection'}</p>
        <div className="dept-actions">
          <span>Explore</span>
          <span className="view-pill">View</span>
        </div>
      </div>
    </Link>
  )
}
