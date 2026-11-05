import { api, request } from './client'

export function updateProfile(payload) {
  return request(api.patch('/account', payload))
}

export function changePassword(payload) {
  return request(api.post('/account/password', payload))
}

export function listAddresses() {
  return request(api.get('/account/addresses'))
}

export function createAddress(payload) {
  return request(api.post('/account/addresses', payload))
}

export function updateAddress(id, payload) {
  return request(api.patch(`/account/addresses/${id}`, payload))
}

export function deleteAddress(id) {
  return request(api.delete(`/account/addresses/${id}`))
}

export function listNotifications(params) {
  return request(api.get('/account/notifications', { params }))
}
