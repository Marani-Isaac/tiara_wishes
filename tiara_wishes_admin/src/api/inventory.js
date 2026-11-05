import { api, request } from './client'

export function listInventory(params) {
  return request(api.get('/admin/inventory', { params }))
}

export function adjustStock(payload) {
  return request(api.post('/admin/inventory/adjustments', payload))
}
