import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '../../lib/constants'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { getNavCounts } from '../../api/dashboard'

export default function Sidebar({ open, onNavigate }) {
  const { can, canAny } = useAdminAuth()
  const { pathname } = useLocation()
  const [counts, setCounts] = useState({})
  const items = NAV_ITEMS.filter((item) => {
    if (item.coming) return true
    if (item.anyOf) return canAny(item.anyOf)
    return can(item.permission)
  })

  useEffect(() => {
    let active = true
    getNavCounts()
      .then((body) => {
        if (active) setCounts(body.data || {})
      })
      .catch(() => {
        if (active) setCounts({})
      })
    return () => {
      active = false
    }
  }, [pathname])

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-72 min-h-0 flex-col overflow-hidden bg-plum-deep text-gold-soft transition-transform md:static md:h-full md:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-full min-h-0 flex-col px-5 py-6">
        <div className="flex shrink-0 items-center gap-2 text-gold">
          <span className="text-lg leading-none" aria-hidden="true">✦</span>
          <div>
            <p className="wordmark display text-2xl leading-none text-gold">Tiara Wishes</p>
            <p className="mt-1 text-xs text-gold-soft">Staff workspace</p>
          </div>
        </div>
        <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain" aria-label="Admin">
          {items.map((item) => {
            const count = item.count == null ? null : counts[item.count]
            return item.coming ? (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-full px-3 py-2 text-sm ${
                    isActive ? 'bg-gold font-bold text-plum-deep' : 'text-gold-soft hover:bg-white/10'
                  }`
                }
              >
                <span>{item.label}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide">Later</span>
              </NavLink>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                aria-label={count == null ? item.label : `${item.label}, ${count}`}
                className={({ isActive }) =>
                  `flex items-center justify-between gap-3 rounded-full px-3 py-2 text-sm font-semibold ${
                    isActive ? 'bg-gold text-plum-deep' : 'text-gold-soft hover:bg-white/10'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span>{item.label}</span>
                    {count == null ? null : (
                      <span
                        className={`min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums ${
                          isActive ? 'bg-plum-deep/10 text-plum-deep' : 'bg-white/15 text-gold'
                        }`}
                      >
                        {Number(count).toLocaleString()}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
