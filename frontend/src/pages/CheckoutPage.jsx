import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, apiPost } from '../api/client'
import { useCart } from '../cart/useCart'
import useCartQuote from '../cart/useCartQuote'
import { calculateCartTotals, formatPrice } from '../cart/cart-storage'
import StatePanel from '../components/StatePanel'

const CHECKOUT_KEY = 'cartlane.checkout.idempotency.v1'

function getCheckoutKey(fallbackRef) {
  try {
    const saved = globalThis.sessionStorage.getItem(CHECKOUT_KEY)
    if (saved) return saved
    const created = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    globalThis.sessionStorage.setItem(CHECKOUT_KEY, created)
    return created
  } catch {
    fallbackRef.current ||= globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    return fallbackRef.current
  }
}

export default function CheckoutPage() {
  const { items, clearCart } = useCart()
  const quote = useCartQuote(items)
  const navigate = useNavigate()
  const fallbackKey = useRef(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [reviewChanges, setReviewChanges] = useState([])
  const quoteById = new Map(quote.rows.map((row) => [row.productId, row]))
  const totals = calculateCartTotals(items, quote.rows)
  const cartNeedsReview = quote.rows.some((row) => !row.available || row.priceChanged || !row.quantityAvailable)
  const canSubmit = items.length > 0 && !quote.loading && !quote.error && !cartNeedsReview && !submitting && reviewChanges.length === 0

  if (!items.length) {
    return <div className="container"><StatePanel title="Your bag is empty">Add a product before starting checkout.<br /><Link className="text-link" to="/products">Browse the collection ↗</Link></StatePanel></div>
  }

  async function submitOrder(event) {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError('')
    const form = new FormData(event.currentTarget)
    const customer = {
      name: form.get('name'),
      email: form.get('email'),
      phone: form.get('phone'),
    }
    const shippingAddress = {
      line1: form.get('line1'),
      line2: form.get('line2'),
      city: form.get('city'),
      region: form.get('region'),
      postalCode: form.get('postalCode'),
      country: form.get('country') || 'Philippines',
    }
    const paymentMethod = form.get('paymentMethod')
    const notes = form.get('notes')
    const orderItems = items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      expectedPrice: quoteById.get(item.productId)?.currentPrice || item.product.price,
    }))

    try {
      const result = await apiPost('/orders', {
        idempotencyKey: getCheckoutKey(fallbackKey),
        items: orderItems,
        customer,
        shippingAddress,
        paymentMethod,
        notes,
      })
      clearCart()
      try { globalThis.sessionStorage.removeItem(CHECKOUT_KEY) } catch { /* Optional browser storage. */ }
      navigate(`/order-confirmation/${encodeURIComponent(result.data.orderNumber)}`)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CART_REVIEW_REQUIRED') {
        setReviewChanges(error.details?.items || [])
        setSubmitError('A price or stock value changed while you were checking out. Review your cart before trying again.')
      } else {
        setSubmitError(error.message || 'We could not place the order. Your cart is still saved.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container commerce-page">
      <header className="page-heading">
        <p className="eyebrow">Almost yours</p>
        <h1>Checkout</h1>
      </header>
      {quote.loading && <p className="commerce-notice">Checking current prices and stock…</p>}
      {quote.error && <p className="commerce-alert" role="alert">We couldn’t verify your cart: {quote.error}</p>}
      {cartNeedsReview && !quote.loading && !quote.error && (
        <div className="commerce-alert" role="alert">
          <strong>Your cart needs another review.</strong>
          <p>Price, availability, or stock changed. Review the latest values before placing your order.</p>
          <Link className="text-link" to="/cart">Review cart changes ↗</Link>
        </div>
      )}
      {submitError && <div className="commerce-alert" role="alert">{submitError}{reviewChanges.length > 0 && <p><Link className="text-link" to="/cart">Review current cart ↗</Link></p>}</div>}

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={submitOrder}>
          <section className="form-section">
            <p className="eyebrow">01 · Your details</p>
            <div className="form-grid">
              <label className="form-field">Full name<input name="name" autoComplete="name" minLength="2" maxLength="100" required /></label>
              <label className="form-field">Email address<input name="email" type="email" autoComplete="email" maxLength="254" required /></label>
              <label className="form-field">Contact number<input name="phone" type="tel" autoComplete="tel" inputMode="tel" minLength="7" maxLength="30" pattern="\+?[0-9][0-9\s().-]{5,28}" required /></label>
            </div>
          </section>

          <section className="form-section">
            <p className="eyebrow">02 · Delivery address</p>
            <div className="form-grid">
              <label className="form-field form-field-wide">Address line 1<input name="line1" autoComplete="address-line1" minLength="5" maxLength="180" required /></label>
              <label className="form-field form-field-wide">Address line 2 <span>(optional)</span><input name="line2" autoComplete="address-line2" maxLength="180" /></label>
              <label className="form-field">City<input name="city" autoComplete="address-level2" minLength="2" maxLength="80" required /></label>
              <label className="form-field">Region / province<input name="region" autoComplete="address-level1" minLength="2" maxLength="80" required /></label>
              <label className="form-field">Postal code<input name="postalCode" autoComplete="postal-code" minLength="2" maxLength="20" required /></label>
              <label className="form-field">Country<input name="country" autoComplete="country-name" defaultValue="Philippines" maxLength="80" required /></label>
            </div>
          </section>

          <section className="form-section">
            <p className="eyebrow">03 · Demo payment method</p>
            <label className="form-field">Choose how you’ll pay
              <select name="paymentMethod" defaultValue="" required>
                <option value="" disabled>Select a payment method</option>
                <option value="CASH_ON_DELIVERY">Cash on Delivery</option>
                <option value="E_WALLET">E-Wallet</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </label>
            <p className="form-help">These are demo selections only. No payment will be collected online.</p>
            <label className="form-field notes-field">Order notes <span>(optional)</span><textarea name="notes" rows="3" maxLength="500" placeholder="Anything we should know about delivery?" /></label>
          </section>
          <button className="button checkout-submit" type="submit" disabled={!canSubmit}>{submitting ? 'Placing your order…' : 'Place order'}</button>
          <p className="checkout-privacy">Your cart is only cleared after we confirm that the order was saved.</p>
        </form>

        <aside className="summary-card checkout-summary">
          <p className="eyebrow">Order review</p>
          <div className="checkout-review-list">
            {items.map((item) => {
              const row = quoteById.get(item.productId)
              const product = row?.product || item.product
              const price = row?.currentPrice || item.product.price
              return <div className="checkout-review-item" key={item.productId}>
                <img src={product.imageUrl} alt="" />
                <div><strong>{product.name}</strong><span>Qty {item.quantity} · {formatPrice(price)} each</span></div>
                <b>{formatPrice(calculateCartTotals([item], [row].filter(Boolean)).total)}</b>
              </div>
            })}
          </div>
          <div className="summary-row"><span>Subtotal</span><strong>{formatPrice(totals.subtotal)}</strong></div>
          <div className="summary-row"><span>Delivery</span><strong>Free</strong></div>
          <div className="summary-row summary-total"><span>Grand total</span><strong>{formatPrice(totals.total)}</strong></div>
          <Link className="text-link summary-back" to="/cart">Back to cart</Link>
        </aside>
      </div>
    </div>
  )
}
