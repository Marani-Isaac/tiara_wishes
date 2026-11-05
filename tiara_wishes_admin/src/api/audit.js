import { api, request } from './client'

export function listAuditLogs(params) {
  return request(api.get('/admin/audit-logs', { params }))
}
