import { api, request } from './client'

export function listDeliveries(params) {
  return request(api.get('/admin/deliveries', { params }))
}

export function updateDelivery(id, payload) {
  return request(api.patch(`/admin/deliveries/${id}`, payload))
}
