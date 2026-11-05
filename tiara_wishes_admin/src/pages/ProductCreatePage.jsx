import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProduct } from '../api/products'
import ProductForm from '../components/products/ProductForm'
import { PageHeader } from '../components/common/States'

export default function ProductCreatePage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(payload) {
    setBusy(true)
    setError(null)
    try {
      const body = await createProduct(payload)
      navigate(`/admin/products/${body.data.id}/edit`, { replace: true, state: { notice: body.message || 'Product created' } })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Catalogue" title="New product" description="Opening stock is recorded as an inventory movement. Later stock changes use the inventory screen." />
      <ProductForm mode="create" busy={busy} error={error} onSubmit={onSubmit} />
    </div>
  )
}
