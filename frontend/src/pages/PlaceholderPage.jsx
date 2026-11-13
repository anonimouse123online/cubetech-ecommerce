import { Link } from 'react-router-dom'

export default function PlaceholderPage({ title, eyebrow }) {
  const copy = title === 'Your bag'
    ? 'Your saved finds will live here once shopping cart features are ready.'
    : title === 'Admin sign in'
      ? 'Store team tools are coming later. The public catalog is ready to explore.'
      : title === 'Store dashboard'
        ? 'Product and order management will arrive in a future phase.'
        : 'This store area is not available yet. For now, have a look around the collection.'

  return (
    <div className="container">
      <section className="placeholder-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{copy}</p>
        <Link className="button" to="/products">Back to the collection <span className="button-arrow">↗</span></Link>
      </section>
    </div>
  )
}
