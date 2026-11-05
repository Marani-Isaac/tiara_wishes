import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { changePassword, listNotifications, updateProfile } from '../api/account'
import { listOrders } from '../api/orders'
import { OrderCard } from '../components/account/OrderCard'
import { Button, Field } from '../components/common/Button'
import { ErrorState, LoadingState } from '../components/common/States'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatWhen } from '../utils/format'
import { passwordError, phoneError, required } from '../utils/validation'

export default function AccountPage() {
  const { user, refreshUser, logout } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ first_name: user?.first_name || '', last_name: user?.last_name || '', phone: user?.phone || '' })
  const [password, setPassword] = useState({ current_password: '', new_password: '' })
  const [orders, setOrders] = useState([])
  const [notes, setNotes] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setForm({ first_name: user?.first_name || '', last_name: user?.last_name || '', phone: user?.phone || '' })
  }, [user])

  useEffect(() => {
    let active = true
    Promise.all([listOrders({ per_page: 3 }), listNotifications({ per_page: 4 }).catch(() => ({ data: [] }))])
      .then(([orderBody, noteBody]) => {
        if (!active) return
        setOrders(orderBody.data || [])
        setNotes(noteBody.data || [])
        setStatus('ready')
      })
      .catch((err) => {
        if (!active) return
        setError(err.message)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [])

  async function saveProfile(event) {
    event.preventDefault()
    const details = {
      first_name: required(form.first_name, 'First name'),
      last_name: required(form.last_name, 'Last name'),
      phone: phoneError(form.phone),
    }
    if (Object.values(details).some(Boolean)) {
      setError(Object.values(details).find(Boolean))
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateProfile({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
      })
      await refreshUser()
      push('Profile updated')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function savePassword(event) {
    event.preventDefault()
    const message = passwordError(password.new_password)
    if (!password.current_password || message) {
      setError(message || 'Enter your current password')
      return
    }
    setBusy(true)
    setError('')
    try {
      await changePassword(password)
      await logout()
      push('Password updated. Sign in with the new password.')
      navigate('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <h2 className="display text-3xl">Profile</h2>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={saveProfile}>
          <Field id="acc-first" label="First name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
          <Field id="acc-last" label="Last name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
          <Field id="acc-email" label="Email" value={user?.email || ''} disabled />
          <Field id="acc-phone" label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>Save profile</Button>
          </div>
        </form>
      </section>
      <section className="panel space-y-4 p-5">
        <h2 className="display text-3xl">Password</h2>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={savePassword}>
          <Field id="current-password" label="Current password" type="password" value={password.current_password} onChange={(event) => setPassword({ ...password, current_password: event.target.value })} />
          <Field id="next-password" label="New password" type="password" value={password.new_password} onChange={(event) => setPassword({ ...password, new_password: event.target.value })} />
          <div className="sm:col-span-2">
            <Button type="submit" variant="ghost" disabled={busy}>Update password</Button>
          </div>
        </form>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <Button variant="ghost" onClick={logout}>Sign out</Button>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-3xl">Recent orders</h2>
          <Link to="/account/orders" className="text-sm font-semibold text-gold-deep">All orders</Link>
        </div>
        {status === 'loading' ? <LoadingState label="Loading orders" /> : null}
        {status === 'error' ? <ErrorState message={error} /> : null}
        {status === 'ready' && orders.length === 0 ? <p className="text-muted">You have not placed an order yet.</p> : null}
        <div className="grid gap-3">{orders.map((order) => <OrderCard key={order.id} order={order} />)}</div>
      </section>
      {notes.length ? (
        <section>
          <h2 className="display text-3xl">Updates</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {notes.map((note) => (
              <li key={note.id} className="panel p-3">
                <p className="font-semibold">{note.title || note.subject || 'Update'}</p>
                <p className="text-muted">{note.body || note.message}</p>
                <p className="text-xs text-muted">{formatWhen(note.created_at)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
