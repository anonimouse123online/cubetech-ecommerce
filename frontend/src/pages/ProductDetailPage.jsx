import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiGet, formatPrice } from '../api/client'
import { useCart } from '../cart/useCart'
import ProductCard from '../components/ProductCard'
import StatePanel from '../components/StatePanel'

export default function ProductDetailPage() {
  const { id } = useParams()
  const { addItem } = useCart()
  const [result, setResult] = useState(null)
  const [quantity, setQuantity] = useState('1')
  const [cartMessage, setCartMessage] = useState('')
  const isCurrent = result?.id === id
  const loading = !isCurrent
  const product = isCurrent ? result.product : null
  const error = isCurrent ? result.error : ''

  useEffect(() => {
    const controller = new AbortController()
    apiGet(`/products/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((response) => setResult({ id, product: response.data, error: '' }))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setResult({ id, product: null, error: requestError.message })
      })
    return () => controller.abort()
  }, [id])

  if (loading) return <div className="container"><StatePanel title="Opening the details…">Just a moment.</StatePanel></div>
  if (error || !product) return <div className="container"><StatePanel title="We couldn't find that piece" error>{error || 'This product may have moved.'}<br /><Link className="text-link" to="/products">Back to the collection ↗</Link></StatePanel></div>

  function addProductToCart() {
    const count = Number(quantity)
    const result = addItem(product, count)
    setCartMessage(result.ok ? `${count} ${count === 1 ? 'piece' : 'pieces'} added to your bag.` : result.error)
  }

  return (
    <>
      <div className="container detail-layout">
        <div><img className="detail-image" src={product.imageUrl} alt={product.name} /></div>
        <article className="detail-info">
          <p className="breadcrumbs"><Link to="/">Home</Link> &nbsp;/&nbsp; <Link to="/products">Shop all</Link> &nbsp;/&nbsp; {product.category.name}</p>
          <p className="eyebrow">{product.category.name}</p>
          <h1>{product.name}</h1>
          <p className="detail-price">{formatPrice(product.price)}</p>
          <div className="detail-rule" />
          <p className="detail-description">{product.description}</p>
          <p className={`availability ${product.stock < 1 ? 'out' : ''}`}><span className="availability-dot" />{product.stock > 0 ? `In stock · ${product.stock} available` : 'Currently out of stock'}</p>
          <div className="buy-controls">
            <label>Quantity<input aria-label="Quantity" type="number" min="1" max={Math.max(product.stock, 1)} step="1" value={quantity} disabled={product.stock < 1} onChange={(event) => setQuantity(event.target.value)} /></label>
            <button className="button" type="button" disabled={product.stock < 1 || !Number.isSafeInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > product.stock} onClick={addProductToCart}>
              {product.stock < 1 ? 'Out of stock' : 'Add to bag'} <span className="button-arrow">↗</span>
            </button>
          </div>
          {cartMessage && <p className="cart-feedback" role="status">{cartMessage} {cartMessage.includes('added') && <Link to="/cart">View bag ↗</Link>}</p>}
          <p className="detail-note">Stock and price are checked again when you place your order.</p>
        </article>
      </div>
      {product.relatedProducts?.length > 0 && <section className="featured-section related-section"><div className="container"><div className="section-heading"><div><p className="eyebrow">More in {product.category.name}</p><h2>Related finds</h2></div><Link className="text-link" to="/products">Browse all ↗</Link></div><div className="product-grid related-grid">{product.relatedProducts.slice(0, 3).map((related) => <ProductCard product={related} key={related.id} />)}</div></div></section>}
    </>
  )
}
