import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field } from '../components/common/Button'
import { useAuth } from '../context/AuthContext'
import { emailError, passwordError, phoneError, required, safeNext } from '../utils/validation'
import { AuthFrame } from './LoginPage'

export default function RegisterPage() {
  const { register, user, ready } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next') || '/account')
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (ready && user) return <Navigate to={next} replace />

  function set(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    const nextErrors = {
      first_name: required(form.first_name, 'First name'),
      last_name: required(form.last_name, 'Last name'),
      email: emailError(form.email),
      phone: phoneError(form.phone),
      password: passwordError(form.password),
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return
    setBusy(true)
    setError('')
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
      }
      if (form.phone.trim()) payload.phone = form.phone.trim()
      await register(payload)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message)
      setErrors((current) => ({ ...current, ...(err.details || {}) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame title="Create an account" subtitle="Use it at checkout. You can still browse the shop without one.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="reg-first" label="First name" value={form.first_name} error={errors.first_name} onChange={(event) => set('first_name', event.target.value)} />
          <Field id="reg-last" label="Last name" value={form.last_name} error={errors.last_name} onChange={(event) => set('last_name', event.target.value)} />
        </div>
        <Field id="reg-email" label="Email" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={(event) => set('email', event.target.value)} />
        <Field id="reg-phone" label="Phone" hint="Optional." value={form.phone} error={errors.phone} onChange={(event) => set('phone', event.target.value)} />
        <Field id="reg-password" label="Password" type="password" autoComplete="new-password" hint="8 or more characters, with a letter and a number." value={form.password} error={errors.password} onChange={(event) => set('password', event.target.value)} />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <Button type="submit" block disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already registered? <Link to={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-ink">Sign in</Link>
      </p>
    </AuthFrame>
  )
}
