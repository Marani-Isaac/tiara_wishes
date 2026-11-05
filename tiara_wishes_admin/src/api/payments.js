import { api, request } from './client'

export function listPayments(params) {
  return request(api.get('/admin/payments', { params }))
}

export function getPayment(merchantReference) {
  return request(api.get(`/payments/${encodeURIComponent(merchantReference)}`))
}

export function reconcilePayment(id, payload) {
  return request(api.patch(`/admin/payments/${id}`, payload))
}

export function recordRefund(payload) {
  return request(api.post('/admin/refunds', payload))
}
