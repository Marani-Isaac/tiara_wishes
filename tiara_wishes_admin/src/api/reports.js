import { api, request } from './client'

export function salesReport(params) {
  return request(api.get('/admin/reports/sales', { params }))
}

export function productReport(params) {
  return request(api.get('/admin/reports/products', { params }))
}
