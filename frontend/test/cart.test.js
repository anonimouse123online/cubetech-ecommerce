import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CART_STORAGE_KEY,
  calculateCartTotals,
  mergeCartItem,
  readCart,
  updateCartQuantity,
  writeCart,
} from '../src/cart/cart-storage.js'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, value) }
  removeItem(key) { this.values.delete(key) }
}

const a = { id: 'p-a', name: 'Aster Hub', price: '100.25', stock: 8, isActive: true, imageUrl: '/a.png', category: { name: 'Desk', slug: 'desk' } }
const b = { id: 'p-b', name: 'Morrow Speaker', price: '125.00', stock: 4, isActive: true, imageUrl: '/b.png', category: { name: 'Sound', slug: 'sound' } }

test('cart persists through storage and merges duplicate product lines', () => {
  const storage = new MemoryStorage()
  const cart = [
    { productId: a.id, quantity: 1, product: a },
    { productId: a.id, quantity: 2, product: a },
  ]
  writeCart(storage, cart)
  const restored = readCart(storage)
  assert.equal(storage.getItem(CART_STORAGE_KEY) !== null, true)
  assert.equal(restored.length, 1)
  assert.equal(restored[0].quantity, 3)
  assert.equal(restored[0].product.price, '100.25')
})

test('adding duplicate products merges quantities and enforces active stock', () => {
  let cart = mergeCartItem([], a, 2)
  cart = mergeCartItem(cart, a, 3)
  assert.equal(cart.length, 1)
  assert.equal(cart[0].quantity, 5)
  assert.throws(() => mergeCartItem(cart, a, 4), /Only 8 are available/)
  assert.throws(() => mergeCartItem([], { ...a, stock: 0 }, 1), /out of stock/i)
  assert.throws(() => mergeCartItem([], { ...a, isActive: false }, 1), /no longer available/i)
})

test('quantity updates require positive whole numbers within stock', () => {
  const cart = mergeCartItem([], a, 2)
  assert.equal(updateCartQuantity(cart, a.id, 4, 4)[0].quantity, 4)
  assert.throws(() => updateCartQuantity(cart, a.id, 4, 3), /Only 3 are available/)
  assert.throws(() => updateCartQuantity(cart, a.id, 0), /positive whole number/)
})

test('subtotal uses exact centavos and totals PHP 325.50', () => {
  const cart = [
    ...mergeCartItem([], a, 2),
    ...mergeCartItem([], b, 1),
  ]
  const totals = calculateCartTotals(cart)
  assert.equal(totals.subtotal, '325.50')
  assert.equal(totals.total, '325.50')
  assert.deepEqual(totals.lines.map((line) => line.lineTotal), ['200.50', '125.00'])
})
