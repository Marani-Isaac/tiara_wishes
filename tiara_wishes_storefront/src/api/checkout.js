import { api, request } from './client'

export function quoteCheckout(payload) {
  return request(api.post('/checkout/quote', payload))
}

export function createOrder(payload, idempotencyKey) {
  return request(
    api.post('/orders', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  )
}

export function initiatePayment(orderNumber, payload, idempotencyKey) {
  return request(
    api.post(`/orders/${encodeURIComponent(orderNumber)}/payments`, payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  )
}
