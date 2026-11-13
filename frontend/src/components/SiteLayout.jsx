import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useCart } from '../cart/useCart'

function BagIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 8h14l1 12H4L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>
}

function MenuIcon({ open }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={open ? 'm6 6 12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} /></svg>
}

export default function SiteLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { itemCount } = useCart()
  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <div className="announcement">A little more thoughtful tech, delivered with care · Free demo delivery on every order</div>
      <header className="site-header">
        <div className="header-inner">
          <button className="icon-button menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>
            <MenuIcon open={menuOpen} />
          </button>
          <Link to="/" className="brand" aria-label="Cartlane home" onClick={closeMenu}>
            <span className="brand-mark">c.</span><span>cartlane</span>
          </Link>
          <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
            <NavLink to="/products" onClick={closeMenu}>Shop all</NavLink>
            <a href="/#categories" onClick={closeMenu}>Categories</a>
            <NavLink to="/admin/login" onClick={closeMenu}>For the team</NavLink>
          </nav>
          <div className="header-actions">
            <Link to="/cart" className="icon-button bag-button" aria-label={`Open your bag${itemCount ? `, ${itemCount} items` : ''}`}><BagIcon />{itemCount > 0 && <span className="bag-count">{itemCount}</span>}</Link>
          </div>
        </div>
      </header>
      <main className="page-shell" key={location.pathname}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Link to="/" className="brand"><span className="brand-mark">c.</span><span>cartlane</span></Link>
          <p className="footer-copy">A considered collection of everyday tech. © 2026 Cartlane.</p>
          <div className="footer-links"><Link to="/products">Shop</Link><Link to="/admin/login">Store team</Link><span>Fictional demo contact: <a href="mailto:hello@cartlane.example">hello@cartlane.example</a> · <a href="tel:+63255500100">+63 2 5550 0100</a></span></div>
        </div>
      </footer>
    </>
  )
}
