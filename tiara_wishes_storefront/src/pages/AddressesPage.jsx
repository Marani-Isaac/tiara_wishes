import { useEffect, useState } from 'react'
import { createAddress, deleteAddress, listAddresses, updateAddress } from '../api/account'
import AddressForm, { emptyAddress } from '../components/checkout/AddressForm'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/States'
import { ErrorState, LoadingState } from '../components/common/States'
import { useToast } from '../context/ToastContext'
import { phoneError, required } from '../utils/validation'

export default function AddressesPage() {
  const { push } = useToast()
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [form, setForm] = useState(emptyAddress)
  const [editing, setEditing] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [removeId, setRemoveId] = useState(null)

  async function load() {
    setStatus('loading')
    try {
      const body = await listAddresses()
      setRows(body.data || [])
      setStatus('ready')
    } catch (err) {
      setError(err)
      setStatus('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  function validate(value) {
    const next = {
      recipient_name: required(value.recipient_name, 'Recipient name'),
      recipient_phone: phoneError(value.recipient_phone, { required: true }),
      county: required(value.county, 'County'),
      town: required(value.town, 'Town'),
      area_or_estate: required(value.area_or_estate, 'Area or estate'),
    }
    setErrors(next)
    return !Object.values(next).some(Boolean)
  }

  async function onCreate(event) {
    event.preventDefault()
    if (!validate(form)) return
    setBusy(true)
    try {
      await createAddress({ ...form, is_default: rows.length === 0 })
      setForm(emptyAddress)
      push('Address saved')
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onEdit(event) {
    event.preventDefault()
    if (!validate(editing)) return
    setBusy(true)
    try {
      await updateAddress(editing.id, editing)
      setEditing(null)
      push('Address updated')
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function makeDefault(row) {
    try {
      await updateAddress(row.id, { is_default: true })
      push('Default address updated')
      await load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function confirmRemove() {
    setBusy(true)
    try {
      await deleteAddress(removeId)
      setRemoveId(null)
      push('Address deleted')
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {status === 'loading' ? <LoadingState label="Loading addresses" /> : null}
      {status === 'error' ? <ErrorState message={error?.message} onRetry={load} /> : null}
      {status === 'ready' && rows.length === 0 ? <p className="text-muted">No saved addresses yet.</p> : null}
      <div className="grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.recipient_name} {row.is_default ? <span className="badge">Default</span> : null}</p>
                <p className="text-sm text-muted">{row.recipient_phone}</p>
                <p className="mt-1 text-sm">{[row.building, row.house_or_unit, row.area_or_estate, row.town, row.county].filter(Boolean).join(', ')}</p>
                {row.delivery_instructions ? <p className="mt-1 text-sm text-muted">{row.delivery_instructions}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {!row.is_default ? <Button variant="ghost" onClick={() => makeDefault(row)}>Make default</Button> : null}
                <Button variant="ghost" onClick={() => setEditing({ ...row })}>Edit</Button>
                <Button variant="danger" onClick={() => setRemoveId(row.id)}>Delete</Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <form className="panel space-y-4 p-5" onSubmit={onCreate}>
        <h2 className="display text-3xl">Add an address</h2>
        <AddressForm value={form} onChange={setForm} errors={errors} idPrefix="new-address" />
        <Button type="submit" disabled={busy}>Save address</Button>
      </form>
      <Modal open={Boolean(editing)} title="Edit address" onClose={() => setEditing(null)}>
        {editing ? (
          <form className="space-y-4" onSubmit={onEdit}>
            <AddressForm value={editing} onChange={setEditing} errors={errors} idPrefix="edit-address" />
            <Button type="submit" disabled={busy}>Save changes</Button>
          </form>
        ) : null}
      </Modal>
      <Modal open={Boolean(removeId)} title="Delete address" onClose={() => setRemoveId(null)}>
        <p>This removes the address from your account. Past orders keep their own delivery snapshot.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" disabled={busy} onClick={confirmRemove}>Delete</Button>
          <Button variant="ghost" onClick={() => setRemoveId(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  )
}
