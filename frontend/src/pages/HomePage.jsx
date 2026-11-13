import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api/client'
import ProductCard from '../components/ProductCard'
import StatePanel from '../components/StatePanel'

const categoryMarks = ['01', '02', '03']

export default function HomePage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([apiGet('/products?sort=price-desc', { signal: controller.signal }), apiGet('/categories', { signal: controller.signal })])
      .then(([productResult, categoryResult]) => {
        setProducts(productResult.data.slice(0, 4))
        setCategories(categoryResult.data)
        setError('')
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return (
    <>
      <section className="container hero">
        <div className="hero-copy">
          <p className="eyebrow">Technology for everyday rituals</p>
          <h1>Good things, thoughtfully chosen.</h1>
          <p>Useful little upgrades for your desk, your commute, and the quiet moments in between.</p>
          <Link className="button" to="/products">Explore the collection <span className="button-arrow">↗</span></Link>
        </div>
        <div className="hero-art">
          <img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1300&q=90" alt="Warm, thoughtfully arranged desk with a laptop and plants" />
          <span className="hero-note">Small details. Better days.</span>
        </div>
      </section>

      <section className="container category-section" id="categories">
        <div className="section-heading">
          <div><p className="eyebrow">Find your everyday</p><h2>Shop by category</h2><p>Useful things for the places you spend your time.</p></div>
          <Link className="text-link" to="/products">Browse all products ↗</Link>
        </div>
        <div className="category-grid">
          {categories.map((category, index) => (
            <Link className="category-tile" to={`/products?category=${category.slug}`} key={category.id}>
              <span className="category-no">{categoryMarks[index] || `0${index + 1}`}</span>
              <strong>{category.name}</strong>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
          {!loading && !categories.length && !error && <p className="result-count">Categories are on their way.</p>}
        </div>
      </section>

      <section className="featured-section">
        <div className="container">
          <div className="section-heading">
            <div><p className="eyebrow">Good things, in stock</p><h2>Little upgrades</h2><p>A few favorites to make the everyday feel a bit better.</p></div>
            <Link className="text-link" to="/products">See everything ↗</Link>
          </div>
          {loading ? <StatePanel title="Finding the good stuff…">A moment while we load the collection.</StatePanel>
            : error ? <StatePanel title="The collection is taking a breather" error>{error}</StatePanel>
              : products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
                : <StatePanel title="More good things soon">There are no products to show just yet.</StatePanel>}
        </div>
      </section>

      <section className="container service-strip" aria-label="Our promises">
        <div className="service-item"><strong>Chosen with care</strong><span>Thoughtful, useful pieces that earn their place.</span></div>
        <div className="service-item"><strong>Easy everyday value</strong><span>Quality finds at prices that feel right.</span></div>
        <div className="service-item"><strong>Here when you need us</strong><span>Friendly help from our small local team.</span></div>
      </section>
    </>
  )
}
