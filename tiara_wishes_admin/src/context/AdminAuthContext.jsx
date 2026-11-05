import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchMe, login as loginRequest, logout as logoutRequest } from '../api/auth'
import { getAccessToken, restoreSession, setAccessToken } from '../api/client'

const AdminAuthContext = createContext(null)

export function isStaff(user) {
  return Array.isArray(user?.permissions) && user.permissions.length > 0
}

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const applyUser = useCallback((next) => {
    if (next && !isStaff(next)) {
      setAccessToken(null)
      setUser(null)
      const error = new Error('This account does not have admin access.')
      error.status = 403
      throw error
    }
    setUser(next)
    return next
  }, [])

  useEffect(() => {
    let active = true
    async function bootstrap() {
      try {
        if (!getAccessToken()) {
          await restoreSession()
        }
        const me = await fetchMe()
        if (active) applyUser(me)
      } catch {
        if (active) {
          setAccessToken(null)
          setUser(null)
        }
      } finally {
        if (active) setReady(true)
      }
    }
    bootstrap()
    return () => {
      active = false
    }
  }, [applyUser])

  const login = useCallback(
    async (email, password) => {
      const result = await loginRequest(email, password)
      return applyUser(result.user)
    },
    [applyUser],
  )

  const logout = useCallback(async () => {
    await logoutRequest()
    setUser(null)
  }, [])

  const can = useCallback(
    (permission) => {
      if (!permission) return true
      return Boolean(user?.permissions?.includes(permission))
    },
    [user],
  )

  const canAny = useCallback(
    (permissions) => {
      if (!permissions?.length) return true
      return permissions.some((permission) => user?.permissions?.includes(permission))
    },
    [user],
  )

  const value = useMemo(
    () => ({ user, ready, login, logout, can, canAny }),
    [user, ready, login, logout, can, canAny],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('useAdminAuth must be used inside AdminAuthProvider')
  return context
}
