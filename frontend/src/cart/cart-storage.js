export const CART_STORAGE_KEY = 'cartlane.cart.v1'

export function normalizePrice(value) {
  const text = String(value)
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text)
  if (!match) return null
  return `${match[1]}.${(match[2] || '').padEnd(2, '0')}`
}

export function priceToCents(value) {
  const normalized = normalizePrice(value)
  if (normalized === null) throw new TypeError('Price must be a decimal string.')
  const [whole, fraction] = normalized.split('.')
  return BigInt(whole) * 100n + BigInt(fraction)
}

export function centsToPrice(cents) {
  const value = BigInt(cents)
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`
}

export function formatPrice(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function snapshotProduct(product) {
  return {
    id: product.id,
    name: String(product.name || 'Product'),
    price: normalizePrice(product.price) || '0.00',
    imageUrl: String(product.imageUrl || ''),
    stock: Number.isSafeInteger(product.stock) && product.stock >= 0 ? product.stock : 0,
    isActive: product.isActive !== false,
    category: product.category ? {
      id: product.category.id,
      name: String(product.category.name || ''),
      slug: String(product.category.slug || ''),
    } : null,
  }
}

export function sanitizeCart(rawItems) {
  if (!Array.isArray(rawItems)) return []
  const merged = new Map()
  for (const raw of rawItems) {
    const product = raw?.product && typeof raw.product === 'object' ? snapshotProduct(raw.product) : null
    const productId = String(raw?.productId || product?.id || '')
    const quantity = raw?.quantity
    if (!product || product.id !== productId || !Number.isSafeInteger(quantity) || quantity < 1) continue

    const prior = merged.get(productId)
    const combined = (prior?.quantity || 0) + quantity
    if (combined > 2147483647) continue
    merged.set(productId, { productId, quantity: combined, product })
  }
  return [...merged.values()]
}

export function readCart(storage) {
  if (storage === undefined) {
    try {
      storage = globalThis.localStorage
    } catch {
      return []
    }
  }
  if (!storage) return []
  try {
    return sanitizeCart(JSON.parse(storage.getItem(CART_STORAGE_KEY) || '[]'))
  } catch {
    return []
  }
}

export function writeCart(storage, items) {
  if (!storage) return
  storage.setItem(CART_STORAGE_KEY, JSON.stringify(sanitizeCart(items)))
}

export function mergeCartItem(items, product, quantity) {
  if (!product?.id || product.isActive === false) throw new Error('This product is no longer available.')
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Choose a positive whole-number quantity.')
  if (product.stock < 1) throw new Error('This product is out of stock.')

  const current = sanitizeCart(items)
  const existing = current.find((item) => item.productId === product.id)
  const nextQuantity = (existing?.quantity || 0) + quantity
  if (nextQuantity > product.stock) throw new Error(`Only ${product.stock} are available.`)

  const savedProduct = snapshotProduct(product)
  return [
    ...current.filter((item) => item.productId !== product.id),
    { productId: product.id, quantity: nextQuantity, product: savedProduct },
  ]
}

export function updateCartQuantity(items, productId, quantity, stockLimit) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Quantity must be a positive whole number.')
  return sanitizeCart(items).map((item) => {
    if (item.productId !== productId) return item
    const stock = Number.isSafeInteger(stockLimit) && stockLimit >= 0 ? stockLimit : item.product.stock
    if (quantity > stock) throw new Error(`Only ${stock} are available.`)
    return { ...item, quantity, product: { ...item.product, stock } }
  })
}

export function acceptQuotedProducts(items, quoteRows) {
  const quoteById = new Map(quoteRows.filter((row) => row.available && row.product).map((row) => [row.productId, row.product]))
  return sanitizeCart(items).map((item) => {
    const latest = quoteById.get(item.productId)
    return latest ? { ...item, product: snapshotProduct(latest) } : item
  })
}

export function calculateCartTotals(items, quoteRows = []) {
  const quotedPriceById = new Map(quoteRows
    .filter((row) => row.available && row.product)
    .map((row) => [row.productId, row.product.price]))
  let subtotalCents = 0n
  const lines = sanitizeCart(items).map((item) => {
    const unitPrice = normalizePrice(quotedPriceById.get(item.productId) || item.product.price) || '0.00'
    const lineTotal = centsToPrice(priceToCents(unitPrice) * BigInt(item.quantity))
    subtotalCents += priceToCents(lineTotal)
    return { ...item, unitPrice, lineTotal }
  })
  const subtotal = centsToPrice(subtotalCents)
  return { lines, subtotal, shippingFee: '0.00', total: subtotal }
}
