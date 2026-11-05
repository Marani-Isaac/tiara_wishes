import { api, request } from './client'

export function listProducts(params) {
  return request(api.get('/products', { params }))
}

export function getProduct(slug) {
  return request(api.get(`/products/${encodeURIComponent(slug)}`))
}

export function listReviews(slug, params) {
  return request(api.get(`/products/${encodeURIComponent(slug)}/reviews`, { params }))
}

export function listCategories() {
  return request(api.get('/categories'))
}

export function getCategory(slug) {
  return request(api.get(`/categories/${encodeURIComponent(slug)}`))
}

export function listBrands() {
  return request(api.get('/brands'))
}

export function getHome() {
  return request(api.get('/site-content/home'))
}
