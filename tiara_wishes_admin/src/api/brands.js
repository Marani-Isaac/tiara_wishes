import { api, request } from './client'

export async function listBrands() {
  try {
    const body = await request(api.get('/admin/brands'))
    return body.data || []
  } catch (error) {
    if (error.status !== 403) throw error
    const body = await request(api.get('/brands'))
    return body.data || []
  }
}

export function createBrand(payload) {
  return request(api.post('/admin/brands', payload))
}

export function updateBrand(id, payload) {
  return request(api.patch(`/admin/brands/${id}`, payload))
}

export function deleteBrand(id) {
  return request(api.delete(`/admin/brands/${id}`))
}
