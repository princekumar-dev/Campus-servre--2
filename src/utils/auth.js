/**
 * Safe auth read from localStorage.
 * Returns parsed auth object or null if missing/invalid; clears corrupted auth.
 */
export function getAuthOrNull() {
  try {
    const auth = localStorage.getItem('auth')
    if (!auth) return null
    const parsed = JSON.parse(auth)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    localStorage.removeItem('auth')
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userId')
    return null
  }
}

/**
 * Return the correct landing dashboard for every authenticated role.
 * Roles without a dedicated dashboard use the role-aware main dashboard.
 */
export function getDashboardPath(role) {
  const roleDashboards = {
    gate: '/gate/dashboard',
    vendor: '/vendor/dashboard',
    service_provider: '/service/dashboard',
    receiving_officer: '/receiving/dashboard',
    accounts: '/accounts/dashboard'
  }

  return roleDashboards[role] || '/dashboard'
}
