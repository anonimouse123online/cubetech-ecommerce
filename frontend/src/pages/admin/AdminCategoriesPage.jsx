import { useEffect, useState } from 'react'
import { apiDelete, apiGet, apiPost, apiPut } from '../../api/client'

const emptyForm = { name: '', description: '', imageUrl: '' }

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    apiGet('/admin/categories')
      .then((result) => setCategories(result.data))
      .catch((requestError) => setError(requestError.message))
  }, [])

  async function submit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const result = editingId
        ? await apiPut(`/admin/categories/${editingId}`, form)
        : await apiPost('/admin/categories', form)
      if (editingId) setCategories((current) => current.map((category) => category.id === editingId ? { ...category, ...result.data } : category))
      else setCategories((current) => [...current, { ...result.data, productCount: 0 }].sort((left, right) => left.name.localeCompare(right.name)))
      setNotice(editingId ? 'Category updated.' : 'Category added.')
      setEditingId('')
      setForm(emptyForm)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  function editCategory(category) {
    setEditingId(category.id)
    setForm({ name: category.name, description: category.description || '', imageUrl: category.imageUrl || '' })
    setError('')
    setNotice('')
  }

  async function removeCategory(category) {
    setError('')
    setNotice('')
    try {
      await apiDelete(`/admin/categories/${category.id}`)
      setCategories((current) => current.filter((item) => item.id !== category.id))
      setNotice('Category deleted.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <>
      <header className="admin-page-heading"><div><p className="eyebrow">Catalog structure</p><h1>Categories</h1><p>Keep related products easy to browse.</p></div></header>
      <div className="admin-two-column">
        <section className="admin-panel admin-editor-panel">
          <p className="eyebrow">{editingId ? 'Edit category' : 'New category'}</p>
          <h2>{editingId ? 'Update details' : 'Add a category'}</h2>
          <form className="admin-form" onSubmit={submit}>
            <label className="admin-field"><span>Name</span><input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label className="admin-field"><span>Description <small>Optional</small></span><textarea rows="3" maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <label className="admin-field"><span>Image URL <small>Optional</small></span><input type="url" maxLength={1000} value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} /></label>
            {error && <p className="admin-error" role="alert">{error}</p>}
            {notice && <p className="admin-success" role="status">{notice}</p>}
            <div className="admin-form-actions"><button className="button" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save category' : 'Add category'}</button>{editingId && <button type="button" className="admin-secondary-button" onClick={() => { setEditingId(''); setForm(emptyForm); setError(''); setNotice('') }}>Cancel</button>}</div>
          </form>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="eyebrow">All categories</p><h2>{categories.length} total</h2></div></div>
          {categories.length ? <div className="admin-category-list">{categories.map((category) => <article className="admin-category-row" key={category.id}><div><strong>{category.name}</strong><small>{category.slug} · {category.productCount} products</small>{category.description && <p>{category.description}</p>}</div><div className="admin-row-actions"><button onClick={() => editCategory(category)}>Edit</button><button className="is-danger" onClick={() => removeCategory(category)}>Delete</button></div></article>)}</div> : <div className="admin-empty">No categories yet.</div>}
        </section>
      </div>
    </>
  )
}
