import { SystemSettings } from '../models.js'

export const DEFAULT_SYSTEM_SETTINGS = Object.freeze({
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
  const saved = await SystemSettings.findOne({ key: 'global' }).lean()
  return { ...DEFAULT_SYSTEM_SETTINGS, ...(saved || {}) }
}

export function sanitizeSystemSettings(input = {}) {
  const output = {}
  const strings = ['collegeName', 'collegeFullName', 'emailDomain', 'defaultDepartment', 'timezone', 'currency']
  const booleans = ['allowPublicSignup', 'enforceEmailDomain', 'enableNotifications', 'enableEmailAlerts', 'requireIssuePhoto', 'requireCompletionPhotos']
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
