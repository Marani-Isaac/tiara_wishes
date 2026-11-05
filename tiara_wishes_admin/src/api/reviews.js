import { api, request } from './client'

export function moderateReview(id, status) {
  return request(api.patch(`/admin/reviews/${id}`, { status }))
}
