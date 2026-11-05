import { api, request } from './client'

export function fetchCart() {
  const body = request(api.get('/cart'))
  return body
}

export function addCartItem(productId, quantity) {
  return request(api.post('/cart/items', { product_id: productId, quantity }))
}

export function updateCartItem(itemId, quantity) {
  return request(api.patch(`/cart/items/${itemId}`, { quantity }))
}

export function removeCartItem(itemId) {
  return request(api.delete(`/cart/items/${itemId}`))
}

export function mergeCart() {
  return request(api.post('/cart/merge', {}))
}
