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
      const { email, password, institution, portal, scanTarget: requestedScanTarget } = req.body

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        })
      }

      await connectToDatabase()

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

      if (user.role === 'vendor') {
        return res.status(403).json({
          success: false,
          error: 'Vendor portal login is not available. Purchase managers manage supplier records and purchase orders internally.'
        })
      }

      const institutionRoles = ['requester', 'staff', 'hod']
      if (institutionRoles.includes(user.role)) {
        const accountInstitution = user.institution || 'msec'
        if (!institution) {
          return res.status(400).json({ success: false, error: 'Select your institution before signing in.' })
        }
        if (institution !== accountInstitution) {
          return res.status(403).json({ success: false, error: 'This account does not belong to the selected institution.' })
        }
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
          institution: user.institution || (institutionRoles.includes(user.role) ? 'msec' : ''),
          department: user.department,
          phoneNumber: user.phoneNumber,
          eSignature: user.eSignature || null
        }
      })

    } catch (error) {
      console.error('Authentication error:', error)
      const databaseUnavailable = [
        'MongoServerSelectionError',
        'MongoNetworkError',
        'MongooseServerSelectionError'
      ].includes(error?.name) || ['ETIMEDOUT', 'ECONNREFUSED'].includes(error?.code)

      return res.status(databaseUnavailable ? 503 : 500).json({
        success: false,
        error: databaseUnavailable
          ? 'The database is temporarily unavailable. Please try again in a few seconds.'
          : 'Internal server error'
      })
    }
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }
}
