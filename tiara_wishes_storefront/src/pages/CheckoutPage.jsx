import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createAddress, listAddresses } from '../api/account'
import { createOrder, initiatePayment, quoteCheckout } from '../api/checkout'
import AddressForm, { CheckoutSteps, emptyAddress } from '../components/checkout/AddressForm'
import MpesaPaybill from '../components/checkout/MpesaPaybill'
import { Button, Field } from '../components/common/Button'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { fieldError, idempotencyKey, money, personName } from '../utils/format'
import { emailError, passwordError, phoneError, required } from '../utils/validation'

export default function CheckoutPage() {
  const { user, login, register } = useAuth()
  const { cart, status, error, refresh } = useCart()
  const navigate = useNavigate()
  const items = (cart?.items || []).filter((item) => item.available)
  const orderKey = useRef(idempotencyKey())
  const payKey = useRef(idempotencyKey())

  const [step, setStep] = useState(1)
  const [mode, setMode] = useState('login')
  const [account, setAccount] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '' })
  const [accountErrors, setAccountErrors] = useState({})
  const [accountError, setAccountError] = useState('')
  const [addresses, setAddresses] = useState([])
  const [addressId, setAddressId] = useState('')
  const [address, setAddress] = useState(emptyAddress)
  const [saveAddress, setSaveAddress] = useState(true)
  const [addressErrors, setAddressErrors] = useState({})
  const [note, setNote] = useState('')
  const [code, setCode] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (user) setStep((current) => (current < 2 ? 2 : current))
  }, [user])

  useEffect(() => {
    if (!user) return undefined
    let active = true
    listAddresses()
      .then((body) => {
        if (!active) return
        const rows = body.data || []
        setAddresses(rows)
        const preferred = rows.find((row) => row.is_default) || rows[0]
        if (preferred) setAddressId(String(preferred.id))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [user])

  const quoteItems = items.map((item) => ({ product_id: item.product_id, quantity: item.quantity }))
  const quoteSignature = quoteItems.map((item) => `${item.product_id}:${item.quantity}`).join(',')

  const savedAddress = addresses.find((row) => String(row.id) === String(addressId))
  const quoteCounty = savedAddress?.county || address.county || ''

  useEffect(() => {
    if (!quoteSignature) return undefined
    let active = true
    const timer = window.setTimeout(() => {
      const nextItems = quoteSignature.split(',').map((part) => {
        const [productId, quantity] = part.split(':')
        return { product_id: Number(productId), quantity: Number(quantity) }
      })
      const payload = { items: nextItems, promotion_code: code.trim() || undefined }
      if (quoteCounty) payload.county = quoteCounty
      quoteCheckout(payload)
        .then((body) => {
          if (!active) return
          setQuote(body.data)
          setQuoteError('')
        })
        .catch((err) => {
          if (!active) return
          setQuote(null)
          setQuoteError(err.message)
        })
    }, 350)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [quoteSignature, code, quoteCounty])

  async function onAccount(event) {
    event.preventDefault()
    const errors = {}
    if (mode === 'register') {
      errors.first_name = required(account.first_name, 'First name')
      errors.last_name = required(account.last_name, 'Last name')
      errors.phone = phoneError(account.phone)
    }
    errors.email = emailError(account.email)
    errors.password = passwordError(account.password)
    setAccountErrors(errors)
    if (Object.values(errors).some(Boolean)) return
    setBusy(true)
    setAccountError('')
    try {
      if (mode === 'login') await login(account.email.trim(), account.password)
      else {
        const payload = {
          first_name: account.first_name.trim(),
          last_name: account.last_name.trim(),
          email: account.email.trim(),
          password: account.password,
        }
        if (account.phone.trim()) payload.phone = account.phone.trim()
        await register(payload)
      }
      setStep(2)
    } catch (err) {
      setAccountError(err.message)
      setAccountErrors(err.details || {})
    } finally {
      setBusy(false)
    }
  }

  function validateAddress() {
    if (addressId) return true
    const errors = {
      recipient_name: required(address.recipient_name, 'Recipient name'),
      recipient_phone: phoneError(address.recipient_phone, { required: true }),
      county: required(address.county, 'County'),
      town: required(address.town, 'Town'),
      area_or_estate: required(address.area_or_estate, 'Area or estate'),
    }
    setAddressErrors(errors)
    return !Object.values(errors).some(Boolean)
  }

  async function placeOrder(event) {
    event.preventDefault()
    if (!validateAddress()) {
      setStep(2)
      return
    }
    if (!accepted) {
      setFormError('Please acknowledge the terms before placing the order.')
      return
    }
    const unavailable = (quote?.items || []).some((item) => item.stock_warning)
    if (unavailable) {
      setFormError('One or more items do not have enough stock. Update the cart and try again.')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      let chosenId = addressId ? Number(addressId) : null
      if (!chosenId && saveAddress) {
        const saved = await createAddress({ ...address, is_default: addresses.length === 0 })
        chosenId = saved.data.id
      }
      const payload = {
        items: quoteItems,
        customer_note: note.trim() || undefined,
        promotion_code: code.trim() || undefined,
        clear_cart: true,
      }
      if (chosenId) payload.address_id = chosenId
      else payload.address = address
      const orderBody = await createOrder(payload, orderKey.current)
      const order = orderBody.data
      const paymentPayload = { provider: 'mpesa' }
      try {
        await initiatePayment(order.order_number, paymentPayload, payKey.current)
      } catch (paymentError) {
        navigate(`/account/orders/${order.order_number}`, { state: { paymentError: paymentError.message } })
        return
      }
      await refresh()
      navigate(`/account/orders/${order.order_number}`)
    } catch (err) {
      setFormError(err.message)
      if (err.details?.address || err.details?.recipient_name) setAddressErrors(err.details || {})
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') return <div className="shell py-8"><LoadingState label="Preparing checkout" /></div>
  if (status === 'error') return <div className="shell py-8"><ErrorState message={error?.message} onRetry={refresh} /></div>
  if (!items.length) {
    return (
      <div className="shell py-8">
        <EmptyState title="Nothing to check out" message="Your cart is empty or the items are unavailable." action={<Link to="/shop" className="btn">Continue shopping</Link>} />
      </div>
    )
  }

  return (
    <div className="shell py-8">
      <p className="eyebrow">Checkout</p>
      <h1 className="display mt-2 text-2xl text-plum">{user ? 'Where should we deliver?' : 'Sign in to check out'}</h1>
      <div className="mt-6">
        <CheckoutSteps step={user ? Math.max(step, 2) : step} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {!user ? (
            <form className="panel space-y-4 p-5" onSubmit={onAccount}>
              <div className="flex gap-2">
                <Button variant={mode === 'login' ? 'primary' : 'ghost'} onClick={() => setMode('login')}>Sign in</Button>
                <Button variant={mode === 'register' ? 'primary' : 'ghost'} onClick={() => setMode('register')}>Create account</Button>
              </div>
              <p className="text-sm text-muted">Browsing does not need an account. An account is used to place the order and keep the delivery details.</p>
              {mode === 'register' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="first-name" label="First name" value={account.first_name} error={accountErrors.first_name} onChange={(event) => setAccount({ ...account, first_name: event.target.value })} />
                  <Field id="last-name" label="Last name" value={account.last_name} error={accountErrors.last_name} onChange={(event) => setAccount({ ...account, last_name: event.target.value })} />
                </div>
              ) : null}
              <Field id="email" label="Email" type="email" autoComplete="email" value={account.email} error={accountErrors.email} onChange={(event) => setAccount({ ...account, email: event.target.value })} />
              {mode === 'register' ? (
                <Field id="phone" label="Phone" hint="Optional. Kenyan numbers only." value={account.phone} error={accountErrors.phone} onChange={(event) => setAccount({ ...account, phone: event.target.value })} />
              ) : null}
              <Field id="password" label="Password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={account.password} error={accountErrors.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} />
              {accountError ? <p className="field-error" role="alert">{accountError}</p> : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</Button>
                <Link to="/forgot-password" className="text-sm font-semibold text-gold-deep">Forgot password</Link>
              </div>
            </form>
          ) : (
            <section className="panel p-5">
              <h2 className="display text-2xl">Signed in</h2>
              <p className="mt-2">{personName(user)} · {user.email}</p>
            </section>
          )}

          {user ? (
            <form className="panel space-y-4 p-5" onSubmit={placeOrder}>
              <h2 className="display text-2xl text-plum">Delivery details</h2>
              {addresses.length ? (
                <Field id="saved-address" label="Saved address" as="select" value={addressId} onChange={(event) => setAddressId(event.target.value)}>
                  <option value="">Enter a new address</option>
                  {addresses.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.recipient_name}, {row.area_or_estate}, {row.town}{row.is_default ? ' (default)' : ''}
                    </option>
                  ))}
                </Field>
              ) : null}
              {!addressId ? (
                <>
                  <AddressForm value={address} onChange={setAddress} errors={addressErrors} />
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} />
                    Save this address to my account
                  </label>
                </>
              ) : null}
              <Field id="note" as="textarea" label="Note for the store" value={note} onChange={(event) => setNote(event.target.value)} />
              <Field id="promo" label="Promotion code" hint="Optional. The store checks the code." value={code} error={fieldError({ details: {} }, 'promotion_code')} onChange={(event) => setCode(event.target.value)} />
              <div>
                <h3 className="text-base font-bold text-plum-deep">Choose how to pay</h3>
                <div className="pay-options mt-3">
                  <div className="pay-option on">
                    <span className="flex items-center gap-2 font-bold text-plum-deep">
                      <input type="radio" name="pay-method" checked readOnly />
                      Pay with M-Pesa
                    </span>
                    <MpesaPaybill amount={quote?.grand_total} currency={quote?.currency} />
                  </div>
                  <div className="pay-option" aria-disabled="true">
                    <span className="flex items-center gap-2 font-bold text-plum-deep">
                      Pay with chama
                      <span className="badge">Coming soon</span>
                    </span>
                    <span className="text-sm text-muted">Chama checkout is not available in this release.</span>
                  </div>
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                <span>
                  I have read the <Link to="/terms" className="font-semibold text-gold-deep">terms</Link> and the{' '}
                  <Link to="/delivery-returns" className="font-semibold text-gold-deep">delivery notes</Link>.
                </span>
              </label>
              {quoteError ? <p className="field-error" role="alert">{quoteError}</p> : null}
              {formError ? <p className="field-error" role="alert">{formError}</p> : null}
              <Button type="submit" disabled={busy || !quote}>
                {busy ? 'Placing order…' : 'Confirm and pay'}
              </Button>
            </form>
          ) : null}
        </div>
        <aside className="panel h-fit p-5">
          <h2 className="display text-2xl">Order</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {(quote?.items || items).map((item) => (
              <li key={item.product_id} className="flex justify-between gap-3">
                <span>
                  {item.name} × {item.quantity}
                  {item.stock_warning ? <span className="block text-danger">{item.stock_warning}</span> : null}
                </span>
                <span className="price">{money(item.line_total || item.line_subtotal)}</span>
              </li>
            ))}
          </ul>
          {quote ? (
            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(quote.subtotal, quote.currency)}</dd></div>
              <div className="flex justify-between"><dt>Discount</dt><dd>{money(quote.discount_total, quote.currency)}</dd></div>
              <div className="flex justify-between"><dt>Delivery{quote.delivery_place ? ` · ${quote.delivery_place}` : ''}</dt><dd>{money(quote.delivery_fee, quote.currency)}</dd></div>
              {Number(quote.tax_total) > 0 ? <div className="flex justify-between"><dt>Tax</dt><dd>{money(quote.tax_total, quote.currency)}</dd></div> : null}
              <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd className="price">{money(quote.grand_total, quote.currency)}</dd></div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted">{quoteError || 'Calculating the store total…'}</p>
          )}
          <p className="mt-3 text-xs text-muted">Amounts come from the store and are checked again when the order is created.</p>
        </aside>
      </div>
    </div>
  )
}
