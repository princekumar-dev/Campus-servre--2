import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { connectToDatabase } from '../lib/mongo.js'
import { User } from '../models.js'

const email = String(process.env.SUPER_ADMIN_EMAIL || 'super@msec.edu.in').trim().toLowerCase()
const password = String(process.env.SUPER_ADMIN_PASSWORD || '123')

await connectToDatabase()

const existing = await User.findOne({ email })
if (existing) {
  existing.role = 'super_admin'
  existing.isActive = true
  existing.department ||= 'SYSTEM'
  existing.name ||= 'Super Admin'
  await existing.save()
  console.log(`Super administrator verified: ${email}`)
} else {
  await User.create({
    name: 'Super Admin',
    email,
    password: await bcrypt.hash(password, 10),
    role: 'super_admin',
    department: 'SYSTEM',
    phoneNumber: '',
    isActive: true,
  })
  console.log(`Super administrator created: ${email}`)
}

process.exit(0)
