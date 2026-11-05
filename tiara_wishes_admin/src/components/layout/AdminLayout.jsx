import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Breadcrumbs from './Breadcrumbs'

const SECTIONS = [
  { test: /^\/admin\/products\/new$/, title: 'New product', crumbs: [{ label: 'Products', to: '/admin/products' }, { label: 'New' }] },
  { test: /^\/admin\/products\/[^/]+\/edit$/, title: 'Edit product', crumbs: [{ label: 'Products', to: '/admin/products' }, { label: 'Edit' }] },
  { test: /^\/admin\/products$/, title: 'Products', crumbs: [{ label: 'Products' }] },
  { test: /^\/admin\/categories$/, title: 'Categories', crumbs: [{ label: 'Categories' }] },
  { test: /^\/admin\/brands$/, title: 'Brands', crumbs: [{ label: 'Brands' }] },
  { test: /^\/admin\/inventory$/, title: 'Inventory', crumbs: [{ label: 'Inventory' }] },
  { test: /^\/admin\/orders\/[^/]+$/, title: 'Order', crumbs: [{ label: 'Orders', to: '/admin/orders' }, { label: 'Detail' }] },
  { test: /^\/admin\/orders$/, title: 'Orders', crumbs: [{ label: 'Orders' }] },
  { test: /^\/admin\/customers\/[^/]+$/, title: 'Customer', crumbs: [{ label: 'Customers', to: '/admin/customers' }, { label: 'Detail' }] },
  { test: /^\/admin\/customers$/, title: 'Customers', crumbs: [{ label: 'Customers' }] },
  { test: /^\/admin\/payments\/[^/]+$/, title: 'Payment', crumbs: [{ label: 'Payments', to: '/admin/payments' }, { label: 'Detail' }] },
  { test: /^\/admin\/payments$/, title: 'Payments', crumbs: [{ label: 'Payments' }] },
  { test: /^\/admin\/deliveries\/[^/]+$/, title: 'Delivery', crumbs: [{ label: 'Deliveries', to: '/admin/deliveries' }, { label: 'Detail' }] },
  { test: /^\/admin\/deliveries$/, title: 'Deliveries', crumbs: [{ label: 'Deliveries' }] },
  { test: /^\/admin\/promotions$/, title: 'Promotions', crumbs: [{ label: 'Promotions' }] },
  { test: /^\/admin\/reviews$/, title: 'Reviews', crumbs: [{ label: 'Reviews' }] },
  { test: /^\/admin\/content$/, title: 'Content', crumbs: [{ label: 'Content' }] },
  { test: /^\/admin\/settings$/, title: 'Settings', crumbs: [{ label: 'Settings' }] },
  { test: /^\/admin\/staff$/, title: 'Staff', crumbs: [{ label: 'Staff' }] },
  { test: /^\/admin\/reports$/, title: 'Reports', crumbs: [{ label: 'Reports' }] },
  { test: /^\/admin\/audit-logs$/, title: 'Audit logs', crumbs: [{ label: 'Audit logs' }] },
  { test: /^\/admin\/chama$/, title: 'Chama', crumbs: [{ label: 'Chama' }] },
  { test: /^\/admin$/, title: 'Dashboard', crumbs: [{ label: 'Dashboard' }] },
]

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const section = SECTIONS.find((item) => item.test.test(pathname)) || { title: 'Admin', crumbs: [] }
  const title = section.title
  const crumbs = section.crumbs

  return (
    <div className="h-dvh overflow-hidden md:grid md:grid-cols-[18rem_minmax(0,1fr)]">
      {open ? (
        <button
          className="fixed inset-0 z-30 bg-ink/30 md:hidden"
          aria-label="Close navigation"
          type="button"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      <div className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden">
        <p className="announce shrink-0">Quality home essentials · Staff workspace</p>
        <Topbar title={title} onMenu={() => setOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-8 md:py-8">
          <Breadcrumbs items={crumbs} />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
