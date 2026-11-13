import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../api/client'

const cards = [
  ['totalProducts', 'Total products', 'Including inactive listings'],
  ['totalOrders', 'Total orders', 'Including cancelled orders'],
  ['pendingOrders', 'Pending orders', 'Awaiting confirmation'],
  ['completedOrders', 'Completed orders', 'Successfully delivered'],
  ['totalCustomers', 'Total customers', 'Unique checkout emails'],
  ['totalSales', 'Total sales', 'Completed orders only'],
]

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/admin/dashboard').then((result) => setStats(result.data)).catch((requestError) => setError(requestError.message))
  }, [])

  return (
    <>
      <header className="admin-page-heading"><div><p className="eyebrow">Store overview</p><h1>Dashboard</h1><p>Here’s how Cartlane is doing today.</p></div><Link className="button admin-heading-button" to="/admin/orders">Review orders</Link></header>
      {error && <div className="admin-alert" role="alert">{error}</div>}
      <section className="admin-stat-grid" aria-label="Store statistics">
        {cards.map(([key, label, hint]) => <article className="admin-stat-card" key={key}><span>{label}</span><strong>{stats ? key === 'totalSales' ? `₱${Number(stats[key]).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : stats[key].toLocaleString('en-PH') : '—'}</strong><small>{hint}</small></article>)}
      </section>
      <section className="admin-quick-links"><div><p className="eyebrow">Quick actions</p><h2>Keep the store moving.</h2></div><div className="admin-action-links"><Link to="/admin/products">Manage products <span>→</span></Link><Link to="/admin/categories">Organize categories <span>→</span></Link><Link to="/admin/customers">View customers <span>→</span></Link></div></section>
    </>
  )
}
