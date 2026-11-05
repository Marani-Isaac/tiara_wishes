import { useEffect, useMemo, useState } from 'react'
import { listBrands } from '../../api/brands'
import { listCategories } from '../../api/categories'
import { FormField } from '../common/States'
import CategoryCascade, { categoryNeedsDeeper } from './CategoryCascade'
import { detailMessage, money, slugify } from '../../lib/format'
import { PRODUCT_STATUSES } from '../../lib/constants'

const EMPTY = {
  name: '',
  sku: '',
  slug: '',
  category_id: '',
  brand_id: '',
  short_description: '',
  description: '',
  cash_price: '',
  compare_at_price: '',
  opening_stock: '0',
  low_stock_threshold: '5',
  weight: '',
  length: '',
  width: '',
  height: '',
  is_featured: false,
  status: 'draft',
  meta_title: '',
  meta_description: '',
  handling: 'normal',
  usage_video_url: '',
  model_name: '',
  material: '',
  size_label: '',
  warranty: '',
  key_features: '',
  box_contents: '',
  specifications: [],
}

export default function ProductForm({ initial, mode, busy, error, onSubmit }) {
  const [form, setForm] = useState(EMPTY)
  const [slugTouched, setSlugTouched] = useState(false)
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [localError, setLocalError] = useState('')
  const [tab, setTab] = useState('details')

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]))
    listBrands().then(setBrands).catch(() => setBrands([]))
  }, [])

  useEffect(() => {
    if (!initial) return
    setForm({
      name: initial.name || '',
      sku: initial.sku || '',
      slug: initial.slug || '',
      category_id: initial.category_id ? String(initial.category_id) : '',
      brand_id: initial.brand_id ? String(initial.brand_id) : '',
      short_description: initial.short_description || '',
      description: initial.description || '',
      cash_price: initial.cash_price || '',
      compare_at_price: initial.compare_at_price || '',
      opening_stock: '0',
      low_stock_threshold: String(initial.low_stock_threshold ?? 5),
      weight: initial.weight || '',
      length: initial.length || '',
      width: initial.width || '',
      height: initial.height || '',
      is_featured: Boolean(initial.is_featured),
      status: initial.status || 'draft',
      meta_title: initial.meta_title || '',
      meta_description: initial.meta_description || '',
      handling: initial.handling || 'normal',
      usage_video_url: initial.usage_video_url || '',
      model_name: initial.model_name || '',
      material: initial.material || '',
      size_label: initial.size_label || '',
      warranty: initial.warranty || '',
      key_features: initial.key_features || '',
      box_contents: initial.box_contents || '',
      specifications: Array.isArray(initial.specifications)
        ? initial.specifications.map((row) => ({ label: row.label || '', value: row.value || '' }))
        : [],
    })
    setSlugTouched(true)
  }, [initial])

  const compareHint = useMemo(() => {
    const cash = Number(form.cash_price)
    const compare = Number(form.compare_at_price)
    if (!form.compare_at_price || Number.isNaN(cash) || Number.isNaN(compare)) return 'Optional. Shown as a comparison only when it is higher than the cash price.'
    if (compare > cash) return `Customers can see a comparison of ${money(compare)} against ${money(cash)}.`
    return 'This is not higher than the cash price, so it will not be presented as a discount.'
  }, [form.cash_price, form.compare_at_price])

  function updateSpecification(index, key, value) {
    setForm((current) => {
      const specifications = current.specifications.map((row, rowIndex) => (
        rowIndex === index ? { ...row, [key]: value } : row
      ))
      return { ...current, specifications }
    })
  }

  function removeSpecification(index) {
    setForm((current) => ({
      ...current,
      specifications: current.specifications.filter((_, rowIndex) => rowIndex !== index),
    }))
  }

  function setField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'name' && !slugTouched) next.slug = slugify(value)
      return next
    })
  }

  function submit(event) {
    event.preventDefault()
    setLocalError('')
    if (!form.name.trim() || !form.sku.trim() || !form.category_id || form.cash_price === '') {
      setTab('details')
      setLocalError('Name, SKU, main category, and cash price are required.')
      return
    }
    if (categoryNeedsDeeper(categories, form.category_id)) {
      setTab('details')
      setLocalError('Choose the next category level. Shoppers follow the full path down to the most specific category.')
      return
    }
    const specifications = form.specifications
      .map((row) => ({ label: row.label.trim(), value: row.value.trim() }))
      .filter((row) => row.label || row.value)
    if (specifications.some((row) => !row.label || !row.value)) {
      setTab('specs')
      setLocalError('Each extra specification needs both a label and a value.')
      return
    }
    if (form.usage_video_url.trim() && !/^https?:\/\//i.test(form.usage_video_url.trim())) {
      setTab('video')
      setLocalError('The usage video must be a link that starts with http:// or https://.')
      return
    }
    const cash = Number(form.cash_price)
    if (Number.isNaN(cash) || cash < 0) {
      setLocalError('Cash price must be a number that is zero or greater.')
      return
    }
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      slug: form.slug.trim() || slugify(form.name),
      category_id: Number(form.category_id),
      brand_id: form.brand_id ? Number(form.brand_id) : null,
      short_description: form.short_description.trim() || null,
      description: form.description.trim() || null,
      cash_price: form.cash_price,
      compare_at_price: form.compare_at_price === '' ? null : form.compare_at_price,
      low_stock_threshold: Number(form.low_stock_threshold || 0),
      weight: emptyMoney(form.weight),
      length: emptyMoney(form.length),
      width: emptyMoney(form.width),
      height: emptyMoney(form.height),
      is_featured: form.is_featured,
      is_active: form.status === 'active',
      status: form.status,
      meta_title: form.meta_title.trim() || null,
      meta_description: form.meta_description.trim() || null,
      handling: form.handling,
      usage_video_url: form.usage_video_url.trim() || null,
      model_name: form.model_name.trim() || null,
      material: form.material.trim() || null,
      size_label: form.size_label.trim() || null,
      warranty: form.warranty.trim() || null,
      key_features: form.key_features.trim() || null,
      box_contents: form.box_contents.trim() || null,
      specifications,
    }
    if (mode === 'create') payload.opening_stock = Number(form.opening_stock || 0)
    onSubmit(payload)
  }

  return (
    <form className="panel max-w-4xl space-y-3 p-4" onSubmit={submit}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Product form">
        <button className={tab === 'details' ? 'btn btn-gold' : 'btn btn-ghost'} type="button" role="tab" aria-selected={tab === 'details'} onClick={() => setTab('details')}>
          Details
        </button>
        <button className={tab === 'story' ? 'btn btn-gold' : 'btn btn-ghost'} type="button" role="tab" aria-selected={tab === 'story'} onClick={() => setTab('story')}>
          Product story
        </button>
        <button className={tab === 'specs' ? 'btn btn-gold' : 'btn btn-ghost'} type="button" role="tab" aria-selected={tab === 'specs'} onClick={() => setTab('specs')}>
          Specifications
        </button>
        <button className={tab === 'video' ? 'btn btn-gold' : 'btn btn-ghost'} type="button" role="tab" aria-selected={tab === 'video'} onClick={() => setTab('video')}>
          Usage video
        </button>
      </div>
      {tab === 'video' ? (
        <FormField
          id="usage-video"
          label="Video link"
          hint="Shoppers open this link from the product page to watch how the product is used. YouTube, TikTok, and other https links are accepted."
          error={detailMessage(error, 'usage_video_url')}
        >
          <input
            id="usage-video"
            className="field"
            inputMode="url"
            placeholder="https://"
            value={form.usage_video_url}
            onChange={(event) => setField('usage_video_url', event.target.value)}
          />
        </FormField>
      ) : null}
      {tab === 'details' ? (
      <>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField id="name" label="Product name" error={detailMessage(error, 'name')}>
          <input id="name" className="field" value={form.name} onChange={(event) => setField('name', event.target.value)} />
        </FormField>
        <FormField id="sku" label="SKU" error={detailMessage(error, 'sku')}>
          <input id="sku" className="field" value={form.sku} onChange={(event) => setField('sku', event.target.value)} />
        </FormField>
        <FormField id="slug" label="Slug" hint="Suggested from the name. It must stay unique." error={detailMessage(error, 'slug')}>
          <input
            id="slug"
            className="field"
            value={form.slug}
            onChange={(event) => {
              setSlugTouched(true)
              setField('slug', event.target.value)
            }}
          />
        </FormField>
        <div className="md:col-span-2">
          <CategoryCascade
            categories={categories}
            categoryId={form.category_id}
            onChange={(value) => setField('category_id', value)}
            error={detailMessage(error, 'category_id')}
          />
        </div>
        <FormField id="brand" label="Brand" error={detailMessage(error, 'brand_id')}>
          <select id="brand" className="field" value={form.brand_id} onChange={(event) => setField('brand_id', event.target.value)}>
            <option value="">No brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="status" label="Status" error={detailMessage(error, 'status')}>
          <select id="status" className="field" value={form.status} onChange={(event) => setField('status', event.target.value)}>
            {PRODUCT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="cash" label="Cash price (KES)" error={detailMessage(error, 'cash_price')}>
          <input id="cash" className="field" inputMode="decimal" value={form.cash_price} onChange={(event) => setField('cash_price', event.target.value)} />
        </FormField>
        <FormField id="compare" label="Compare-at price" hint={compareHint} error={detailMessage(error, 'compare_at_price')}>
          <input id="compare" className="field" inputMode="decimal" value={form.compare_at_price} onChange={(event) => setField('compare_at_price', event.target.value)} />
        </FormField>
        {mode === 'create' ? (
          <FormField id="opening" label="Opening stock" hint="Later changes go through an inventory adjustment so the movement is audited." error={detailMessage(error, 'opening_stock')}>
            <input id="opening" className="field" inputMode="numeric" value={form.opening_stock} onChange={(event) => setField('opening_stock', event.target.value)} />
          </FormField>
        ) : (
          <FormField id="stock-note" label="Stock" hint={`On hand ${initial?.on_hand ?? 0}, reserved ${initial?.reserved ?? 0}, available ${initial?.available_quantity ?? 0}. Change this from Inventory.`}>
            <input id="stock-note" className="field" value={`${initial?.available_quantity ?? 0} available`} readOnly />
          </FormField>
        )}
        <FormField id="handling" label="Handling" hint="The storefront uses this to pick the normal, delicate, or perishable delivery fee for a place." error={detailMessage(error, 'handling')}>
          <select id="handling" className="field" value={form.handling} onChange={(event) => setField('handling', event.target.value)}>
            <option value="normal">Normal</option>
            <option value="delicate">Delicate</option>
            <option value="perishable">Perishable</option>
          </select>
        </FormField>
        <FormField id="threshold" label="Low-stock threshold" error={detailMessage(error, 'low_stock_threshold')}>
          <input id="threshold" className="field" inputMode="numeric" value={form.low_stock_threshold} onChange={(event) => setField('low_stock_threshold', event.target.value)} />
        </FormField>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField id="meta-title" label="SEO title" error={detailMessage(error, 'meta_title')}>
          <input id="meta-title" className="field" value={form.meta_title} onChange={(event) => setField('meta_title', event.target.value)} />
        </FormField>
        <FormField id="meta-description" label="SEO description" error={detailMessage(error, 'meta_description')}>
          <input id="meta-description" className="field" value={form.meta_description} onChange={(event) => setField('meta_description', event.target.value)} />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_featured} onChange={(event) => setField('is_featured', event.target.checked)} />
        Featured on the homepage
      </label>
      </>
      ) : null}
      {tab === 'story' ? (
        <>
          <FormField id="short" label="Short summary" hint="A sentence under the product name. Up to 300 characters." error={detailMessage(error, 'short_description')}>
            <textarea id="short" className="field" value={form.short_description} onChange={(event) => setField('short_description', event.target.value)} />
          </FormField>
          <FormField id="full" label="Product details" hint="The full write-up shoppers read before adding the item to the cart. Paragraphs are kept." error={detailMessage(error, 'description')}>
            <textarea id="full" className="field min-h-56" value={form.description} onChange={(event) => setField('description', event.target.value)} />
          </FormField>
          <FormField id="features" label="Key features" hint="One feature per line. These appear as a list on the product page." error={detailMessage(error, 'key_features')}>
            <textarea id="features" className="field min-h-40" value={form.key_features} onChange={(event) => setField('key_features', event.target.value)} />
          </FormField>
          <FormField id="box" label="What's in the box" hint="One item per line." error={detailMessage(error, 'box_contents')}>
            <textarea id="box" className="field min-h-32" value={form.box_contents} onChange={(event) => setField('box_contents', event.target.value)} />
          </FormField>
        </>
      ) : null}
      {tab === 'specs' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <FormField id="model" label="Model" error={detailMessage(error, 'model_name')}>
            <input id="model" className="field" value={form.model_name} onChange={(event) => setField('model_name', event.target.value)} />
          </FormField>
          <FormField id="size-label" label="Size" hint="The size shoppers read, such as 300 x 290 x 840 mm." error={detailMessage(error, 'size_label')}>
            <input id="size-label" className="field" value={form.size_label} onChange={(event) => setField('size_label', event.target.value)} />
          </FormField>
          <FormField id="material" label="Main material" error={detailMessage(error, 'material')}>
            <input id="material" className="field" value={form.material} onChange={(event) => setField('material', event.target.value)} />
          </FormField>
          <FormField id="warranty" label="Warranty" hint="Where and how long the warranty applies, if you offer one." error={detailMessage(error, 'warranty')}>
            <input id="warranty" className="field" value={form.warranty} onChange={(event) => setField('warranty', event.target.value)} />
          </FormField>
          {['weight', 'length', 'width', 'height'].map((field) => (
            <FormField key={field} id={`spec-${field}`} label={`${field} (${field === 'weight' ? 'kg' : 'cm'})`} error={detailMessage(error, field)}>
              <input id={`spec-${field}`} className="field" inputMode="decimal" value={form[field]} onChange={(event) => setField(field, event.target.value)} />
            </FormField>
          ))}
          <div className="space-y-2 md:col-span-2">
            <p className="text-sm font-semibold">Extra specifications</p>
            <p className="text-sm text-muted">
              Add facts that belong only to this product, such as colour, power, or capacity. A water dispenser and a blender do not have to share the same rows.
            </p>
            {form.specifications.map((row, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  className="field"
                  aria-label={`Specification ${index + 1} label`}
                  placeholder="Label, for example Colour"
                  value={row.label}
                  onChange={(event) => updateSpecification(index, 'label', event.target.value)}
                />
                <input
                  className="field"
                  aria-label={`Specification ${index + 1} value`}
                  placeholder="Value, for example Black"
                  value={row.value}
                  onChange={(event) => updateSpecification(index, 'value', event.target.value)}
                />
                <button className="btn btn-ghost" type="button" onClick={() => removeSpecification(index)}>
                  Remove
                </button>
              </div>
            ))}
            {detailMessage(error, 'specifications') ? <p className="text-sm text-danger">{detailMessage(error, 'specifications')}</p> : null}
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setForm((current) => ({ ...current, specifications: [...current.specifications, { label: '', value: '' }] }))}
            >
              Add a specification
            </button>
          </div>
        </div>
      ) : null}
      {localError ? <p className="text-sm text-danger" role="alert">{localError}</p> : null}
      {error?.message ? <p className="text-sm text-danger" role="alert">{error.message}</p> : null}
      <button className="btn btn-gold" type="submit" disabled={busy}>
        {busy ? 'Saving…' : mode === 'create' ? 'Create product' : 'Save product'}
      </button>
    </form>
  )
}

function emptyMoney(value) {
  return value === '' ? null : value
}
