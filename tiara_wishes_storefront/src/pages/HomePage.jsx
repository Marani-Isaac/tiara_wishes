import { Link, useOutletContext } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { listCategories, listProducts } from '../api/catalog'
import { ProductGrid } from '../components/catalog/ProductCard'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { promotionOffer } from '../components/common/PromoRail'
import HeroCarousel from '../components/home/HeroCarousel'
import heroPhoto from '../assets/hero-home-edit.png'
import { discountPercent, mediaUrl } from '../utils/format'

export default function HomePage() {
  const { home, homeState } = useOutletContext() || {}
  const [departments, setDepartments] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    listCategories()
      .then(async (body) => {
        const roots = body.data || []
        const groups = await Promise.all(roots.map(async (category) => {
          try {
            const products = await listProducts({ category: category.slug, per_page: 8, sort: 'newest' })
            return { category, products: products.data || [] }
          } catch {
            return { category, products: [] }
          }
        }))
        if (!active) return
        setDepartments(groups)
        setStatus('ready')
      })
      .catch((err) => {
        if (!active) return
        setError(err)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [])

  const chama = home?.blocks?.find((block) => block.slug === 'chama_teaser')
  const others = (home?.blocks || []).filter((block) => !['home_announcement', 'chama_teaser'].includes(block.slug))
  const featured = home?.featured_products || []
  const slides = [
    {
      key: 'welcome',
      eyebrow: 'The home edit · New arrivals',
      title: 'Everything your home needs, all in one place.',
      body: 'Reliable appliances. Thoughtful prices. Everyday comfort.',
      image: heroPhoto,
      alt: 'Housewares on display, new arrivals',
      actions: [
        { label: 'Shop home essentials →', href: '/shop', tone: 'btn' },
        { label: 'Explore today’s deals', href: '/shop?featured=1', tone: 'btn btn-gold' },
      ],
    },
    ...(home?.hovering_promotions || []).map((promo) => ({
      key: `promo-${promo.id}`,
      eyebrow: 'Store promotion',
      title: promo.name,
      body: [promotionOffer(promo), promo.code ? `Code ${promo.code}, checked at checkout.` : ''].filter(Boolean).join(' '),
      image: promo.image_url ? mediaUrl(promo.image_url) : '',
      alt: promo.name,
      actions: [{ label: 'Shop with this offer', href: '/shop', tone: 'btn' }],
    })),
    ...others.map((block) => ({
      key: `content-${block.id}`,
      eyebrow: 'From the shop',
      title: block.title,
      body: block.body,
      image: block.image_url ? mediaUrl(block.image_url) : '',
      alt: block.title || 'Store content',
      actions: block.link_url ? [{ label: 'See more', href: block.link_url, tone: 'btn' }] : [],
    })),
  ]
  const maxOff = featured.reduce((best, product) => {
    const percent = discountPercent(product.cash_price, product.compare_at_price)
    if (!percent) return best
    return Math.max(best, percent)
  }, 0)

  return (
    <div className="shell py-8">
      <div className="hero-scale">
        <HeroCarousel slides={slides.map((slide, slideIndex) => (
          slideIndex === 0 && maxOff > 0 ? { ...slide, badge: `Save up to ${maxOff}%` } : slide
        ))} />
      </div>

      <section className="mt-14">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="display text-2xl text-plum">Featured appliances</h2>
          </div>
          <Link to="/shop?featured=1" className="text-sm font-semibold text-plum">View all</Link>
        </div>
        {homeState === 'loading' ? <LoadingState label="Loading featured products" /> : null}
        {homeState !== 'loading' && featured.length === 0 ? (
          <EmptyState title="Nothing featured yet" message="Featured products appear here when they are marked in the catalogue." action={<Link to="/shop" className="btn">Browse the shop</Link>} />
        ) : null}
        {featured.length > 0 ? (
          <div className="product-scroller">
            <ProductGrid products={featured} explore />
          </div>
        ) : null}
      </section>

      {status === 'loading' ? <div className="mt-14"><LoadingState label="Loading departments" /></div> : null}
      {status === 'error' ? <div className="mt-14"><ErrorState message={error.message} onRetry={() => window.location.reload()} /></div> : null}
      {status === 'ready' ? (
        <DepartmentFlow departments={departments} promotions={home?.hovering_promotions || []} blocks={others} />
      ) : null}

      {chama ? (
        <section className="panel mt-14 grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="badge">Coming soon</p>
            <h2 className="display mt-3 text-2xl text-plum">{chama.title}</h2>
            <p className="mt-2 max-w-2xl text-muted">{chama.body}</p>
          </div>
          <Link to="/chamas" className="btn btn-ghost">Read more</Link>
        </section>
      ) : null}

      {home?.chama && !chama ? (
        <p className="mt-10 text-sm text-muted">{home.chama.message}</p>
      ) : null}
    </div>
  )
}

function DepartmentFlow({ departments, promotions, blocks }) {
  const fillers = []
  const count = Math.max(promotions.length, blocks.length)
  for (let index = 0; index < count; index += 1) {
    if (promotions[index]) fillers.push({ kind: 'promo', key: `promo-${promotions[index].id}`, promo: promotions[index] })
    if (blocks[index]) fillers.push({ kind: 'content', key: `content-${blocks[index].id}`, block: blocks[index] })
  }
  const flow = []
  departments.forEach((group, index) => {
    flow.push({ kind: 'category', key: `category-${group.category.id}`, ...group })
    if (fillers[index]) flow.push(fillers[index])
  })
  fillers.slice(departments.length).forEach((item) => flow.push(item))

  return flow.map((item) => {
    if (item.kind === 'category') return <CategorySection key={item.key} category={item.category} products={item.products} />
    if (item.kind === 'promo') return <PromoSpotlight key={item.key} promo={item.promo} />
    return <ContentSpotlight key={item.key} block={item.block} />
  })
}

function CategorySection({ category, products }) {
  return (
    <section className="mt-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="display text-2xl text-plum">{category.name}</h2>
        <Link to={`/categories/${category.slug}`} className="text-sm font-semibold text-plum">View all</Link>
      </div>
      {products.length ? (
        <div className="product-scroller">
          <ProductGrid products={products} explore />
        </div>
      ) : (
        <p className="text-sm text-muted">No products in this department yet.</p>
      )}
    </section>
  )
}

function PromoSpotlight({ promo }) {
  const detail = [promotionOffer(promo), promo.code ? `Code ${promo.code}, checked at checkout.` : ''].filter(Boolean).join(' ')
  return (
    <Spotlight
      eyebrow="Store promotion"
      title={promo.name}
      body={detail}
      image={promo.image_url ? mediaUrl(promo.image_url) : ''}
      href="/shop"
      action="Shop with this offer"
    />
  )
}

function ContentSpotlight({ block }) {
  return (
    <Spotlight
      eyebrow="From the shop"
      title={block.title}
      body={block.body}
      image={block.image_url ? mediaUrl(block.image_url) : ''}
      href={block.link_url || ''}
      action="See more"
    />
  )
}

function Spotlight({ eyebrow, title, body, image, href, action }) {
  const external = /^https?:\/\//i.test(href || '')
  const internal = String(href || '').startsWith('/')
  return (
    <section className="card-scale mt-14">
      <article className={image ? 'panel split-card has-media overflow-hidden' : 'panel p-6'}>
        <div className={image ? 'split-copy' : ''}>
          <p className="badge">{eyebrow}</p>
          <h2 className="display mt-3 text-2xl text-plum">{title}</h2>
          {body ? <p className="mt-3 whitespace-pre-line text-muted">{body}</p> : null}
          {internal ? <Link to={href} className="btn mt-5">{action}</Link> : null}
          {external ? <a className="btn mt-5" href={href} target="_blank" rel="noreferrer">{action}</a> : null}
        </div>
        {image ? (
          external ? (
            <a className="split-media-link" href={href} target="_blank" rel="noreferrer">
              <img className="split-media" src={image} alt="" />
            </a>
          ) : (
            <img className="split-media" src={image} alt="" />
          )
        ) : null}
      </article>
    </section>
  )
}
