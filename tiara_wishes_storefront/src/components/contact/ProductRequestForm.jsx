import { useState } from 'react'
import { Button, Field } from '../common/Button'
import { emailError, phoneError, required } from '../../utils/validation'

export default function ProductRequestForm({ storeEmail, presetName = '' }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    product: presetName,
    description: '',
    quantity: '1',
    budget: '',
  })
  const [imageName, setImageName] = useState('')
  const [preview, setPreview] = useState('')
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function onImage(event) {
    const file = event.target.files?.[0]
    if (!file) {
      setImageName('')
      setPreview('')
      return
    }
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = () => setPreview(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  function onSubmit(event) {
    event.preventDefault()
    const next = {
      name: required(form.name, 'Your name'),
      email: emailError(form.email),
      phone: phoneError(form.phone, { required: true }),
      product: required(form.product, 'Product name'),
      description: required(form.description, 'Description'),
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    if (!storeEmail) return

    const lines = [
      `Name: ${form.name.trim()}`,
      `Email: ${form.email.trim()}`,
      `Phone: ${form.phone.trim()}`,
      `Product: ${form.product.trim()}`,
      `Description: ${form.description.trim()}`,
      `Quantity: ${form.quantity.trim() || '1'}`,
      form.budget.trim() ? `Budget: ${form.budget.trim()}` : '',
      imageName ? `Photo chosen on this device: ${imageName}. Please attach it to this email.` : 'No photo attached.',
      '',
      'This is a request for an item that is not in the shop. It is not an order.',
    ].filter(Boolean)
    const href = `mailto:${storeEmail}?subject=${encodeURIComponent(`Product request: ${form.product.trim()}`)}&body=${encodeURIComponent(lines.join('\n'))}`
    window.location.href = href
    setSent(true)
  }

  return (
    <form className="panel space-y-4 p-5" onSubmit={onSubmit}>
      <div>
        <h2 className="display text-2xl text-plum">Request a product</h2>
        <p className="mt-2 text-sm text-muted">
          Ask the shop to source something that is not listed. This opens an email to the store. It does not place an order or take payment.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="request-name" label="Your name" value={form.name} error={errors.name} onChange={(event) => set('name', event.target.value)} />
        <Field id="request-phone" label="Phone" hint="Kenyan number, so the shop can reply." value={form.phone} error={errors.phone} onChange={(event) => set('phone', event.target.value)} />
      </div>
      <Field id="request-email" label="Email" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={(event) => set('email', event.target.value)} />
      <Field id="request-product" label="Product name" value={form.product} error={errors.product} onChange={(event) => set('product', event.target.value)} />
      <Field id="request-description" as="textarea" label="Description" hint="Size, colour, brand, or where you saw it." value={form.description} error={errors.description} onChange={(event) => set('description', event.target.value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="request-quantity" label="Quantity" inputMode="numeric" value={form.quantity} onChange={(event) => set('quantity', event.target.value)} />
        <Field id="request-budget" label="Budget" hint="Optional." value={form.budget} onChange={(event) => set('budget', event.target.value)} />
      </div>
      <label className="field-wrap">
        <span className="field-label">Photo</span>
        <input id="request-image" className="field" type="file" accept="image/*" onChange={onImage} />
        <span className="field-hint">Optional. Your email app can attach this photo. The shop does not store it from this page.</span>
      </label>
      {preview ? <img className="h-36 w-36 rounded-2xl object-cover" src={preview} alt="" /> : null}
      {!storeEmail ? <p className="field-error">The store has not published an email address yet.</p> : null}
      {sent ? <p className="text-sm text-ok">Your email app should open with this request addressed to the shop.</p> : null}
      <Button type="submit" disabled={!storeEmail}>Send request to the shop</Button>
    </form>
  )
}
