const CART_KEY = 'tiara_wishes_guest_cart'
const IMAGE_KEY = 'tiara_wishes_cart_images'
const GUEST_FLAG = 'tiara_guest_cart'

export function readGuestCart() {
  try {
    const data = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    if (!Array.isArray(data)) return []
    return data
      .map((item) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
      }))
      .filter((item) => Number.isInteger(item.product_id) && item.product_id > 0 && item.quantity > 0)
  } catch {
    return []
  }
}

export function writeGuestCart(items) {
  const compact = (items || [])
    .filter((item) => item.available !== false)
    .map((item) => ({ product_id: item.product_id, quantity: item.quantity }))
  localStorage.setItem(CART_KEY, JSON.stringify(compact))
  if (compact.length) sessionStorage.setItem(GUEST_FLAG, '1')
  else sessionStorage.removeItem(GUEST_FLAG)
}

export function clearGuestCart() {
  localStorage.removeItem(CART_KEY)
  sessionStorage.removeItem(GUEST_FLAG)
}

export function hasGuestCartFlag() {
  return sessionStorage.getItem(GUEST_FLAG) === '1' || readGuestCart().length > 0
}

export function rememberProduct(product) {
  if (!product?.id) return
  const images = readImages()
  const image = product.primary_image?.image_url || product.images?.[0]?.image_url || ''
  images[product.id] = {
    image,
    alt: product.primary_image?.alt_text || product.name,
    name: product.name,
    slug: product.slug,
  }
  localStorage.setItem(IMAGE_KEY, JSON.stringify(images))
}

export function readImages() {
  try {
    const data = JSON.parse(localStorage.getItem(IMAGE_KEY) || '{}')
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}
