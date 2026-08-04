import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { connectToDatabase } from '../lib/mongo.js'
import { User } from '../models.js'

const defaults = {
  gate: {
    name: 'Gate Security Guard',
    email: String(process.env.GATE_USER_EMAIL || 'gate@msec.edu.in').trim().toLowerCase(),
    password: String(process.env.GATE_USER_PASSWORD || '123'),
    role: 'gate',
    department: 'SECURITY',
    phoneNumber: String(process.env.GATE_USER_PHONE || '')
  },
  service: {
    name: 'MSEC Service Provider',
    email: String(process.env.SERVICE_PROVIDER_EMAIL || 'service@msec.edu.in').trim().toLowerCase(),
    password: String(process.env.SERVICE_PROVIDER_PASSWORD || '123'),
    role: 'service_provider',
    department: 'MAINTENANCE',
    phoneNumber: String(process.env.SERVICE_PROVIDER_PHONE || '')
  }
}

async function ensureUser({ name, email, password, role, department, phoneNumber }) {
  if (!email || !password) throw new Error(`Missing credentials for ${role}`)

  const existing = await User.findOne({ email })
  if (existing) {
    existing.role = role
    existing.isActive = true
    existing.department ||= department
    existing.name ||= name
    if (!existing.phoneNumber && phoneNumber) existing.phoneNumber = phoneNumber

    // Keep this account usable if default seed password is expected.
    if (password) existing.password = await bcrypt.hash(password, 10)

    await existing.save()
    console.log(`Updated ${role} login: ${email}`)
    return
  }

  await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 10),
    role,
    department,
    phoneNumber,
    isActive: true
  })
  console.log(`Created ${role} login: ${email}`)
}

await connectToDatabase()
await ensureUser(defaults.gate)
await ensureUser(defaults.service)

console.log('Gate + service-provider logins are ready.')
process.exit(0)
