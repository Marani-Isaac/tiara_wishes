import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { getCategory, listBrands, listCategories, listProducts } from '../api/catalog'
import { ProductFilters, SortSelect } from '../components/catalog/ProductFilters'
import { ProductGrid } from '../components/catalog/ProductCard'
import Breadcrumbs from '../components/layout/Breadcrumbs'
import Pagination from '../components/common/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import PromoRail from '../components/common/PromoRail'

function readFilters(params, fixedCategory) {
  return {
    q: params.get('q') || '',
    category: fixedCategory || params.get('category') || '',
    brand: params.get('brand') || '',
    min_price: params.get('min_price') || '',
    max_price: params.get('max_price') || '',
    featured: params.get('featured') || '',
    sort: params.get('sort') || 'newest',
    page: Number(params.get('page') || '1') || 1,
  }
}

export default function Catalogue({ categorySlug }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { home } = useOutletContext() || {}
  const filters = useMemo(() => readFilters(params, categorySlug), [params, categorySlug])
  const [products, setProducts] = useState([])
  const [meta, setMeta] = useState(null)
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [category, setCategory] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([listCategories(), listBrands()])
      .then(([categoryBody, brandBody]) => {
        if (!active) return
        setCategories(categoryBody.data || [])
        setBrands(brandBody.data || [])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!categorySlug) {
      setCategory(null)
      return undefined
    }
    let active = true
    getCategory(categorySlug)
      .then((body) => {
        if (active) setCategory(body.data)
      })
      .catch((err) => {
        if (active) setError(err)
      })
    return () => {
      active = false
    }
  }, [categorySlug])

  useEffect(() => {
    let active = true
    setStatus('loading')
    const query = {
      page: filters.page,
      per_page: 40,
      sort: filters.sort,
    }
    if (filters.q) query.q = filters.q
    if (filters.category) query.category = filters.category
    if (filters.brand) query.brand = filters.brand
    if (filters.min_price) query.min_price = filters.min_price
    if (filters.max_price) query.max_price = filters.max_price
    if (filters.featured === '1') query.featured = 'true'
    listProducts(query)
      .then((body) => {
        if (!active) return
        setProducts(body.data || [])
        setMeta(body.meta || null)
        setStatus('ready')
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        setError(err)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [filters])

  function update(next) {
    if (categorySlug && next.category !== undefined && next.category !== categorySlug) {
      const query = new URLSearchParams()
      if (next.q) query.set('q', next.q)
      if (next.brand) query.set('brand', next.brand)
      if (next.min_price) query.set('min_price', next.min_price)
      if (next.max_price) query.set('max_price', next.max_price)
      if (next.featured) query.set('featured', next.featured)
      if (next.sort && next.sort !== 'newest') query.set('sort', next.sort)
      const search = query.toString()
      navigate(next.category ? `/categories/${next.category}${search ? `?${search}` : ''}` : `/shop${search ? `?${search}` : ''}`)
      return
    }
    const merged = { ...filters, ...next }
    const query = {}
    if (!categorySlug && merged.category) query.category = merged.category
    if (merged.q) query.q = merged.q
    if (merged.brand) query.brand = merged.brand
    if (merged.min_price) query.min_price = merged.min_price
    if (merged.max_price) query.max_price = merged.max_price
    if (merged.featured) query.featured = merged.featured
    if (merged.sort && merged.sort !== 'newest') query.sort = merged.sort
    if (merged.page > 1) query.page = String(merged.page)
    setParams(query)
  }

  const title = category?.name || (filters.q ? `Results for “${filters.q}”` : filters.featured === '1' ? 'Today’s deals' : 'Explore home essentials')
  const intro = category?.description || (filters.q || categorySlug ? null : 'Choose a department to see appliances selected for everyday living.')
  const crumbs = [{ label: 'Home', to: '/' }, { label: 'Shop', to: categorySlug ? '/shop' : undefined }]
  if (categorySlug) crumbs.push({ label: category?.name || 'Category' })

  const requestHref = `/contact?product=${encodeURIComponent(filters.q || '')}`

  return (
    <div className="shell py-8">
      <Breadcrumbs items={crumbs} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="display mt-2 text-3xl text-plum">{title}</h1>
          {intro ? <p className="mt-2 max-w-2xl text-muted">{intro}</p> : null}
          {category?.specifications?.length ? (
            <dl className="mt-4 max-w-2xl divide-y divide-line text-sm">
              {category.specifications.map((row) => (
                <div key={`${row.label}-${row.value}`} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 py-2">
                  <dt className="text-muted">{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <SortSelect value={filters.sort} onChange={(sort) => update({ sort, page: 1 })} />
      </div>
      {category?.children?.length ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link key={child.id} to={`/categories/${child.slug}`} className="badge">
              {child.name}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="explore-layout lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="explore-filters">
          <button
            type="button"
            className="filter-toggle btn btn-ghost"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            {filtersOpen ? 'Hide filters' : 'Filters'}
          </button>
          <div className={filtersOpen ? 'filter-panel is-open' : 'filter-panel'}>
            <ProductFilters
              categories={categories}
              brands={brands}
              filters={filters}
              onChange={(next) => update(next)}
            />
          </div>
          <div className="mt-4">
            <PromoRail promotions={home?.hovering_promotions || []} products={home?.featured_products || []} />
          </div>
        </div>
        <div className="min-w-0">
          {filters.q ? (
            <p className="mb-4 text-sm text-muted">
              Not seeing “{filters.q}”? <Link to={requestHref} className="font-semibold text-plum">Request it from the store</Link>
            </p>
          ) : null}
          {status === 'loading' ? <LoadingState /> : null}
          {status === 'error' ? <ErrorState message={error?.message} onRetry={() => update({ page: filters.page })} /> : null}
          {status === 'ready' && products.length === 0 ? (
            <EmptyState
              title={filters.q ? `“${filters.q}” is not in the shop` : 'No products match'}
              message={filters.q ? 'You can ask the store to source it. That request is not an order.' : 'Try another search, category, or price range.'}
              action={filters.q ? <Link to={requestHref} className="btn">Request this product</Link> : null}
            />
          ) : null}
          {status === 'ready' && products.length > 0 ? (
            <div className="product-scroller">
              <ProductGrid products={products} explore />
            </div>
          ) : null}
          <Pagination page={meta?.page || filters.page} pages={meta?.pages || 0} onPage={(page) => update({ page })} />
        </div>
      </div>
    </div>
  )
}
