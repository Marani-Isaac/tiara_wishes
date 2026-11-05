import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adjustStock, listInventory } from '../api/inventory'
import ConfirmDialog from '../components/common/ConfirmDialog'
import DataTable from '../components/common/DataTable'
import Pagination from '../components/common/Pagination'
import StatusBadge from '../components/common/StatusBadge'
import StockAdjustmentForm from '../components/inventory/StockAdjustmentForm'
import { EmptyState, ErrorState, LoadingState, PageHeader, SuccessNote } from '../components/common/States'
import { readPage } from '../lib/format'

export default function InventoryPage() {
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState({ loading: true, error: null, rows: [], meta: null })
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState(null)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const low = params.get('low_stock') === '1'

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: null }))
    listInventory({
      page: readPage(params),
      per_page: 20,
      low_stock: low ? 'true' : undefined,
    })
      .then((body) => {
        if (!active) return
        setState({ loading: false, error: null, rows: body.data || [], meta: body.meta })
      })
      .catch((error) => {
        if (active) setState({ loading: false, error, rows: [], meta: null })
      })
    return () => {
      active = false
    }
  }, [params, low])

  async function confirm() {
    setBusy(true)
    setFormError('')
    try {
      const body = await adjustStock(draft)
      setNotice(body.message || 'Stock adjusted')
      setDraft(null)
      setSelected(null)
      setParams(new URLSearchParams(params))
    } catch (error) {
      setFormError(error.details?.quantity_change || error.details?.reason || error.message)
      setDraft(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Stock"
        title="Inventory"
        description="On-hand and reserved quantities are the stock record. Adjustments require a reason and are written to the audit log. Movement history is visible in Audit logs."
      />
      <SuccessNote>{notice}</SuccessNote>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={low}
          onChange={(event) => {
            const next = new URLSearchParams(params)
            if (event.target.checked) next.set('low_stock', '1')
            else next.delete('low_stock')
            next.delete('page')
            setParams(next)
          }}
        />
        Low stock only
      </label>
      <StockAdjustmentForm
        product={selected}
        busy={busy}
        error={formError}
        onSubmit={(payload) => setDraft(payload)}
      />
      {!selected && !state.loading && !state.error ? (
        <p className="panel mb-4 p-4 text-sm text-muted">Choose Adjust on a product. The stock form stays above the list.</p>
      ) : null}
      {state.loading ? <LoadingState label="Loading inventory" /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={() => setParams(new URLSearchParams(params))} /> : null}
      {!state.loading && !state.error && state.rows.length === 0 ? (
        <EmptyState title="No stock rows" body="Products create an inventory record when they are saved." />
      ) : null}
      {state.rows.length > 0 ? (
        <div className="panel p-3">
          <DataTable
            rowKey={(row) => row.product_id}
            rows={state.rows}
            columns={[
              { key: 'name', header: 'Product', cell: (row) => row.name },
              { key: 'sku', header: 'SKU', cell: (row) => row.sku },
              { key: 'on', header: 'On hand', cell: (row) => row.on_hand },
              { key: 'reserved', header: 'Reserved', cell: (row) => row.reserved },
              { key: 'available', header: 'Available', cell: (row) => row.available },
              { key: 'threshold', header: 'Threshold', cell: (row) => row.low_stock_threshold },
              {
                key: 'status',
                header: 'Status',
                cell: (row) => (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <StatusBadge value={row.status} />
                  {row.available <= row.low_stock_threshold ? (
                    <span className="text-xs font-semibold text-warn">Low stock</span>
                  ) : null}
                </span>
              ),
              },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <button className="btn btn-ghost" type="button" onClick={() => { setSelected(row); setFormError('') }}>
                    Adjust
                  </button>
                ),
              },
            ]}
          />
          <Pagination
            meta={state.meta}
            onPage={(page) => {
              const next = new URLSearchParams(params)
              next.set('page', String(page))
              setParams(next)
            }}
          />
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(draft)}
        title="Save this stock change?"
        body={`Change ${selected?.name || 'this product'} by ${draft?.quantity_change}. The API will reject the change if it would break reserved stock.`}
        confirmLabel="Adjust stock"
        busy={busy}
        onClose={() => setDraft(null)}
        onConfirm={confirm}
      />
    </div>
  )
}
