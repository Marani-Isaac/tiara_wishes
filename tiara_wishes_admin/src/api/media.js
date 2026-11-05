import { api, request } from './client'

export function uploadMedia(file, purpose) {
  const form = new FormData()
  form.append('image', file)
  form.append('purpose', purpose)
  return request(api.post('/admin/media', form))
}
