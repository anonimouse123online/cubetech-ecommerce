import { useEffect, useState } from 'react'
import { apiGet } from '../../api/client'

function php(value) {
  return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/admin/customers')
      .then((result) => setCustomers(result.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <header className="admin-page-heading"><div><p className="eyebrow">Guest checkout contacts</p><h1>Customers</h1><p>Read-only summaries grouped by normalized email address.</p></div></header>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="eyebrow">Customer list</p><h2>{loading ? 'Loading…' : `${customers.length} customers`}</h2></div></div>
        {error && <div className="admin-alert" role="alert">{error}</div>}
        {!loading && customers.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Contact</th><th>Orders</th><th>Completed-order value</th><th>Latest order</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.email.toLowerCase()}><td><strong>{customer.name}</strong></td><td><a href={`mailto:${customer.email}`}>{customer.email}</a><small className="admin-table-secondary">{customer.phone}</small></td><td>{customer.orderCount}</td><td>{php(customer.completedOrderValue)}</td><td>{new Date(customer.latestOrderAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}</td></tr>)}</tbody></table></div> : !loading && !error && <div className="admin-empty">Customer summaries will appear after checkout orders are placed.</div>}
      </section>
    </>
  )
}
