import { useEffect, useMemo, useState } from 'react'
import {
  acceptQuotedProducts,
  CART_STORAGE_KEY,
  mergeCartItem,
  readCart,
  updateCartQuantity,
  writeCart,
} from './cart-storage'
import { CartContext } from './cart-context'

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => readCart())

  useEffect(() => {
    try {
      writeCart(globalThis.localStorage, items)
    } catch {
      // Keep the in-memory cart usable when browser storage is unavailable.
    }
  }, [items])

  const actions = useMemo(() => ({
    addItem(product, quantity) {
      try {
        setItems(mergeCartItem(items, product, quantity))
        return { ok: true }
      } catch (error) {
        return { ok: false, error: error.message }
      }
    },
    updateQuantity(productId, quantity, stockLimit) {
      try {
        setItems(updateCartQuantity(items, productId, quantity, stockLimit))
        return { ok: true }
      } catch (error) {
        return { ok: false, error: error.message }
      }
    },
    removeItem(productId) {
      setItems((current) => current.filter((item) => item.productId !== productId))
    },
    acceptQuote(quoteRows) {
      setItems((current) => acceptQuotedProducts(current, quoteRows))
    },
    clearCart() {
      try {
        globalThis.localStorage?.removeItem(CART_STORAGE_KEY)
      } catch {
        // Storage may be disabled; the empty in-memory cart still takes effect.
      }
      setItems([])
    },
  }), [items])

  const value = useMemo(() => ({
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    ...actions,
  }), [actions, items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
