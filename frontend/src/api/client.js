export { formatPrice } from '../cart/cart-storage'

export class ApiError extends Error {
  constructor(message, { status, code, details }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request(path, options = {}) {
  const { headers: optionHeaders = {}, ...requestOptions } = options
  const response = await fetch(`/api${path}`, {
    headers: { Accept: 'application/json', ...optionHeaders },
    credentials: 'include',
    ...requestOptions,
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(result.error || `Request failed (${response.status}).`, {
      status: response.status,
      code: result.code,
      details: result.details,
    })
  }
  return result
}

export function apiGet(path, { signal } = {}) {
  return request(path, { method: 'GET', signal })
}

export function apiPost(path, body, { signal } = {}) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}

export function apiPut(path, body, { signal } = {}) {
  return request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}

export function apiPatch(path, body, { signal } = {}) {
  return request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}

export function apiDelete(path, { signal } = {}) {
  return request(path, { method: 'DELETE', signal })
}
