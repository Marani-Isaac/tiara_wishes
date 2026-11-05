import { api, request } from './client'

export function listOrders(params) {
  return request(api.get('/admin/orders', { params }))
}

export function getOrder(orderNumber) {
  return request(api.get(`/admin/orders/${encodeURIComponent(orderNumber)}`))
}

export function updateOrderStatus(orderNumber, payload) {
  return request(api.patch(`/admin/orders/${encodeURIComponent(orderNumber)}`, payload))
}
