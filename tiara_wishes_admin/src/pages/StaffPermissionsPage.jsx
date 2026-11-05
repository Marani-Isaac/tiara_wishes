import { Link } from 'react-router-dom'
import { PageHeader } from '../components/common/States'
import { ASSIGNABLE_ROLES } from '../lib/constants'

const NOTES = {
  customer: 'Shopper account. No admin permissions.',
  admin: 'Full store administration, including role assignment.',
  super_admin: 'Same access as admin, including role assignment.',
  inventory_manager: 'Products, categories, brands, and stock.',
  order_manager: 'Orders, deliveries, and customer lookup.',
  finance_manager: 'Payments, refund records, reports, and audit logs.',
  content_manager: 'Homepage content, settings, promotions, and reviews.',
}

export default function StaffPermissionsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Access"
        title="Staff and permissions"
        description="Roles are assigned on a customer record. The API checks every request. This page cannot create a login or grant access by itself."
      />
      <div className="panel mb-4 p-5 text-sm text-muted">
        <p>
          People appear in Customers when they have the customer role. A staff account created only with an admin role will not be in that list.
          There is no public registration and no way to sign in as a customer.
        </p>
        <Link className="btn btn-gold mt-4" to="/admin/customers">
          Open customers
        </Link>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {ASSIGNABLE_ROLES.map((role) => (
          <li key={role} className="panel p-4">
            <h2 className="font-semibold capitalize">{role.replaceAll('_', ' ')}</h2>
            <p className="mt-1 text-sm text-muted">{NOTES[role]}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
