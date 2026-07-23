import { connectToDatabase } from '../lib/mongo.js'
import { User } from '../models.js'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in users API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    if (req.method === 'GET') {
      const { action, role, userId } = req.query

      // Role-filter: populate manager/technician dropdowns
      if (role && !action) {
        const allowedRoles = ['manager', 'technician', 'accounts', 'admin', 'requester']
        if (!allowedRoles.includes(role)) {
          return res.status(400).json({ success: false, error: 'Invalid role filter' })
        }
        const users = await User.find({ role, isActive: true })
          .select('_id name email role department phoneNumber')
          .sort({ name: 1 })
          .lean()
        return res.status(200).json({
          success: true,
          users: users.map(u => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            department: u.department,
            phoneNumber: u.phoneNumber
          }))
        })
      }

      if (action === 'profile') {
        if (!userId) {
          return res.status(400).json({ success: false, error: 'userId is required' })
        }
        const user = await User.findById(userId).select('_id name email role department phoneNumber eSignature').lean()
        if (!user) {
          return res.status(404).json({ success: false, error: 'User not found' })
        }
        return res.status(200).json({
          success: true,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            phoneNumber: user.phoneNumber,
            eSignature: user.eSignature
          }
        })
      }

      // list users - ADMIN ONLY
      if (action === 'list') {
        if (!userId) {
          return res.status(400).json({ success: false, error: 'userId is required' })
        }
        const requestingUser = await User.findById(userId).select('_id role').lean()
        if (!requestingUser) {
          return res.status(401).json({ success: false, error: 'User not found' })
        }
        if (String(requestingUser.role || '').toLowerCase() !== 'admin') {
          return res.status(403).json({ success: false, error: 'Only admin can list users' })
        }
        const users = await User.find().select('_id name email role department phoneNumber createdAt').sort({ createdAt: -1 }).lean()
        const safe = users.map(u => ({
          id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          department: u.department,
          phoneNumber: u.phoneNumber,
          createdAt: u.createdAt
        }))
        return res.status(200).json({ success: true, users: safe })
      }

      return res.status(400).json({ success: false, error: 'Invalid action or missing required parameters' })
    }

    if (req.method === 'POST') {
      // Only admin/super_admin can create users
      const requestingRole = req.user ? req.user.role : (req.headers['x-user-role'] || '')
      if (!['admin', 'super_admin'].includes(requestingRole)) {
        return res.status(403).json({ success: false, error: 'Only admin can create users' })
      }

      const { name, email, password, role, department, phoneNumber } = req.body
      if (!name || !email || !password || !role || !department) {
        return res.status(400).json({ success: false, error: 'name, email, password, role and department are required' })
      }

      const validRoles = ['admin', 'requester', 'manager', 'technician', 'accounts', 'vendor', 'super_admin', 'gate', 'receiving_officer', 'delivery_person', 'hod', 'staff']
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, error: `role must be one of: ${validRoles.join(', ')}` })
      }

      const existing = await User.findOne({ email: email.toLowerCase() })
      if (existing) {
        return res.status(409).json({ success: false, error: 'User already exists' })
      }

      const hashed = await bcrypt.hash(password, 10)
      const userData = {
        name,
        email: email.toLowerCase(),
        password: hashed,
        role,
        department,
        phoneNumber: phoneNumber || ''
      }

      const user = new User(userData)
      await user.save()

      const safe = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        phoneNumber: user.phoneNumber
      }
      return res.status(201).json({ success: true, message: 'User created successfully', user: safe })
    }

    if (req.method === 'DELETE') {
      // Only admin can delete users
      const requestingRole = req.user ? req.user.role : (req.headers['x-user-role'] || '')
      if (!['admin', 'super_admin'].includes(requestingRole)) {
        return res.status(403).json({ success: false, error: 'Only admin can delete users' })
      }

      try {
        const userIdToDelete = req.query?.id
        if (!userIdToDelete) return res.status(400).json({ success: false, error: 'id (user to delete) required' })

        const deleted = await User.findByIdAndDelete(userIdToDelete)
        if (!deleted) return res.status(404).json({ success: false, error: 'User not found' })
        return res.status(200).json({ success: true, deleted: true })
      } catch (delErr) {
        console.error('Error deleting user:', delErr)
        return res.status(500).json({ success: false, error: 'Failed to delete user' })
      }
    }

    if (req.method === 'PATCH') {
      const action = req.query?.action || req.body?.action
      const userId = req.query?.userId || req.body?.userId
      if (!action) return res.status(400).json({ success: false, error: 'action required' })

      if (action === 'admin-reset-password') {
        const { targetUserId, newPassword } = req.body || {}
        const adminUserId = req.user ? req.user.id : (req.body.adminUserId || '')
        if (!targetUserId || !newPassword) {
          return res.status(400).json({ success: false, error: 'targetUserId and newPassword are required' })
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' })
        }

        const adminUser = req.user || await User.findById(adminUserId).select('_id role').lean()
        if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
          return res.status(403).json({ success: false, error: 'Only admin can change user passwords' })
        }

        const targetUser = await User.findById(targetUserId).select('_id email role').lean()
        if (!targetUser) {
          return res.status(404).json({ success: false, error: 'User not found' })
        }
        if (String(targetUser.role || '').toLowerCase() === 'admin') {
          return res.status(403).json({ success: false, error: 'Admin passwords must be changed from account settings' })
        }

        try {
          const hashedPassword = await bcrypt.hash(newPassword, 10)
          const updatedUser = await User.findByIdAndUpdate(targetUserId, { password: hashedPassword }, { new: true }).select('_id email role').lean()
          return res.status(200).json({ success: true, message: 'Password updated successfully', user: { id: updatedUser._id, email: updatedUser.email, role: updatedUser.role } })
        } catch (error) {
          console.error('Error resetting user password as admin:', error)
          return res.status(500).json({ success: false, error: 'Failed to reset user password' })
        }
      }

      if (!userId) return res.status(400).json({ success: false, error: 'userId required' })

      if (action === 'update-signature') {
        const { eSignature } = req.body
        const u = await User.findByIdAndUpdate(userId, { eSignature }, { new: true }).lean()
        return res.status(200).json({ success: true, user: { id: u._id, eSignature: u.eSignature } })
      }

      if (action === 'update-profile') {
        const { name, phoneNumber } = req.body
        const updateData = {}
        if (name) updateData.name = name
        if (phoneNumber) updateData.phoneNumber = phoneNumber
        const u = await User.findByIdAndUpdate(userId, updateData, { new: true }).lean()
        return res.status(200).json({ success: true, user: { id: u._id, name: u.name, phoneNumber: u.phoneNumber } })
      }

      if (action === 'reset-password') {
        const { currentPassword, newPassword } = req.body
        if (!currentPassword || !newPassword) {
          return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required' })
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' })
        }

        try {
          const user = await User.findById(userId)
          if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' })
          }
          const isPasswordValid = await bcrypt.compare(currentPassword, user.password)
          if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' })
          }
          const hashedPassword = await bcrypt.hash(newPassword, 10)
          const updatedUser = await User.findByIdAndUpdate(userId, { password: hashedPassword }, { new: true }).lean()
          return res.status(200).json({ success: true, message: 'Password updated successfully', user: { id: updatedUser._id, email: updatedUser.email } })
        } catch (error) {
          console.error('Error resetting password:', error)
          return res.status(500).json({ success: false, error: 'Failed to reset password' })
        }
      }

      return res.status(400).json({ success: false, error: 'unknown action' })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('Users API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
