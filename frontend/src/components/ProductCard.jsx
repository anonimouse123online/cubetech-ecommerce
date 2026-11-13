import { Link } from 'react-router-dom'
import { formatPrice } from '../api/client'

export default function ProductCard({ product }) {
  const soldOut = product.stock < 1

  return (
    <article className="product-card">
      <Link to={`/products/${product.id}`} aria-label={`View ${product.name}`}>
        <div className="product-image-wrap">
          <img className="product-image" src={product.imageUrl} alt={product.name} loading="lazy" />
          <span className="product-tag">{soldOut ? 'Sold out' : product.stock <= 3 ? `Only ${product.stock} left` : 'In stock'}</span>
        </div>
      </Link>
      <div className="product-info">
        <div>
          <p className="product-category">{product.category?.name}</p>
          <h3 className="product-name"><Link to={`/products/${product.id}`}>{product.name}</Link></h3>
        </div>
        <p className="product-price">{formatPrice(product.price)}</p>
      </div>
    </article>
  )
}
