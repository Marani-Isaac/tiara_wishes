import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getProduct, updateProduct } from '../api/products'
import ProductForm from '../components/products/ProductForm'
import ProductImagesManager from '../components/products/ProductImagesManager'
import { ErrorState, LoadingState, PageHeader, SuccessNote } from '../components/common/States'
import { mediaUrl, money } from '../lib/format'

export default function ProductEditPage() {
  const { id } = useParams()
  const location = useLocation()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(location.state?.notice || '')
  const [preview, setPreview] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const body = await getProduct(id)
      setProduct(body.data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  async function onSubmit(payload) {
    setBusy(true)
    setFormError(null)
    try {
      const body = await updateProduct(id, payload)
      setProduct(body.data)
      setNotice(body.message || 'Product updated')
    } catch (err) {
      setFormError(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState label="Loading product" />
  if (error) return <ErrorState error={error} onRetry={load} />
  if (!product) return null

  const showCompare = product.compare_at_price && Number(product.compare_at_price) > Number(product.cash_price)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title={product.name}
        description="Stock on this form is read-only. Adjust it from Inventory so the movement is audited."
        actions={
          <>
            <button className="btn btn-ghost" type="button" onClick={() => setPreview(true)}>
              Preview
            </button>
            <Link className="btn btn-ghost" to="/admin/products">
              Back to products
            </Link>
          </>
        }
      />
      <SuccessNote>{notice}</SuccessNote>
      <ProductForm mode="edit" initial={product} busy={busy} error={formError} onSubmit={onSubmit} />
      <ProductImagesManager productId={product.id} images={product.images || []} onChange={load} />
      {preview ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4">
          <div className="panel max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6" role="dialog" aria-modal="true" aria-label="Product preview">
            {product.primary_image ? (
              <img className="mb-4 h-48 w-full rounded-xl object-cover" src={mediaUrl(product.primary_image.image_url)} alt="" />
            ) : null}
            <p className="eyebrow">{product.brand_name || product.category_name}</p>
            {product.category_path?.length ? (
              <p className="mt-2 text-sm text-muted">{product.category_path.map((item) => item.name).join(' / ')}</p>
            ) : null}
            <h2 className="display text-4xl">{product.name}</h2>
            <p className="mt-2">
              {money(product.cash_price, product.currency)}
              {showCompare ? <span className="ml-2 text-muted line-through">{money(product.compare_at_price, product.currency)}</span> : null}
            </p>
            <p className="mt-3 text-sm text-muted">{product.short_description || 'No short summary yet.'}</p>
            {lines(product.key_features).length ? (
              <section className="mt-5">
                <h3 className="text-sm font-semibold">Key features</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {lines(product.key_features).map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
              </section>
            ) : null}
            {previewSpecs(product).length ? (
              <section className="mt-5">
                <h3 className="text-sm font-semibold">Specifications</h3>
                <dl className="mt-2 text-sm">
                  {previewSpecs(product).map(([label, value], index) => (
                    <div key={`${label}-${index}`} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 border-b border-line py-2">
                      <dt className="text-muted">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
            {lines(product.box_contents).length ? (
              <section className="mt-5">
                <h3 className="text-sm font-semibold">What&apos;s in the box</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {lines(product.box_contents).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
            ) : null}
            {product.description ? (
              <section className="mt-5">
                <h3 className="text-sm font-semibold">Product details</h3>
                <p className="mt-2 whitespace-pre-line text-sm text-muted">{product.description}</p>
              </section>
            ) : null}
            <button className="btn btn-ghost mt-5" type="button" onClick={() => setPreview(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function lines(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function previewSpecs(product) {
  const rows = []
  if (product.sku) rows.push(['SKU', product.sku])
  if (product.model_name) rows.push(['Model', product.model_name])
  if (product.size_label) rows.push(['Size', product.size_label])
  if (product.material) rows.push(['Main material', product.material])
  if (product.warranty) rows.push(['Warranty', product.warranty])
  for (const row of product.specifications || []) {
    if (row?.label && row?.value) rows.push([row.label, row.value])
  }
  return rows
}
