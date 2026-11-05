import { api, request } from './client'

export function listCustomers(params) {
  return request(api.get('/admin/customers', { params }))
}

export function updateCustomerStatus(id, status) {
  return request(api.patch(`/admin/customers/${id}`, { status }))
}

export function setCustomerRoles(id, roles) {
  return request(api.post(`/admin/customers/${id}/roles`, { roles }))
}
