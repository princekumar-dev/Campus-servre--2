import jwt from 'jsonwebtoken'
import { User } from '../models.js'

const JWT_SECRET = process.env.JWT_SECRET || 'campusserve-default-secret-change-in-production'
const JWT_EXPIRY = '7d'

export function generateToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  )
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  try {
    const decoded = verifyToken(token)
    const user = await User.findById(decoded.id).select('_id email name role department phoneNumber eSignature isActive').lean()
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'User not found or deactivated' })
    }
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      phoneNumber: user.phoneNumber,
      eSignature: user.eSignature
    }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' })
    }
    return res.status(401).json({ success: false, error: 'Invalid token' })
  }
}

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' })
    }
    next()
  }
}
