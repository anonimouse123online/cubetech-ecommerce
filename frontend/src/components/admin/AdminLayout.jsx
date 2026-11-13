import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom'
import { apiPost } from '../../api/client'

const links = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/customers', label: 'Customers' },
]

export default function AdminLayout() {
  const { admin } = useOutletContext()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  async function logout() {
    try {
      await apiPost('/admin/auth/logout', {})
      navigate('/admin/login', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="admin-app">
      <header className="admin-header">
        <Link className="admin-brand" to="/admin"><span className="brand-mark">c.</span><span>Cartlane <small>ADMIN</small></span></Link>
        <div className="admin-user"><span>{admin.displayName}</span><button className="admin-logout" onClick={logout}>Log out</button></div>
      </header>
      <nav className="admin-nav" aria-label="Admin sections">
        {links.map((link) => <NavLink key={link.to} to={link.to} end={link.end}>{link.label}</NavLink>)}
        <Link className="admin-store-link" to="/">View store ↗</Link>
      </nav>
      {error && <div className="admin-global-error" role="alert">{error}</div>}
      <main className="admin-main"><Outlet /></main>
      <footer className="admin-footer">Cartlane store administration <span>Demo workspace</span></footer>
    </div>
  )
}
