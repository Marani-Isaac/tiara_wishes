import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { setCustomerRoles, updateCustomerStatus } from '../api/customers'
import ConfirmDialog from '../components/common/ConfirmDialog'
import StatusBadge from '../components/common/StatusBadge'
import { FormField, PageHeader, SuccessNote } from '../components/common/States'
import { useAdminAuth } from '../context/AdminAuthContext'
import { ASSIGNABLE_ROLES } from '../lib/constants'
import { formatWhen, personName } from '../lib/format'

export default function CustomerDetailsPage() {
  const { id } = useParams()
  const location = useLocation()
  const customer = location.state?.customer
  const { can } = useAdminAuth()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [roles, setRoles] = useState(customer?.roles || ['customer'])
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!customer || String(customer.id) !== String(id)) {
    return (
      <div className="panel p-6">
        <h1 className="display text-3xl">Open this customer from the list</h1>
        <p className="mt-2 text-muted">
          The API does not provide a single customer lookup or that customer's order history. Password hashes and payment secrets are never shown.
        </p>
        <Link className="btn btn-ghost mt-4" to="/admin/customers">
          Back to customers
        </Link>
      </div>
    )
  }

  async function run() {
    setBusy(true)
    setError('')
    try {
      const body =
        confirm === 'status'
          ? await updateCustomerStatus(customer.id, customer.status === 'active' ? 'disabled' : 'active')
          : await setCustomerRoles(customer.id, roles)
      setNotice(body.message)
      setConfirm(null)
    } catch (err) {
      setError(err.details?.roles || err.message)
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Customer"
        title={personName(customer)}
        description="Profile fields shown here are the ones the API returned on the customer list."
        actions={<Link className="btn btn-ghost" to="/admin/customers">All customers</Link>}
      />
      <SuccessNote>{notice}</SuccessNote>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <section className="panel p-5 text-sm">
        <p>{customer.email}</p>
        <p className="text-muted">{customer.phone || 'No phone'}</p>
        <p className="mt-2">Registered {formatWhen(customer.created_at)}</p>
        <p className="mt-2">Last sign-in {formatWhen(customer.last_login_at)}</p>
        <div className="mt-3">
          <StatusBadge value={customer.status} />
        </div>
        <p className="mt-4 text-muted">
          Saved addresses and a per-customer order history are not exposed on the admin API. Look up an order number from Orders when you need one.
        </p>
        {can('customers.manage') ? (
          <button className="btn btn-ghost mt-4" type="button" onClick={() => setConfirm('status')}>
            {customer.status === 'active' ? 'Disable account' : 'Enable account'}
          </button>
        ) : null}
      </section>
      {can('users.manage') ? (
        <section className="panel p-5">
          <h2 className="display text-3xl">Roles</h2>
          <p className="mt-1 text-sm text-muted">The browser cannot grant a role the API does not already know. You cannot change your own roles.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {ASSIGNABLE_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm capitalize">
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={(event) => {
                    setRoles((current) =>
                      event.target.checked ? [...current, role] : current.filter((item) => item !== role),
                    )
                  }}
                />
                {role.replaceAll('_', ' ')}
              </label>
            ))}
          </div>
          <FormField id="role-note" label="" hint="At least one role is required.">
            <span />
          </FormField>
          <button className="btn btn-gold mt-4" type="button" onClick={() => setConfirm('roles')}>
            Review role change
          </button>
        </section>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        danger={confirm === 'status' && customer.status === 'active'}
        title={confirm === 'roles' ? 'Update roles?' : 'Update account status?'}
        body="This is written to the audit log by the API. There is no sign-in-as-customer action."
        confirmLabel="Save"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={run}
      />
    </div>
  )
}
