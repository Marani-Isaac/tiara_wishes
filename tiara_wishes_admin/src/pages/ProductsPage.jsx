import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listBrands } from '../api/brands'
import { listCategories } from '../api/categories'
import { archiveProduct, listProducts } from '../api/products'
import ConfirmDialog from '../components/common/ConfirmDialog'
import DataTable from '../components/common/DataTable'
import Pagination from '../components/common/Pagination'
import SearchInput from '../components/common/SearchInput'
import StatusBadge from '../components/common/StatusBadge'
import { EmptyState, ErrorState, LoadingState, PageHeader, SuccessNote } from '../components/common/States'
import { formatWhen, mediaUrl, money, readPage } from '../lib/format'
import { PRODUCT_STATUSES } from '../lib/constants'

export default function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [state, setState] = useState({ loading: true, error: null, rows: [], meta: null })
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)

  const query = {
    page: readPage(params),
    per_page: 20,
    q: params.get('q') || undefined,
    category: params.get('category') || undefined,
    brand: params.get('brand') || undefined,
    status: params.get('status') || undefined,
    sort: params.get('sort') || 'newest',
    featured: params.get('featured') === '1' ? 'true' : undefined,
  }

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]))
    listBrands().then(setBrands).catch(() => setBrands([]))
  }, [])

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: null }))
    listProducts(query)
      .then((body) => {
        if (active) setState({ loading: false, error: null, rows: body.data || [], meta: body.meta })
      })
      .catch((error) => {
        if (active) setState({ loading: false, error, rows: [], meta: null })
      })
    return () => {
      active = false
    }
  }, [params])

  function updateParam(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  async function confirmArchive() {
    setBusy(true)
    try {
      const body = await archiveProduct(pending.id)
      setNotice(body.message || 'Product archived')
      setPending(null)
      setParams(new URLSearchParams(params))
    } catch (error) {
      setNotice('')
      setState((current) => ({ ...current, error }))
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description="Prices and stock shown here come from the API. Archiving hides a product from the storefront and keeps order snapshots."
        actions={
          <Link className="btn btn-gold" to="/admin/products/new">
            New product
          </Link>
        }
      />
      <SuccessNote>{notice}</SuccessNote>
      <div className="panel mb-4 flex flex-wrap gap-3 p-4">
        <SearchInput
          value={params.get('q') || ''}
          placeholder="Search name or SKU"
          onChange={(value) => updateParam('q', value.trim())}
        />
        <select className="field max-w-48" value={params.get('category') || ''} onChange={(event) => updateParam('category', event.target.value)}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <select className="field max-w-48" value={params.get('brand') || ''} onChange={(event) => updateParam('brand', event.target.value)}>
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </select>
        <select className="field max-w-40" value={params.get('status') || ''} onChange={(event) => updateParam('status', event.target.value)}>
          <option value="">Any status</option>
          {PRODUCT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select className="field max-w-44" value={params.get('sort') || 'newest'} onChange={(event) => updateParam('sort', event.target.value)}>
          <option value="newest">Newest</option>
          <option value="name">Name</option>
          <option value="price_asc">Price low to high</option>
          <option value="price_desc">Price high to low</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={params.get('featured') === '1'}
            onChange={(event) => updateParam('featured', event.target.checked ? '1' : '')}
          />
          Featured
        </label>
      </div>
      {state.loading ? <LoadingState label="Loading products" /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={() => setParams(new URLSearchParams(params))} /> : null}
      {!state.loading && !state.error && state.rows.length === 0 ? (
        <EmptyState title="No products match" body="Create a product, or clear the filters. A new store starts empty aside from any demo rows in the database." />
      ) : null}
      {!state.loading && state.rows.length > 0 ? (
        <div className="panel p-3">
          <DataTable
            rowKey={(row) => row.id}
            rows={state.rows}
            columns={[
              {
                key: 'image',
                header: 'Image',
                cell: (row) =>
                  row.primary_image?.image_url ? (
                    <img className="h-12 w-12 rounded-lg object-cover" src={mediaUrl(row.primary_image.image_url)} alt={row.primary_image.alt_text || row.name} />
                  ) : (
                    <span className="text-muted">None</span>
                  ),
              },
              {
                key: 'name',
                header: 'Product',
                cell: (row) => (
                  <div>
                    <div className="font-semibold">{row.name}</div>
                    <div className="text-xs text-muted">{row.sku}</div>
                  </div>
                ),
              },
              { key: 'category', header: 'Category', cell: (row) => row.category_name || '—' },
              { key: 'brand', header: 'Brand', cell: (row) => row.brand_name || '—' },
              { key: 'price', header: 'Cash price', cell: (row) => money(row.cash_price, row.currency) },
              {
                key: 'stock',
                header: 'Stock',
                cell: (row) => (
                  <span>
                    {row.available_quantity} available
                    {row.available_quantity <= row.low_stock_threshold ? ' · low' : ''}
                  </span>
                ),
              },
              { key: 'status', header: 'Status', cell: (row) => <StatusBadge value={row.status} /> },
              { key: 'updated', header: 'Updated', cell: (row) => formatWhen(row.updated_at) },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <Link className="btn btn-ghost" to={`/admin/products/${row.id}/edit`}>
                      Edit
                    </Link>
                    {row.status !== 'archived' ? (
                      <button className="btn btn-ghost" type="button" onClick={() => setPending(row)}>
                        Archive
                      </button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination meta={state.meta} onPage={(page) => updateParam('page', String(page))} />
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pending)}
        title="Archive this product?"
        body="The storefront will stop selling it. Past orders keep their item snapshot. Confirm only if that is what you want."
        confirmLabel="Archive product"
        danger
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={confirmArchive}
      />
    </div>
  )
}
