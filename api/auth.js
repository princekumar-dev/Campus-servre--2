import { connectToDatabase } from '../lib/mongo.js'
import { User } from '../models.js'
import bcrypt from 'bcryptjs'
import { generateToken } from '../lib/auth.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'POST') {
    try {
      await connectToDatabase()
      
      const { email, password, portal, scanTarget: requestedScanTarget } = req.body

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        })
      }

      const normalizedEmail = email.toLowerCase().trim()
      const user = await User.findOne({ email: normalizedEmail })

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email address. No account found for this email.'
        })
      }

      const passwordMatches = await bcrypt.compare(password, user.password)
      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        })
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Account is deactivated'
        })
      }

      const scanPortal = ['gate', 'service'].includes(portal) ? portal : ''
      const scanTarget = String(requestedScanTarget || '').split('?')[0]
      const validScanTarget = scanPortal === 'gate'
        ? /^\/gate\/po\/[a-f\d]{24}$/i.test(scanTarget)
        : scanPortal === 'service'
          ? /^\/service\/po\/[a-f\d]{24}$/i.test(scanTarget)
          : !scanTarget
      if (!validScanTarget) {
        return res.status(400).json({ success: false, error: 'The scanned PO destination is invalid.' })
      }
      if (scanPortal === 'gate' && user.role !== 'gate') {
        return res.status(403).json({ success: false, error: 'Sign in with a Gate Officer account for PO scanning.' })
      }
      if (scanPortal === 'service' && user.role !== 'service_provider') {
        return res.status(403).json({ success: false, error: 'Sign in with the assigned Service Provider account for this Service PO.' })
      }

      const token = generateToken(user, { scanPortal, scanTarget })

      return res.status(200).json({
        success: true,
        token,
        scanPortal,
        scanTarget,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          phoneNumber: user.phoneNumber,
          eSignature: user.eSignature || null
        }
      })

    } catch (error) {
      console.error('Authentication error:', error)
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }
}
