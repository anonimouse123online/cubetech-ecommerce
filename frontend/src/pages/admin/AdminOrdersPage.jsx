import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '../../api/client'

const labels = { PENDING: 'Pending', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', SHIPPED: 'Shipped', COMPLETED: 'Completed', CANCELLED: 'Cancelled' }
const nextStatuses = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

function php(value) {
  return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    apiGet(`/admin/orders${statusFilter ? `?status=${statusFilter}` : ''}`)
      .then((result) => {
        if (!active) return
        setOrders(result.data)
        setSelected((current) => result.data.find((order) => order.orderNumber === current?.orderNumber) || result.data[0] || null)
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [statusFilter, refreshToken])

  async function openOrder(order) {
    setSelected(order)
    setError('')
    try {
      const result = await apiGet(`/admin/orders/${encodeURIComponent(order.orderNumber)}`)
      setSelected(result.data)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function updateStatus(status) {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      const result = await apiPatch(`/admin/orders/${encodeURIComponent(selected.orderNumber)}/status`, { status })
      setSelected(result.data)
      setOrders((current) => statusFilter && result.data.status !== statusFilter
        ? current.filter((order) => order.orderNumber !== result.data.orderNumber)
        : current.map((order) => order.orderNumber === result.data.orderNumber ? result.data : order))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="admin-page-heading"><div><p className="eyebrow">Customer purchases</p><h1>Orders</h1><p>Review details and move each order through fulfillment.</p></div><select className="admin-heading-select" aria-label="Filter orders by status" value={statusFilter} onChange={(event) => { setLoading(true); setStatusFilter(event.target.value) }}><option value="">All statuses</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></header>
      {error && <div className="admin-alert" role="alert">{error}</div>}
      <div className="admin-order-layout">
        <section className="admin-panel admin-order-list-panel"><div className="admin-panel-heading"><div><p className="eyebrow">Newest first</p><h2>{loading ? 'Loading…' : `${orders.length} orders`}</h2></div><button className="admin-text-button" onClick={() => { setLoading(true); setRefreshToken((value) => value + 1) }}>Refresh</button></div>
          {!loading && orders.length ? <div className="admin-order-list">{orders.map((order) => <button type="button" className={`admin-order-row ${selected?.orderNumber === order.orderNumber ? 'is-selected' : ''}`} key={order.orderNumber} onClick={() => openOrder(order)}><span className="admin-order-row-top"><strong>{order.orderNumber}</strong><span className={`admin-status status-${order.status.toLowerCase()}`}>{labels[order.status]}</span></span><span>{order.customer.name}</span><small>{new Date(order.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })} · {order.items.length} {order.items.length === 1 ? 'item' : 'items'}</small><b>{php(order.total)}</b></button>)}</div> : !loading && <div className="admin-empty">No orders to show.</div>}
        </section>
        <section className="admin-panel admin-order-detail-panel">
          {selected ? <>
            <div className="admin-panel-heading"><div><p className="eyebrow">Order details</p><h2>{selected.orderNumber}</h2></div><span className={`admin-status status-${selected.status.toLowerCase()}`}>{labels[selected.status]}</span></div>
            <p className="admin-order-date">Placed {new Date(selected.createdAt).toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })} · {selected.paymentMethod.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}</p>
            <div className="admin-order-items">{selected.items.map((item) => <div className="admin-order-item" key={item.productId}><div><strong>{item.productName}</strong><small>{php(item.unitPrice)} × {item.quantity}</small></div><b>{php(item.lineTotal)}</b></div>)}</div>
            <div className="admin-order-total"><span>Total</span><strong>{php(selected.total)}</strong></div>
            <div className="admin-order-customer"><p className="eyebrow">Customer</p><strong>{selected.customer.name}</strong><a href={`mailto:${selected.customer.email}`}>{selected.customer.email}</a><a href={`tel:${selected.customer.phone}`}>{selected.customer.phone}</a></div>
            <div className="admin-order-customer"><p className="eyebrow">Delivery address</p><span>{[selected.shippingAddress.line1, selected.shippingAddress.line2, selected.shippingAddress.city, selected.shippingAddress.region, selected.shippingAddress.postalCode, selected.shippingAddress.country].filter(Boolean).join(', ')}</span></div>
            {selected.notes && <div className="admin-order-customer"><p className="eyebrow">Customer note</p><span>{selected.notes}</span></div>}
            {nextStatuses[selected.status]?.length > 0 && <div className="admin-status-actions"><p className="eyebrow">Update status</p><div>{nextStatuses[selected.status].map((status) => <button key={status} className={status === 'CANCELLED' ? 'admin-danger-button' : 'button'} disabled={saving} onClick={() => updateStatus(status)}>{saving ? 'Saving…' : `Mark ${labels[status]}`}</button>)}</div></div>}
            {['COMPLETED', 'CANCELLED'].includes(selected.status) && <p className="admin-final-note">This order is in a final status.</p>}
          </> : <div className="admin-empty">Choose an order to review its details.</div>}
        </section>
      </div>
    </>
  )
}
