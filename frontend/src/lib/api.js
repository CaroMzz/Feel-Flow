export async function apiRequest(path, { headers, ...options } = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...options,
  })

  if (response.status === 204) return null

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || 'No pudimos completar la solicitud. Intentá nuevamente.')
  }

  return payload
}
