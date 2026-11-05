import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field } from '../components/common/Button'
import { useAuth } from '../context/AuthContext'
import { emailError, passwordError, safeNext } from '../utils/validation'

export default function LoginPage() {
  const { login, user, ready } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (ready && user) return <Navigate to={next} replace />

  async function onSubmit(event) {
    event.preventDefault()
    const nextErrors = { email: emailError(email), password: password ? '' : 'Password is required' }
    setErrors(nextErrors)
    if (nextErrors.email || nextErrors.password) return
    setBusy(true)
    setError('')
    try {
      await login(email.trim(), password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to check out, save addresses, and follow your orders.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field id="login-email" label="Email" type="email" autoComplete="email" value={email} error={errors.email} onChange={(event) => setEmail(event.target.value)} />
        <Field id="login-password" label="Password" type="password" autoComplete="current-password" value={password} error={errors.password} onChange={(event) => setPassword(event.target.value)} />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <Button type="submit" block disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/forgot-password" className="font-semibold text-gold-deep">Forgot password</Link>
      </p>
      <p className="mt-2 text-sm text-muted">
        New here? <Link to={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-ink">Create an account</Link>
      </p>
    </AuthFrame>
  )
}

export function AuthFrame({ title, subtitle, children }) {
  return (
    <div className="shell grid min-h-[70vh] items-center gap-8 py-10 lg:grid-cols-2">
      <section className="hidden rounded-[28px] bg-plum p-10 text-card lg:block">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Tiara Wishes</p>
        <h1 className="display mt-4 text-4xl">{title}</h1>
        <p className="mt-4 max-w-md text-lg text-gold-soft">{subtitle}</p>
      </section>
      <section className="panel mx-auto w-full max-w-md p-6">
        <h1 className="display text-3xl lg:hidden">{title}</h1>
        {children}
      </section>
    </div>
  )
}
