import { connectToDatabase } from '../lib/mongo.js'
import { SystemSettings, AuditLog } from '../models.js'
import { DEFAULT_SYSTEM_SETTINGS, getSystemSettings, sanitizeSystemSettings } from '../lib/systemSettings.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  try {
    await connectToDatabase()
    if (req.method === 'GET') {
      const settings = await getSystemSettings()
      return res.status(200).json({ success: true, settings })
    }
    if (req.method !== 'PUT') return res.status(405).json({ success: false, error: 'Method not allowed' })
    if (req.user?.role !== 'super_admin') return res.status(403).json({ success: false, error: 'Only the super administrator can update system settings' })

    const updates = sanitizeSystemSettings(req.body)
    if (!updates.collegeName || !updates.collegeFullName || !updates.emailDomain || !updates.defaultDepartment) {
      return res.status(400).json({ success: false, error: 'Institution name, email domain, and default department are required' })
    }
    const settings = await SystemSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: { ...DEFAULT_SYSTEM_SETTINGS, ...updates, updatedBy: req.user.name || req.user.email, updatedAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean()
    await AuditLog.create({
      entityType: 'SYSTEM_SETTINGS', entityId: 'global', action: 'UPDATED',
      actorId: req.user.id, actorName: req.user.name, actorRole: req.user.role,
      details: { changedFields: Object.keys(updates) }
    })
    return res.status(200).json({ success: true, settings })
  } catch (error) {
    console.error('Settings API error:', error)
    return res.status(500).json({ success: false, error: 'Unable to process system settings' })
  }
}
