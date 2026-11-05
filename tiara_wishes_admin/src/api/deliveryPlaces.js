import { api, request } from './client'

export function listCounties() {
  return request(api.get('/counties'))
}

export function listDeliveryPlaces() {
  return request(api.get('/admin/delivery-places'))
}

export function createDeliveryPlace(payload) {
  return request(api.post('/admin/delivery-places', payload))
}

export function updateDeliveryPlace(id, payload) {
  return request(api.patch(`/admin/delivery-places/${id}`, payload))
}

export function deleteDeliveryPlace(id) {
  return request(api.delete(`/admin/delivery-places/${id}`))
}
