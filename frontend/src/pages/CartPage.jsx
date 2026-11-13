import { Link } from 'react-router-dom'
import { useCart } from '../cart/useCart'
import useCartQuote from '../cart/useCartQuote'
import { calculateCartTotals, formatPrice } from '../cart/cart-storage'
import StatePanel from '../components/StatePanel'

function CartQuantity({ item, stock, onUpdate, disabled = false }) {
  const unavailable = disabled || stock < 1
  const reduce = item.quantity > stock ? stock : item.quantity - 1
  return <div className="quantity-stepper" aria-label={`Quantity of ${item.product.name}`}>
    <button type="button" aria-label="Decrease quantity" disabled={unavailable || item.quantity <= 1} onClick={() => onUpdate(reduce, stock)}>−</button>
    <span aria-live="polite">{item.quantity}</span>
    <button type="button" aria-label="Increase quantity" disabled={unavailable || item.quantity >= stock} onClick={() => onUpdate(item.quantity + 1, stock)}>+</button>
  </div>
}

export default function CartPage() {
  const { items, removeItem, updateQuantity, acceptQuote } = useCart()
  const quote = useCartQuote(items)
  const quoteById = new Map(quote.rows.map((row) => [row.productId, row]))
  const totals = calculateCartTotals(items, quote.rows)
  const priceChanged = quote.rows.some((row) => row.priceChanged)
  const unavailable = quote.rows.some((row) => !row.available)
  const stockProblems = quote.rows.filter((row) => row.available && !row.quantityAvailable)
  const reviewNeeded = priceChanged || unavailable || stockProblems.length > 0

  if (!items.length) {
    return <div className="container"><StatePanel title="Your bag is taking a break">Add a few thoughtful finds and they’ll be here when you’re ready.<br /><Link className="text-link" to="/products">Explore the collection ↗</Link></StatePanel></div>
  }

  return (
    <div className="container commerce-page">
      <header className="page-heading">
        <p className="eyebrow">Your Cartlane bag</p>
        <h1>Your bag</h1>
      </header>
      {quote.loading ? <p className="commerce-notice">Checking current prices and availability…</p> : null}
      {quote.error ? <p className="commerce-alert" role="alert">We couldn’t check the live catalog: {quote.error}</p> : null}
      {reviewNeeded && !quote.loading && !quote.error ? (
        <div className="commerce-alert" role="alert">
          <strong>Your cart needs a quick review.</strong>
          {priceChanged && <p>One or more prices changed. The current prices are shown below.</p>}
          {unavailable && <p>An item is no longer available. Remove it to continue.</p>}
          {stockProblems.length > 0 && <p>Update quantities to match the stock shown below.</p>}
          {priceChanged && !unavailable && stockProblems.length === 0 && (
            <button className="text-button" type="button" onClick={() => acceptQuote(quote.rows)}>I’ve reviewed the updated prices</button>
          )}
        </div>
      ) : null}

      <div className="cart-layout">
        <section className="cart-lines" aria-label="Items in your bag">
          {totals.lines.map((line) => {
            const current = quoteById.get(line.productId)
            const product = current?.product || line.product
            const stock = current?.available ? current.product.stock : line.product.stock
            return (
              <article className="cart-line" key={line.productId}>
                <Link to={`/products/${line.productId}`} className="cart-thumb"><img src={product.imageUrl} alt={product.name} /></Link>
                <div className="cart-line-main">
                  <p className="product-category">{product.category?.name || 'Cartlane find'}</p>
                  <h2><Link to={`/products/${line.productId}`}>{product.name}</Link></h2>
                  <p className="cart-unit-price">{formatPrice(line.unitPrice)} each</p>
                  {current?.priceChanged && <p className="cart-change">Previously {formatPrice(line.product.price)} · now {formatPrice(current.currentPrice)}</p>}
                  {!current?.available && <p className="cart-change">No longer available</p>}
                  {current?.available && !current.quantityAvailable && <p className="cart-change">Only {current.product.stock} available now</p>}
                  <div className="cart-line-controls">
                    <label>Qty
                      <CartQuantity item={line} stock={stock} onUpdate={(quantity, currentStock) => updateQuantity(line.productId, quantity, currentStock)} disabled={!current?.available} />
                    </label>
                    <button className="text-button" type="button" onClick={() => removeItem(line.productId)}>Remove</button>
                  </div>
                </div>
                <p className="cart-line-total">{formatPrice(line.lineTotal)}</p>
              </article>
            )
          })}
        </section>

        <aside className="summary-card">
          <p className="eyebrow">Order summary</p>
          <div className="summary-row"><span>Subtotal</span><strong>{formatPrice(totals.subtotal)}</strong></div>
          <div className="summary-row"><span>Delivery</span><strong>Free</strong></div>
          <div className="summary-row summary-total"><span>Total</span><strong>{formatPrice(totals.total)}</strong></div>
          <Link className={`button summary-button ${reviewNeeded || quote.loading || quote.error ? 'is-disabled' : ''}`} aria-disabled={reviewNeeded || quote.loading || Boolean(quote.error)} to="/checkout" onClick={(event) => {
            if (reviewNeeded || quote.loading || quote.error) event.preventDefault()
          }}>Continue to checkout <span className="button-arrow">↗</span></Link>
          <Link className="text-link summary-back" to="/products">Continue shopping</Link>
          <p className="summary-footnote">Prices and stock are checked again when you place your order.</p>
        </aside>
      </div>
    </div>
  )
}
