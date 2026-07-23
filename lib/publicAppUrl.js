export const CAMPUSSERVE_PUBLIC_URL = 'https://msec-campusserve.vercel.app'

const LEGACY_HOSTS = new Set([
  'msec-academics.vercel.app',
  'www.msec-academics.vercel.app'
])

export function resolvePublicAppUrl(configuredUrl = '') {
  const candidate = String(configuredUrl || '').trim()
  if (!candidate) return CAMPUSSERVE_PUBLIC_URL

  try {
    const parsed = new URL(candidate)
    if (!['http:', 'https:'].includes(parsed.protocol)) return CAMPUSSERVE_PUBLIC_URL
    if (LEGACY_HOSTS.has(parsed.hostname.toLowerCase())) return CAMPUSSERVE_PUBLIC_URL
    return candidate.replace(/\/+$/, '')
  } catch {
    return CAMPUSSERVE_PUBLIC_URL
  }
}
