import { api, request } from './client'

function flattenCategories(nodes, depth = 0, acc = []) {
  for (const node of nodes || []) {
    acc.push({ ...node, depth })
    if (node.children?.length) flattenCategories(node.children, depth + 1, acc)
  }
  return acc
}

export async function listCategories() {
  try {
    const body = await request(api.get('/admin/categories'))
    return body.data || []
  } catch (error) {
    if (error.status !== 403) throw error
    const body = await request(api.get('/categories'))
    return flattenCategories(body.data)
  }
}

export function createCategory(payload) {
  return request(api.post('/admin/categories', payload))
}

export function updateCategory(id, payload) {
  return request(api.patch(`/admin/categories/${id}`, payload))
}

export function deleteCategory(id) {
  return request(api.delete(`/admin/categories/${id}`))
}
