import { api, request } from './client'

export function getDashboard(params) {
  return request(api.get('/admin/dashboard', { params }))
}

export function getNavCounts() {
  return request(api.get('/admin/nav-counts'))
}
