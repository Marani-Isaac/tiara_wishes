import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'
import { LoadingState } from './common/States'

export function RequireAuth({ children }) {
  const { user, ready } = useAdminAuth()
  const location = useLocation()
  if (!ready) return <div className="p-8"><LoadingState label="Checking your session" /></div>
  if (!user) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/admin/login?next=${encodeURIComponent(next)}`} replace />
  }
  return children
}

export function RequirePermission({ permission, anyOf, children }) {
  const { can, canAny } = useAdminAuth()
  const allowed = anyOf ? canAny(anyOf) : can(permission)
  if (!allowed) {
    return (
      <div className="panel px-6 py-8" role="alert">
        <p className="eyebrow">Access denied</p>
        <h2 className="display mt-2 text-3xl">This area is closed</h2>
        <p className="mt-2 max-w-xl text-muted">
          Your role can open the admin, but it does not include this permission. The API would refuse the request as well.
        </p>
      </div>
    )
  }
  return children
}
