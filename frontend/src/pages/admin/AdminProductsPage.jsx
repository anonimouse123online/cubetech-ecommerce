import { useEffect, useState } from 'react'
import { apiDelete, apiGet, apiPost, apiPut } from '../../api/client'

const EMPTY_PRODUCT = { name: '', description: '', price: '', stock: 0, imageUrl: '', categoryId: '', isActive: true }

function ProductEditor({ product, categories, onClose, onSaved }) {
  const [form, setForm] = useState(product ? {
    name: product.name,
    description: product.description,
    price: product.price,
    stock: product.stock,
    imageUrl: product.imageUrl,
    categoryId: product.categoryId,
    isActive: product.isActive,
  } : EMPTY_PRODUCT)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = product
        ? await apiPut(`/admin/products/${product.id}`, form)
        : await apiPost('/admin/products', form)
      onSaved(result.data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
        <header className="admin-modal-heading"><div><p className="eyebrow">Catalog</p><h2 id="product-form-title">{product ? 'Edit product' : 'Add a product'}</h2></div><button className="admin-icon-close" type="button" aria-label="Close" onClick={onClose}>×</button></header>
        <form className="admin-form" onSubmit={submit}>
          <div className="admin-form-grid">
            <label className="admin-field"><span>Product name</span><input required minLength={2} maxLength={120} value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
            <label className="admin-field"><span>Category</span><select required value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}><option value="">Choose a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
            <label className="admin-field"><span>Price (PHP)</span><input required type="number" min="0.01" step="0.01" value={form.price} onChange={(event) => update('price', event.target.value)} /></label>
            <label className="admin-field"><span>Stock</span><input required type="number" min="0" step="1" value={form.stock} onChange={(event) => update('stock', event.target.value === '' ? '' : Number(event.target.value))} /></label>
            <label className="admin-field admin-field-wide"><span>Image URL</span><input required type="url" maxLength={1000} value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} /></label>
            <label className="admin-field admin-field-wide"><span>Description</span><textarea required minLength={3} maxLength={3000} rows="4" value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
            <label className="admin-checkbox"><input type="checkbox" checked={form.isActive} onChange={(event) => update('isActive', event.target.checked)} /><span>Visible to customers</span></label>
          </div>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <div className="admin-form-actions"><button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button><button className="button" disabled={busy || !categories.length}>{busy ? 'Saving…' : product ? 'Save changes' : 'Add product'}</button></div>
        </form>
      </section>
    </div>
  )
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ search: '', categoryId: '', status: 'all' })
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const filterSearch = filters.search
  const filterCategoryId = filters.categoryId
  const filterStatus = filters.status

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (filterSearch) params.set('search', filterSearch)
    if (filterCategoryId) params.set('categoryId', filterCategoryId)
    if (filterStatus !== 'all') params.set('status', filterStatus)
    apiGet(`/admin/products${params.size ? `?${params}` : ''}`)
      .then((result) => active && setProducts(result.data))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [filterSearch, filterCategoryId, filterStatus])

  useEffect(() => { apiGet('/admin/categories').then((result) => setCategories(result.data)).catch((requestError) => setError(requestError.message)) }, [])

  function saveProduct(saved) {
    setProducts((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
    setEditor(null)
  }

  async function removeProduct(product) {
    setError('')
    try {
      await apiDelete(`/admin/products/${product.id}`)
      setProducts((current) => current.filter((item) => item.id !== product.id))
    } catch (requestError) {
      if (requestError.code === 'PRODUCT_HAS_ORDERS' && window.confirm(`${product.name} is in saved orders. Make it inactive instead?`)) {
        try {
          const result = await apiPut(`/admin/products/${product.id}`, { ...product, isActive: false })
          setProducts((current) => current.map((item) => item.id === product.id ? result.data : item))
        } catch (deactivateError) {
          setError(deactivateError.message)
        }
        return
      }
      setError(requestError.message)
    }
  }

  return (
    <>
      <header className="admin-page-heading"><div><p className="eyebrow">Catalog management</p><h1>Products</h1><p>Update prices, stock, and customer visibility.</p></div><button className="button admin-heading-button" onClick={() => setEditor({ product: null })}>+ Add product</button></header>
      <section className="admin-panel">
        <form className="admin-filter-bar" onSubmit={(event) => { event.preventDefault(); setLoading(true); setFilters((current) => ({ ...current, search: search.trim() })) }}>
          <input aria-label="Search products" type="search" placeholder="Search product names" maxLength={120} value={search} onChange={(event) => setSearch(event.target.value)} />
          <button className="admin-secondary-button">Search</button>
          <select aria-label="Filter by category" value={filters.categoryId} onChange={(event) => { setLoading(true); setFilters((current) => ({ ...current, categoryId: event.target.value })) }}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          <select aria-label="Filter by status" value={filters.status} onChange={(event) => { setLoading(true); setFilters((current) => ({ ...current, status: event.target.value })) }}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          <span className="admin-result-count">{products.length} products</span>
        </form>
        {error && <div className="admin-alert" role="alert">{error}</div>}
        {loading ? <div className="admin-empty">Loading products…</div> : products.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{products.map((product) => <tr key={product.id}>
          <td><div className="admin-product-cell"><img src={product.imageUrl} alt="" /><span><strong>{product.name}</strong><small>{product.slug}</small></span></div></td><td>{product.category?.name}</td><td>₱{Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td>{product.stock}</td><td><span className={`admin-status ${product.isActive ? 'is-active' : 'is-inactive'}`}>{product.isActive ? 'Active' : 'Inactive'}</span></td><td><div className="admin-row-actions"><button onClick={() => setEditor({ product })}>Edit</button><button className="is-danger" onClick={() => removeProduct(product)}>Delete</button></div></td>
        </tr>)}</tbody></table></div> : <div className="admin-empty">No products match these filters.</div>}
      </section>
      {editor && <ProductEditor product={editor.product} categories={categories} onClose={() => setEditor(null)} onSaved={saveProduct} />}
    </>
  )
}
