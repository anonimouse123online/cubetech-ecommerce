import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiPost } from '../../api/client'

export default function AdminLoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await apiPost('/admin/auth/login', form)
      navigate(location.state?.from?.pathname || '/admin', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <Link className="admin-brand login-brand" to="/"><span className="brand-mark">c.</span><span>Cartlane</span></Link>
        <p className="eyebrow">Store administration</p>
        <h1>Welcome back.</h1>
        <p className="admin-login-copy">Sign in to manage the catalog and customer orders.</p>
        <form className="admin-form" onSubmit={submit}>
          <label className="admin-field"><span>Email address</span><input type="email" autoComplete="username" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label className="admin-field"><span>Password</span><input type="password" autoComplete="current-password" required maxLength={200} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button className="button admin-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <Link className="admin-back-link" to="/">← Back to Cartlane</Link>
      </section>
    </main>
  )
}
