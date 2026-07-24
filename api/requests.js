import { connectToDatabase } from '../lib/mongo.js'
import { ServiceRequest, User } from '../models.js'
import { calculateSlaDueAt, finalizeRequestWorkflow } from '../lib/workflowEngine.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in requests API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  const userId = req.user ? req.user.id : (req.headers['x-user-id'] || '')
  const userRole = req.user ? req.user.role : (req.headers['x-user-role'] || '')

  try {
    if (req.method === 'GET') {
      const { id, status, priority, category, summary } = req.query

      // 1. Fetch single request by ID
      if (id) {
        const request = await ServiceRequest.findById(id).lean()
        if (!request) return res.status(404).json({ success: false, error: 'Request not found' })
        request.isEscalated = Boolean(request.slaDueAt && new Date(request.slaDueAt) < new Date() && !['CLOSED', 'REJECTED', 'CANCELLED'].includes(request.status))
        return res.status(200).json({ success: true, data: request })
      }

      // 2. Fetch list of requests
      const filter = {}
      if (status) filter.status = status
      if (priority) filter.priority = priority
      if (category) filter.category = category

      // Role-based filtering
      if (['requester', 'hod', 'staff'].includes(userRole)) {
        filter.requesterId = userId
      } else if (userRole === 'manager') {
        // Managers see their assigned requests, or approved requests waiting for assignment
        filter.$or = [
          { assignedManagerId: userId },
          { status: 'APPROVED' }
        ]
      } else if (userRole === 'technician') {
        filter['workOrder.technicianId'] = userId
      }

      let requestsQuery = ServiceRequest.find(filter).sort({ createdAt: -1 })
      if (summary === 'dashboard') {
        requestsQuery = requestsQuery
          .select('requestNumber title priority status updatedAt createdAt slaDueAt')
          .limit(8)
      } else {
        // List screens do not need large base64 evidence or embedded document payloads.
        requestsQuery = requestsQuery.select('-evidence.url -invoice.documentUrl')
      }
      const requests = await requestsQuery.lean()
      const now = Date.now()
      const data = requests.map(item => ({ ...item, isEscalated: Boolean(item.slaDueAt && new Date(item.slaDueAt).getTime() < now && !['CLOSED', 'REJECTED', 'CANCELLED'].includes(item.status)) }))
      return res.status(200).json({ success: true, data })
    }

    if (req.method === 'POST') {
      const { action, id } = req.query
      const actorId = req.user ? req.user.id : (req.headers['x-user-id'] || 'system')
      
      const actor = req.user || await User.findById(actorId).lean()
      const actorName = actor ? actor.name : 'Unknown User'

      // 1. Create New Request
      if (!action) {
        const { title, category, location, assetCode, priority, emergencyReason, requestedItem, requestedQuantity, requestedUnit, description, evidence, submitImmediately } = req.body

        if (!title || !category || !location || !requestedItem || !description) {
          return res.status(400).json({ success: false, error: 'Missing required fields' })
        }
        if (!Number.isInteger(Number(requestedQuantity)) || Number(requestedQuantity) < 1) {
          return res.status(400).json({ success: false, error: 'Quantity must be a whole number of 1 or more' })
        }
        const validEvidence = Array.isArray(evidence) ? evidence.filter(item =>
          item?.name && typeof item.url === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(item.url)
        ).slice(0, 1) : []
        if (Array.isArray(evidence) && evidence.length > 0 && validEvidence.length === 0) {
          return res.status(400).json({ success: false, error: 'The selected photo could not be saved. Use a JPG, PNG, or WebP image up to 2 MB.' })
        }

        const requester = await User.findById(actorId).lean()
        if (!requester) return res.status(404).json({ success: false, error: 'Requester user not found' })

        const year = new Date().getFullYear()
        const randomNum = Math.floor(Math.random() * 900000) + 100000
        const requestNumber = `REQ-${year}-${randomNum}`

        const status = submitImmediately ? 'SUBMITTED' : 'DRAFT'

        const newRequest = new ServiceRequest({
          requestNumber,
          title,
          category,
          location,
          assetCode,
          priority: priority || 'LOW',
          emergencyReason,
          requestedItem: requestedItem.trim(),
          requestedQuantity: Number(requestedQuantity),
          requestedUnit: requestedUnit || 'pcs',
          description,
          evidence: validEvidence.map(item => ({ ...item, uploadedBy: requester.name, uploadedByRole: userRole })),
          status,
          currentOwnerRole: submitImmediately ? 'admin' : 'requester',
          slaDueAt: calculateSlaDueAt(priority || 'LOW', status),
          requesterId: requester._id,
          requesterName: requester.name,
          requesterEmail: requester.email,
          statusHistory: [{
            oldStatus: '',
            newStatus: status,
            actorId: requester._id.toString(),
            actorName: requester.name,
            comment: submitImmediately ? 'Request submitted' : 'Request drafted'
          }]
        })

        await finalizeRequestWorkflow(newRequest, { id: actorId, name: requester.name, role: userRole })
        await newRequest.save()
        return res.status(201).json({ success: true, data: newRequest })
      }

      // Action operations require a request ID
      if (!id) {
        return res.status(400).json({ success: false, error: 'Request ID is required' })
      }

      const request = await ServiceRequest.findById(id)
      if (!request) {
        return res.status(404).json({ success: false, error: 'Request not found' })
      }

      const oldStatus = request.status

      const isAdmin = userRole === 'super_admin'
      const isOwner = String(request.requesterId) === String(actorId)
      const isAssignedManager = String(request.assignedManagerId || '') === String(actorId)
      const requireStatus = (allowedStatuses) => {
        if (allowedStatuses.includes(request.status)) return null
        return res.status(409).json({
          success: false,
          error: `Action '${action}' is not available while the request is ${request.status.replace(/_/g, ' ').toLowerCase()}`
        })
      }

      // Role-based authorization for privileged actions
      const privilegedActions = {
        'approve': ['super_admin'],
        'reject': ['super_admin'],
        'clarify': ['super_admin'],
        'triage': ['admin', 'super_admin'],
        'assign-manager': ['super_admin'],
        'inspect': ['super_admin'],
        'verify': ['requester', 'hod', 'staff', 'super_admin'],
        'add-evidence': ['requester', 'hod', 'staff', 'super_admin', 'manager', 'technician', 'accounts']
      }
      if (privilegedActions[action]) {
        const allowed = privilegedActions[action]
        if (!allowed.includes(userRole)) {
          return res.status(403).json({ success: false, error: `Action '${action}' requires one of these roles: ${allowed.join(', ')}` })
        }
      }

      if (['submit', 'cancel'].includes(action) && !isOwner && !isAdmin) {
        return res.status(403).json({ success: false, error: 'Only the requester or an administrator can perform this action' })
      }
      if (action === 'inspect' && !isAdmin && !isAssignedManager) {
        return res.status(403).json({ success: false, error: 'Only the assigned manager can inspect this request' })
      }
      if (action === 'verify' && !isAdmin && !isOwner) {
        return res.status(403).json({ success: false, error: 'Only the original requester can verify completion' })
      }

      if (action === 'submit') {
        const invalid = requireStatus(['DRAFT', 'CLARIFICATION_REQUIRED'])
        if (invalid) return invalid
        request.status = 'SUBMITTED'
        request.submittedAt = new Date()
        request.statusHistory.push({
          oldStatus,
          newStatus: 'SUBMITTED',
          actorId,
          actorName,
          comment: 'Request submitted for admin review'
        })
      } 
      else if (action === 'cancel') {
        const invalid = requireStatus(['DRAFT', 'SUBMITTED', 'CLARIFICATION_REQUIRED'])
        if (invalid) return invalid
        request.status = 'CANCELLED'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'CANCELLED',
          actorId,
          actorName,
          comment: req.body.comment || 'Request cancelled by user'
        })
      } 
      else if (action === 'approve') {
        const invalid = requireStatus(['SUBMITTED', 'REOPENED'])
        if (invalid) return invalid
        request.status = 'APPROVED'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'APPROVED',
          actorId,
          actorName,
          comment: req.body.comment || 'Request approved'
        })
      } 
      else if (action === 'reject') {
        const invalid = requireStatus(['SUBMITTED', 'REOPENED'])
        if (invalid) return invalid
        if (!req.body.comment) return res.status(400).json({ success: false, error: 'Rejection comment is required' })
        request.status = 'REJECTED'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'REJECTED',
          actorId,
          actorName,
          comment: req.body.comment
        })
      } 
      else if (action === 'clarify') {
        const invalid = requireStatus(['SUBMITTED'])
        if (invalid) return invalid
        if (!req.body.comment) return res.status(400).json({ success: false, error: 'Clarification details are required' })
        request.status = 'CLARIFICATION_REQUIRED'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'CLARIFICATION_REQUIRED',
          actorId,
          actorName,
          comment: req.body.comment
        })
      } 
      else if (action === 'assign-manager') {
        const invalid = requireStatus(['APPROVED'])
        if (invalid) return invalid
        const { managerId } = req.body
        if (!managerId) return res.status(400).json({ success: false, error: 'Manager ID is required' })
        
        const manager = await User.findById(managerId).lean()
        if (!manager || manager.role !== 'manager') return res.status(404).json({ success: false, error: 'Manager user not found' })

        request.assignedManagerId = manager._id
        request.assignedManagerName = manager.name
        request.assignedManagerEmail = manager.email
        request.status = 'ASSIGNED_TO_MANAGER'
        
        request.statusHistory.push({
          oldStatus,
          newStatus: 'ASSIGNED_TO_MANAGER',
          actorId,
          actorName,
          comment: `Assigned to manager: ${manager.name}`
        })
      } 
      else if (action === 'triage') {
        const invalid = requireStatus(['SUBMITTED'])
        if (invalid) return invalid
        const { requirementType, managerId, note } = req.body
        if (!['MAINTENANCE', 'REPLACEMENT', 'NEW_PURCHASE'].includes(requirementType)) {
          return res.status(400).json({ success: false, error: 'Select maintenance, replacement, or new purchase' })
        }
        if (!managerId) return res.status(400).json({ success: false, error: 'Manager is required' })
        const manager = await User.findById(managerId).lean()
        if (!manager || manager.role !== 'manager' || manager.isActive === false) {
          return res.status(404).json({ success: false, error: 'Select an active manager' })
        }
        request.adminAssessment = {
          requirementType,
          note: note?.trim() || '',
          assessedBy: actorName,
          assessedAt: new Date()
        }
        request.assignedManagerId = manager._id
        request.assignedManagerName = manager.name
        request.assignedManagerEmail = manager.email
        request.status = 'ASSIGNED_TO_MANAGER'
        request.currentOwnerRole = 'manager'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'ASSIGNED_TO_MANAGER',
          actorId,
          actorName,
          comment: `Admin classified this as ${requirementType.replace(/_/g, ' ').toLowerCase()} and assigned manager ${manager.name}${note ? `. Note: ${note.trim()}` : ''}`
        })
      }
      else if (action === 'inspect') {
        const invalid = requireStatus(['ASSIGNED_TO_MANAGER'])
        if (invalid) return invalid
        const { diagnosis, recommendation, estimatedDurationHours, serviceMode } = req.body
        if (!diagnosis || !recommendation || !serviceMode) {
          return res.status(400).json({ success: false, error: 'Missing inspection details' })
        }

        request.inspection = {
          diagnosis,
          recommendation,
          estimatedDurationHours: Number(estimatedDurationHours || 0),
          serviceMode,
          inspectionDate: new Date()
        }
        request.status = 'QUOTATION_IN_PROGRESS'
        
        request.statusHistory.push({
          oldStatus,
          newStatus: 'QUOTATION_IN_PROGRESS',
          actorId,
          actorName,
          comment: `Inspection completed. Diagnosis: ${diagnosis}`
        })
      } 
      else if (action === 'verify') {
        const invalid = requireStatus(['TECHNICIAN_COMPLETED'])
        if (invalid) return invalid
        const { result, rating, comment } = req.body
        const numericRating = Number(rating)
        if (!['RESOLVED', 'PARTIALLY_RESOLVED', 'UNRESOLVED'].includes(result) || !Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
          return res.status(400).json({ success: false, error: 'Verification result and rating are required' })
        }

        request.requesterVerification = {
          result,
          rating: numericRating,
          comment,
          verifiedBy: actorName,
          verifiedAt: new Date()
        }

        if (result === 'UNRESOLVED') {
          request.status = 'REOPENED'
        } else {
          request.status = 'SERVICE_VERIFIED'
        }

        request.statusHistory.push({
          oldStatus,
          newStatus: request.status,
          actorId,
          actorName,
          comment: `Requester verification: ${result}. Feedback: ${comment || 'None'}`
        })
      } 
      else if (action === 'add-evidence') {
        const { name, url, kind, note } = req.body
        if (!name || !url) return res.status(400).json({ success: false, error: 'Evidence name and URL are required' })
        const isImageData = /^data:image\/(jpeg|png|webp);base64,/.test(url)
        let safeUrl = url
        if (!isImageData) {
          let parsed
          try { parsed = new URL(url) } catch { return res.status(400).json({ success: false, error: 'Evidence must be an uploaded image or a valid link' }) }
          if (!['https:', 'http:'].includes(parsed.protocol)) return res.status(400).json({ success: false, error: 'Evidence URL must use HTTP or HTTPS' })
          safeUrl = parsed.toString()
        }
        request.evidence.push({ name: name.trim(), url: safeUrl, kind: kind || 'OTHER', note: note || '', uploadedBy: actorName, uploadedByRole: userRole })
        request.statusHistory.push({ oldStatus, newStatus: oldStatus, actorId, actorName, comment: `Evidence attached: ${name.trim()}` })
      }
      else {
        return res.status(400).json({ success: false, error: 'Invalid action' })
      }

      await finalizeRequestWorkflow(request, { id: actorId, name: actorName, role: userRole })
      await request.save()
      return res.status(200).json({ success: true, data: request })
    }

    // Edit drafts, clarification requests, or submitted requests during the first 24 hours
    if (req.method === 'PATCH') {
      const { id } = req.query
      if (!id) return res.status(400).json({ success: false, error: 'Request ID is required' })

      const request = await ServiceRequest.findById(id)
      if (!request) return res.status(404).json({ success: false, error: 'Request not found' })

      if (String(request.requesterId) !== String(userId)) {
        return res.status(403).json({ success: false, error: 'Only the original requester can edit this request' })
      }

      const submittedAt = request.submittedAt || request.createdAt
      const submittedWithin24Hours = request.status === 'SUBMITTED' &&
        Date.now() - new Date(submittedAt).getTime() <= 24 * 60 * 60 * 1000
      if (!['DRAFT', 'CLARIFICATION_REQUIRED'].includes(request.status) && !submittedWithin24Hours) {
        return res.status(400).json({ success: false, error: 'Submitted requests can only be edited within 24 hours of submission' })
      }

      const allowedFields = ['title', 'category', 'location', 'assetCode', 'priority', 'emergencyReason', 'requestedItem', 'requestedQuantity', 'requestedUnit', 'description']
      allowedFields.forEach(field => {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) request[field] = req.body[field]
      })
      if (Array.isArray(req.body.evidence) && req.body.evidence.length > 0) {
        const uploadedPhoto = req.body.evidence.find(item =>
          item?.name && typeof item.url === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(item.url)
        )
        if (!uploadedPhoto) {
          return res.status(400).json({ success: false, error: 'The selected photo could not be saved. Use a JPG, PNG, or WebP image up to 2 MB.' })
        }
        const existingNonIssueEvidence = request.evidence.filter(item => item.kind !== 'ISSUE_PHOTO')
        request.evidence = [
          ...existingNonIssueEvidence,
          {
            name: uploadedPhoto.name.trim(),
            url: uploadedPhoto.url,
            kind: 'ISSUE_PHOTO',
            note: uploadedPhoto.note || 'Attached from the request form',
            uploadedBy: req.user?.name || request.requesterName,
            uploadedByRole: userRole
          }
        ]
      }
      if (!request.title?.trim() || !request.category || !request.location?.trim() || !request.requestedItem?.trim() || !request.description?.trim()) {
        return res.status(400).json({ success: false, error: 'Missing required fields' })
      }
      if (!Number.isInteger(Number(request.requestedQuantity)) || Number(request.requestedQuantity) < 1) {
        return res.status(400).json({ success: false, error: 'Quantity must be a whole number of 1 or more' })
      }
      request.statusHistory.push({
        oldStatus: request.status,
        newStatus: request.status,
        actorId: userId,
        actorName: req.user?.name || 'Requester',
        comment: 'Request details edited'
      })
      await request.save()

      return res.status(200).json({ success: true, data: request })
    }

    // Only the original requester may permanently delete their own request.
    if (req.method === 'DELETE') {
      const { id } = req.query
      if (!id) return res.status(400).json({ success: false, error: 'Request ID is required' })

      const request = await ServiceRequest.findById(id)
      if (!request) return res.status(404).json({ success: false, error: 'Request not found' })

      if (String(request.requesterId) !== String(userId)) {
        return res.status(403).json({ success: false, error: 'Only the original requester can delete this request' })
      }

      await ServiceRequest.deleteOne({ _id: request._id })
      return res.status(200).json({ success: true, message: 'Request deleted successfully' })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })

  } catch (error) {
    console.error('Error in requests API:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
