const SESSION_KEY = "smartconta.session"

export function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
  } catch {
    return null
  }
}

export function storeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

