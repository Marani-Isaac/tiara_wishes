import { api, request } from './client'

export function listPromotions() {
  return request(api.get('/admin/promotions'))
}

export function getPromotion(id) {
  return request(api.get(`/admin/promotions/${id}`))
}

export function createPromotion(payload) {
  return request(api.post('/admin/promotions', payload))
}

export function updatePromotion(id, payload) {
  return request(api.patch(`/admin/promotions/${id}`, payload))
}

export function deactivatePromotion(id) {
  return request(api.delete(`/admin/promotions/${id}`))
}
