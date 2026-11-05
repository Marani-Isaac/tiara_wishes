import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'

export default function LoginPage() {
  const { login, user, ready } = useAdminAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const next = safeNext(params.get('next'))

  if (ready && user) {
    return <Navigate to={next} replace />
  }

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email.trim(), password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message || 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen items-center gap-8 px-6 py-10 lg:grid-cols-2 lg:px-16">
      <section className="hidden rounded-[28px] bg-plum p-10 text-card lg:block">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-gold">
          <span aria-hidden="true">✦</span> Tiara Wishes
        </p>
        <h1 className="display mt-4 text-5xl">The shop, kept in order.</h1>
        <p className="mt-4 max-w-md text-lg text-gold-soft">
          Catalogue, stock, orders, payments, and deliveries share one shop with the storefront.
        </p>
        <p className="mt-8 text-sm text-gold-soft">Staff accounts are issued by an administrator. There is no public signup.</p>
      </section>
      <section className="panel mx-auto w-full max-w-md p-6">
        <p className="eyebrow">Admin sign in</p>
        <h2 className="display mt-2 text-4xl">Welcome back</h2>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="field-label">Email</span>
            <input
              className="field"
              type="email"
              autoComplete="username"
              value={email}
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="field-label">Password</span>
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              value={password}
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn mt-2 w-full" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  )
}

function safeNext(value) {
  if (!value || !value.startsWith('/admin') || value.startsWith('/admin/login')) return '/admin'
  return value
}
