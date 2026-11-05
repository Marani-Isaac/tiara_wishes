import { api, request } from './client'

export function listProducts(params) {
  return request(api.get('/admin/products', { params }))
}

export function getProduct(id) {
  return request(api.get(`/admin/products/${id}`))
}

export function createProduct(payload) {
  return request(api.post('/admin/products', payload))
}

export function updateProduct(id, payload) {
  return request(api.patch(`/admin/products/${id}`, payload))
}

export function archiveProduct(id) {
  return request(api.delete(`/admin/products/${id}`))
}

export function uploadProductImage(id, file, altText) {
  const form = new FormData()
  form.append('image', file)
  if (altText) form.append('alt_text', altText)
  return request(
    api.post(`/admin/products/${id}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}

export function deleteProductImage(productId, imageId) {
  return request(api.delete(`/admin/products/${productId}/images/${imageId}`))
}

export function reorderProductImages(productId, imageIds) {
  return request(api.patch(`/admin/products/${productId}/images/reorder`, { image_ids: imageIds }))
}
