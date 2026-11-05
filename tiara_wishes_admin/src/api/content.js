import { api, request } from './client'

export function listContent() {
  return request(api.get('/admin/content'))
}

export function createContent(payload) {
  return request(api.post('/admin/content', payload))
}

export function updateContent(id, payload) {
  return request(api.patch(`/admin/content/${id}`, payload))
}

export function deleteContent(id) {
  return request(api.delete(`/admin/content/${id}`))
}

export function getSettings() {
  return request(api.get('/admin/settings'))
}

export function updateSettings(payload) {
  return request(api.patch('/admin/settings', payload))
}
