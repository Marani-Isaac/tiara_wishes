import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { personName } from '../../lib/format'

export default function Topbar({ title, onMenu }) {
  const { user, logout } = useAdminAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function signOut() {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <header className="z-20 shrink-0 border-b border-line bg-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <button className="btn btn-ghost md:hidden" type="button" onClick={onMenu} aria-label="Open navigation">
          Menu
        </button>
        <h1 className="display text-2xl leading-none text-plum-deep md:text-3xl">{title}</h1>
      </div>
      <div className="relative">
        <button className="btn btn-gold" type="button" onClick={() => setOpen((value) => !value)}>
          {personName(user)}
        </button>
        {open ? (
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-line bg-card p-3 shadow-lg">
            <p className="text-sm">{user?.email}</p>
            <p className="mt-1 text-xs capitalize text-muted">{(user?.roles || []).join(', ') || 'Staff'}</p>
            <button className="btn btn-ghost mt-3 w-full" type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : null}
      </div>
      </div>
    </header>
  )
}
