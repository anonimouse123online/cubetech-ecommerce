import { useEffect, useState } from 'react'
import { apiPost } from '../api/client'

export default function useCartQuote(items) {
  const signature = JSON.stringify(items.map(({ productId, quantity, product }) => ({
    productId,
    quantity,
    expectedPrice: product.price,
  })))
  const [result, setResult] = useState(null)
  const current = result?.signature === signature ? result : null

  useEffect(() => {
    const controller = new AbortController()
    const cartItems = JSON.parse(signature)
    apiPost('/orders/quote', { items: cartItems }, { signal: controller.signal })
      .then((response) => setResult({ signature, rows: response.data, error: '' }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult({ signature, rows: [], error: error.message })
      })
    return () => controller.abort()
  }, [signature])

  return current || { signature, rows: [], error: '', loading: true }
}
