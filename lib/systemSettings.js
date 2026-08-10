import { SystemSettings } from '../models.js'

const SETTINGS_CACHE_TTL_MS = 30_000
let settingsCache = null
let settingsCacheExpiresAt = 0

export const DEFAULT_SYSTEM_SETTINGS = Object.freeze({
  institutions: [
    { id: 'msec', shortName: 'MSEC', fullName: 'Meenakshi Sundararajan Engineering College', emailDomain: '@msec.edu.in', defaultDepartment: 'MAINTENANCE', affiliation: 'An Autonomous Institution Affiliated to Anna University', documentAddress: '363, Arcot Road, Kodambakkam, Chennai - 600024', contactLine: 'principal@msec.edu.in', website: 'www.msec.edu.in' },
    { id: 'nest', shortName: 'The Nest School', fullName: 'The NEST School', emailDomain: '@nest.edu.in', defaultDepartment: 'Administration', affiliation: 'IB World School | Cambridge International School', documentAddress: '363, Arcot Road, Kodambakkam, Chennai - 600024', contactLine: 'For enquiries: +91 99401 06358', website: 'www.thenest.school' },
    { id: 'mssm', shortName: 'MSSM', fullName: 'Meenakshi Sundararajan School of Management', emailDomain: '@mssm.edu.in', defaultDepartment: 'General Management', affiliation: 'Affiliated to the University of Madras & Approved by AICTE | Co-Educational Institution under the aegis of IIET', documentAddress: '363, Arcot Road, Kodambakkam, Chennai - 600024', contactLine: '+91 98407 21869 | +91 98414 37372 | admissions@mssm.edu.in', website: 'www.mssm.edu.in' },
    { id: 'iic', shortName: 'IIET', fullName: 'Indian Institute of Engineering Technology', emailDomain: '@iiet.edu.in', defaultDepartment: 'Innovation Council', affiliation: "Ministry of Education's Innovation Cell | AICTE", documentAddress: 'Meenakshi Sundararajan Engineering College, 363 Arcot Road, Kodambakkam, Chennai - 600024', contactLine: 'Institution Innovation Council', website: 'www.msec.edu.in' }
  ],
  collegeName: 'MSEC',
  collegeFullName: 'Meenakshi Sundararajan Engineering College',
  emailDomain: '@msec.edu.in',
  defaultDepartment: 'MAINTENANCE',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  allowPublicSignup: true,
  enforceEmailDomain: true,
  enableNotifications: true,
  enableEmailAlerts: true,
  goodsPoGeofenceEnabled: true,
  servicePoGeofenceEnabled: true,
  requireIssuePhoto: false,
  requireCompletionPhotos: true,
  maxAttachmentSizeMB: 5,
  requestEditWindowHours: 24,
  slaLowHours: 72,
  slaMediumHours: 48,
  slaHighHours: 24,
  slaEmergencyHours: 4
})

export async function getSystemSettings() {
  if (settingsCache && Date.now() < settingsCacheExpiresAt) return settingsCache
  const saved = await SystemSettings.findOne({ key: 'global' }).lean()
  const settings = { ...DEFAULT_SYSTEM_SETTINGS, ...(saved || {}) }
  const savedInstitutions = new Map((saved?.institutions || []).map(institution => [institution.id, institution]))
  settings.institutions = DEFAULT_SYSTEM_SETTINGS.institutions.map(defaultInstitution => {
    const savedInstitution = savedInstitutions.get(defaultInstitution.id) || {}
    const institution = { ...defaultInstitution, ...savedInstitution }
    if (institution.id === 'iic' && String(institution.shortName).toUpperCase() === 'IIC') {
      institution.shortName = 'IIET'
      if (institution.fullName === "Institution's Innovation Council") {
        institution.fullName = 'Indian Institute of Engineering Technology'
      }
    }
    if (institution.id === 'iic' && institution.emailDomain === '@msec.edu.in') {
      institution.emailDomain = '@iiet.edu.in'
    }
    return institution
  })
  settingsCache = settings
  settingsCacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS
  return settingsCache
}

export function invalidateSystemSettingsCache() {
  settingsCache = null
  settingsCacheExpiresAt = 0
}

export function sanitizeSystemSettings(input = {}) {
  const output = {}
  if (Array.isArray(input.institutions)) {
    const validIds = new Set(DEFAULT_SYSTEM_SETTINGS.institutions.map(institution => institution.id))
    output.institutions = input.institutions
      .filter(institution => validIds.has(institution?.id))
      .map(institution => {
        const emailDomain = String(institution.emailDomain || '').trim().toLowerCase()
        return {
          id: institution.id,
          shortName: String(institution.shortName || '').trim(),
          fullName: String(institution.fullName || '').trim(),
          emailDomain: emailDomain && !emailDomain.startsWith('@') ? `@${emailDomain}` : emailDomain,
          defaultDepartment: String(institution.defaultDepartment || '').trim(),
          affiliation: String(institution.affiliation || '').trim(),
          documentAddress: String(institution.documentAddress || '').trim(),
          contactLine: String(institution.contactLine || '').trim(),
          website: String(institution.website || '').trim()
        }
      })
  }
  const strings = ['collegeName', 'collegeFullName', 'emailDomain', 'defaultDepartment', 'timezone', 'currency']
  const booleans = ['allowPublicSignup', 'enforceEmailDomain', 'enableNotifications', 'enableEmailAlerts', 'goodsPoGeofenceEnabled', 'servicePoGeofenceEnabled', 'requireIssuePhoto', 'requireCompletionPhotos']
  const ranges = {
    maxAttachmentSizeMB: [1, 25], requestEditWindowHours: [0, 168],
    slaLowHours: [1, 720], slaMediumHours: [1, 720], slaHighHours: [1, 720], slaEmergencyHours: [1, 720]
  }
  for (const key of strings) if (typeof input[key] === 'string') output[key] = input[key].trim()
  for (const key of booleans) if (typeof input[key] === 'boolean') output[key] = input[key]
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const value = Number(input[key])
    if (Number.isFinite(value)) output[key] = Math.min(max, Math.max(min, Math.round(value)))
  }
  if (output.emailDomain && !output.emailDomain.startsWith('@')) output.emailDomain = `@${output.emailDomain}`
  return output
}
