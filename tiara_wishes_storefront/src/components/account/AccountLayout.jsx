import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/account', label: 'Profile', end: true },
  { to: '/account/addresses', label: 'Addresses' },
  { to: '/account/orders', label: 'Orders' },
]

export default function AccountLayout() {
  return (
    <div className="shell py-8">
      <p className="eyebrow">Account</p>
      <h1 className="display mt-2 text-3xl">Your Tiara Wishes</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav className="flex gap-2 overflow-auto lg:flex-col" aria-label="Account">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `rounded-full px-4 py-2 text-sm font-semibold ${isActive ? 'bg-ink text-card' : 'bg-card text-ink'}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
