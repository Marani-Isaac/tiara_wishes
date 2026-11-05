import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { forgotPassword, resetPassword } from '../api/auth'
import { Button, Field } from '../components/common/Button'
import { AuthFrame } from './LoginPage'
import { emailError, passwordError } from '../utils/validation'

export default function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  return token ? <ResetForm token={token} /> : <RequestForm />
}

function RequestForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    const emailMessage = emailError(email)
    setError(emailMessage)
    if (emailMessage) return
    setBusy(true)
    try {
      setMessage(await forgotPassword(email.trim()))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame title="Reset your password" subtitle="If the store can send email, a reset link will be sent. The page does not confirm whether an account exists.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field id="forgot-email" label="Email" type="email" value={email} error={error && !message ? error : ''} onChange={(event) => setEmail(event.target.value)} />
        {message ? <p role="status">{message}</p> : null}
        <Button type="submit" block disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
      </form>
      <p className="mt-4 text-sm"><Link to="/login" className="font-semibold text-gold-deep">Back to sign in</Link></p>
    </AuthFrame>
  )
}

function ResetForm({ token }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    const passwordMessage = passwordError(password)
    setError(passwordMessage)
    if (passwordMessage) return
    setBusy(true)
    try {
      setMessage(await resetPassword(token, password))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame title="Choose a new password" subtitle="Use the link from your email. An expired link will be declined by the store.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field id="new-password" label="New password" type="password" value={password} error={error} onChange={(event) => setPassword(event.target.value)} />
        {message ? <p role="status">{message}</p> : null}
        <Button type="submit" block disabled={busy}>{busy ? 'Saving…' : 'Update password'}</Button>
      </form>
      <p className="mt-4 text-sm"><Link to="/login" className="font-semibold text-gold-deep">Sign in</Link></p>
    </AuthFrame>
  )
}
