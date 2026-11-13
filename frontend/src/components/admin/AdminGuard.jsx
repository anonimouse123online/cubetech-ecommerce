import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { apiGet } from '../../api/client'

export default function AdminGuard() {
  const location = useLocation()
  const [state, setState] = useState({ status: 'checking', admin: null, error: '' })

  useEffect(() => {
    let active = true
    apiGet('/admin/auth/me')
      .then((result) => active && setState({ status: 'authenticated', admin: result.data, error: '' }))
      .catch((error) => {
        if (!active) return
        if (error.status === 401) setState({ status: 'unauthenticated', admin: null, error: '' })
        else setState({ status: 'error', admin: null, error: error.message })
      })
    return () => { active = false }
  }, [])

  if (state.status === 'checking') return <div className="admin-loading">Checking admin session…</div>
  if (state.status === 'unauthenticated') return <Navigate to="/admin/login" replace state={{ from: location }} />
  if (state.status === 'error') return <main className="admin-login-page"><section className="admin-login-card"><p className="eyebrow">Store admin</p><h1>Dashboard unavailable</h1><p>{state.error}</p><button className="button" onClick={() => window.location.reload()}>Try again</button></section></main>
  return <Outlet context={{ admin: state.admin }} />
}
