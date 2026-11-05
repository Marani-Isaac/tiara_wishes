import { api, request } from './client'

export function listOrders(params) {
  return request(api.get('/account/orders', { params }))
}

export function getOrder(orderNumber) {
  return request(api.get(`/account/orders/${encodeURIComponent(orderNumber)}`))
}

export function cancelOrder(orderNumber, reason) {
  return request(api.post(`/orders/${encodeURIComponent(orderNumber)}/cancel`, { reason }))
}

export function getPayment(merchantReference) {
  return request(api.get(`/payments/${encodeURIComponent(merchantReference)}`))
}
