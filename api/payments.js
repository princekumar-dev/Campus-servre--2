import { connectToDatabase } from '../lib/mongo.js'
import { ServiceRequest, User } from '../models.js'
import { finalizeRequestWorkflow } from '../lib/workflowEngine.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in payments API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  const { id } = req.query
  const actorId = req.user ? req.user.id : (req.headers['x-user-id'] || 'system')
  const actor = req.user || await User.findById(actorId).lean()
  const actorName = actor ? actor.name : 'Unknown User'
  const actorRole = req.user ? req.user.role : (req.headers['x-user-role'] || '')

  try {
    if (req.method === 'POST') {
      if (!id) return res.status(400).json({ success: false, error: 'Request ID is required' })

      const request = await ServiceRequest.findById(id)
      if (!request) return res.status(404).json({ success: false, error: 'Request not found' })
      if (!request.invoice) return res.status(400).json({ success: false, error: 'Invoice must be created and approved before recording payment' })
      if (!['accounts', 'super_admin'].includes(actorRole)) return res.status(403).json({ success: false, error: 'Only accounts or a super administrator can record payments' })
      if (request.invoice.status !== 'APPROVED' || !['PAYMENT_PENDING', 'PARTIALLY_PAID'].includes(request.status)) return res.status(409).json({ success: false, error: 'Payments can only be recorded against an approved, outstanding invoice' })

      const { amount, method, referenceNumber, notes } = req.body
      if (!amount || !method) {
        return res.status(400).json({ success: false, error: 'Amount and payment method are required' })
      }

      const paymentAmt = Number(amount)
      if (!Number.isFinite(paymentAmt) || paymentAmt <= 0) {
        return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' })
      }
      if (paymentAmt > request.invoice.balanceDue) {
        return res.status(400).json({ success: false, error: 'Payment amount cannot exceed the outstanding balance' })
      }

      const year = new Date().getFullYear()
      const randomNum = Math.floor(Math.random() * 90000) + 10000
      const paymentNumber = `PAY-${year}-${randomNum}`

      // Add to payments list
      request.payments.push({
        paymentNumber,
        amount: paymentAmt,
        method,
        referenceNumber: referenceNumber || '',
        paidAt: new Date(),
        recordedBy: actorName,
        notes: notes || ''
      })

      // Update balance
      request.invoice.balanceDue = Math.max(0, request.invoice.balanceDue - paymentAmt)
      
      const oldStatus = request.status
      if (request.invoice.balanceDue <= 0) {
        request.status = 'CLOSED' // Automatically close once paid in full and receipt is generated
      } else {
        request.status = 'PARTIALLY_PAID'
      }

      request.statusHistory.push({
        oldStatus,
        newStatus: request.status,
        actorId,
        actorName,
        comment: `Recorded payment: ₹${paymentAmt.toFixed(2)} via ${method}. Outstanding balance: ₹${request.invoice.balanceDue.toFixed(2)}. Status: ${request.status}`
      })

      await finalizeRequestWorkflow(request, { id: actorId, name: actorName, role: actorRole })
      await request.save()
      return res.status(200).json({ success: true, data: request })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })

  } catch (error) {
    console.error('Error in payments API:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
