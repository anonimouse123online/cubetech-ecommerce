import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiGet } from '../api/client'
import ProductCard from '../components/ProductCard'
import StatePanel from '../components/StatePanel'

function SearchForm({ initialSearch, onSearch }) {
  const [search, setSearch] = useState(initialSearch)

  function submitSearch(event) {
    event.preventDefault()
    onSearch(search.trim())
  }

  return (
    <form className="search-form" onSubmit={submitSearch}>
      <SearchIcon />
      <input aria-label="Search products" type="search" placeholder="Search the collection" value={search} maxLength={120} onChange={(event) => setSearch(event.target.value)} />
    </form>
  )
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
}

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryString = searchParams.toString()
  const [productResult, setProductResult] = useState(null)
  const [categories, setCategories] = useState([])
  const params = new URLSearchParams(queryString)
  const committedSearch = params.get('search') || ''
  const selectedCategory = params.get('category') || ''
  const selectedSort = params.get('sort') || ''
  const currentResult = productResult?.queryString === queryString ? productResult : null
  const products = currentResult?.products || []
  const error = currentResult?.error || ''
  const loading = currentResult === null

  useEffect(() => {
    const controller = new AbortController()
    apiGet('/categories', { signal: controller.signal })
      .then((result) => setCategories(result.data))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setCategories([])
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    apiGet(`/products${queryString ? `?${queryString}` : ''}`, { signal: controller.signal })
      .then((result) => setProductResult({ queryString, products: result.data, error: '' }))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setProductResult({ queryString, products: [], error: requestError.message })
      })
    return () => controller.abort()
  }, [queryString])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  return (
    <div className="container">
      <header className="page-heading">
        <p className="eyebrow">The Cartlane edit</p>
        <h1>Everyday, upgraded.</h1>
      </header>
      <section className="catalog-toolbar" aria-label="Product filters">
        <SearchForm key={committedSearch} initialSearch={committedSearch} onSearch={(value) => updateFilter('search', value)} />
        <div className="catalog-controls">
          <select className="select-control" aria-label="Filter by category" value={selectedCategory} onChange={(event) => updateFilter('category', event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => <option value={category.slug} key={category.id}>{category.name}</option>)}
          </select>
          <select className="select-control" aria-label="Sort by price" value={selectedSort} onChange={(event) => updateFilter('sort', event.target.value)}>
            <option value="">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
          {!loading && !error && <span className="result-count">{products.length} {products.length === 1 ? 'piece' : 'pieces'}</span>}
        </div>
      </section>

      <div className="catalog-content">
        {loading ? <StatePanel title="Finding the good stuff…">The collection will be right with you.</StatePanel>
          : error ? <StatePanel title="We couldn't load the collection" error>{error}<br />Please check your connection and try again.</StatePanel>
            : products.length ? <div className="product-grid catalog-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
              : <StatePanel title="Nothing here just yet">Try another search or clear a filter to see more products.<br /><Link className="text-link" to="/products">Clear all filters ↗</Link></StatePanel>}
      </div>
    </div>
  )
}
