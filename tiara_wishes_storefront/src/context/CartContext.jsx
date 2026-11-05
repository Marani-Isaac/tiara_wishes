import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { addCartItem, fetchCart, mergeCart, removeCartItem, updateCartItem } from '../api/cart'
import { useAuth } from './AuthContext'
import { clearGuestCart, hasGuestCartFlag, readGuestCart, readImages, rememberProduct, writeGuestCart } from '../utils/storage'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user, ready } = useAuth()
  const [cart, setCart] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [images, setImages] = useState(readImages)

  const apply = useCallback(
    (data, { guest = !user } = {}) => {
      setCart(data)
      setStatus('ready')
      setError(null)
      if (guest) writeGuestCart(data?.items || [])
      else clearGuestCart()
      return data
    },
    [user],
  )

  const refresh = useCallback(async () => {
    setStatus((current) => (current === 'ready' ? 'ready' : 'loading'))
    try {
      let data = (await fetchCart()).data
      if (!user) {
        const local = readGuestCart()
        const present = new Set((data.items || []).map((item) => item.product_id))
        const missing = local.filter((item) => !present.has(item.product_id))
        for (const item of missing) {
          try {
            data = (await addCartItem(item.product_id, Math.min(99, item.quantity))).data
          } catch {
            /* Unavailable lines are dropped when the server rejects them. */
          }
        }
      }
      return apply(data)
    } catch (err) {
      setError(err)
      setStatus('error')
      return null
    }
  }, [apply, user])

  useEffect(() => {
    if (!ready) return
    let active = true
    async function sync() {
      if (user && hasGuestCartFlag()) {
        try {
          await mergeCart()
        } catch {
          /* A missing guest cookie is fine. The account cart is used. */
        }
      }
      if (active) await refresh()
    }
    sync()
    return () => {
      active = false
    }
  }, [ready, user, refresh])

  const add = useCallback(
    async (product, quantity = 1) => {
      rememberProduct(product)
      setImages(readImages())
      const data = (await addCartItem(product.id, quantity)).data
      return apply(data)
    },
    [apply],
  )

  const update = useCallback(
    async (itemId, quantity) => {
      const data = (await updateCartItem(itemId, quantity)).data
      return apply(data)
    },
    [apply],
  )

  const remove = useCallback(
    async (itemId) => {
      const data = (await removeCartItem(itemId)).data
      return apply(data)
    },
    [apply],
  )

  const count = (cart?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)

  const value = useMemo(
    () => ({ cart, status, error, images, count, refresh, add, update, remove }),
    [cart, status, error, images, count, refresh, add, update, remove],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
