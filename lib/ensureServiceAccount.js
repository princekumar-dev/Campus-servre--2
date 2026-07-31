import bcrypt from 'bcryptjs'
import { User } from '../models.js'

export async function ensureServiceAccount() {
  const email = String(process.env.SERVICE_PORTAL_EMAIL || 'service@msec.edu.in').trim().toLowerCase()
  const existing = await User.findOne({ email }).select('_id role').lean()
  if (existing) return existing

  const password = process.env.SERVICE_PORTAL_PASSWORD || '123'
  return User.create({
    name: 'MSEC Service Provider',
    email,
    password: await bcrypt.hash(password, 10),
    role: 'service_provider',
    department: 'MAINTENANCE',
    phoneNumber: process.env.SERVICE_PORTAL_PHONE || '+91-9876543209',
    isActive: true
  })
}
