import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiGet } from '../api/client'
import { formatPrice } from '../cart/cart-storage'
import StatePanel from '../components/StatePanel'

const PAYMENT_LABELS = {
  CASH_ON_DELIVERY: 'Cash on Delivery',
  E_WALLET: 'E-Wallet',
  BANK_TRANSFER: 'Bank Transfer',
}

export default function OrderConfirmationPage() {
  const { orderNumber } = useParams()
  const [result, setResult] = useState(null)
  const isCurrent = result?.orderNumber === orderNumber
  const order = isCurrent ? result.order : null
  const error = isCurrent ? result.error : ''

  useEffect(() => {
    const controller = new AbortController()
    apiGet(`/orders/${encodeURIComponent(orderNumber)}`, { signal: controller.signal })
      .then((response) => setResult({ orderNumber, order: response.data, error: '' }))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setResult({ orderNumber, order: null, error: requestError.message })
      })
    return () => controller.abort()
  }, [orderNumber])

  if (!isCurrent) return <div className="container"><StatePanel title="Saving your confirmation…">Fetching the order record.</StatePanel></div>
  if (error || !order) return <div className="container"><StatePanel title="We couldn’t find this order" error>{error}<br /><Link className="text-link" to="/products">Back to the collection ↗</Link></StatePanel></div>

  return (
    <div className="container commerce-page">
      <section className="confirmation-heading">
        <div className="confirmation-check" aria-hidden="true">✓</div>
        <p className="eyebrow">Order received</p>
        <h1>Thanks, {order.customer.name.split(' ')[0]}.</h1>
        <p>Your order is saved and waiting for the Cartlane team.</p>
      </section>
      <div className="confirmation-card">
        <div className="confirmation-topline">
          <div><p className="eyebrow">Order number</p><h2>{order.orderNumber}</h2></div>
          <span className="status-pill">{order.status === 'PENDING' ? 'Pending' : order.status}</span>
        </div>
        <div className="confirmation-items">
          {order.items.map((item) => <div className="confirmation-item" key={item.productId}>
            <span>{item.productName} <small>× {item.quantity}</small></span>
            <strong>{formatPrice(item.lineTotal)}</strong>
          </div>)}
        </div>
        <div className="summary-row"><span>Subtotal</span><strong>{formatPrice(order.subtotal)}</strong></div>
        <div className="summary-row"><span>Delivery</span><strong>{order.shippingFee === '0.00' ? 'Free' : formatPrice(order.shippingFee)}</strong></div>
        <div className="summary-row summary-total"><span>Total</span><strong>{formatPrice(order.total)}</strong></div>
        <div className="confirmation-details">
          <section><p className="eyebrow">Customer</p><strong>{order.customer.name}</strong><span>{order.customer.email}</span><span>{order.customer.phone}</span></section>
          <section><p className="eyebrow">Deliver to</p><strong>{order.shippingAddress.line1}</strong>{order.shippingAddress.line2 && <span>{order.shippingAddress.line2}</span>}<span>{order.shippingAddress.city}, {order.shippingAddress.region} {order.shippingAddress.postalCode}</span><span>{order.shippingAddress.country}</span></section>
          <section><p className="eyebrow">Payment method</p><strong>{PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</strong><span>Payment is not collected by this demo.</span></section>
        </div>
        {order.notes && <p className="confirmation-note"><strong>Your note:</strong> {order.notes}</p>}
      </div>
      <div className="confirmation-actions"><Link className="button" to="/products">Continue shopping <span className="button-arrow">↗</span></Link></div>
    </div>
  )
}
