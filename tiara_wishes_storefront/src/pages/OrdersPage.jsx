import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listOrders } from '../api/orders'
import { OrderCard } from '../components/account/OrderCard'
import Pagination from '../components/common/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'

export default function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') || '1') || 1
  const [orders, setOrders] = useState([])
  const [meta, setMeta] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setStatus('loading')
    listOrders({ page, per_page: 10 })
      .then((body) => {
        if (!active) return
        setOrders(body.data || [])
        setMeta(body.meta)
        setStatus('ready')
      })
      .catch((err) => {
        if (!active) return
        setError(err)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [page])

  if (status === 'loading') return <LoadingState label="Loading orders" />
  if (status === 'error') return <ErrorState message={error?.message} onRetry={() => setParams({ page: String(page) })} />
  if (!orders.length) return <EmptyState title="No orders yet" message="When you place a cash order, it will appear here." />

  return (
    <div>
      <div className="grid gap-3">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
      <Pagination page={meta?.page || page} pages={meta?.pages || 0} onPage={(next) => setParams(next > 1 ? { page: String(next) } : {})} />
    </div>
  )
}
