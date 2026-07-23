import mongoose from 'mongoose'

// User Schema for CampusServe Pro
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'requester', 'manager', 'technician', 'accounts', 'vendor', 'super_admin', 'gate', 'receiving_officer', 'delivery_person', 'hod', 'staff'], 
    required: true 
  },
  name: { type: String, required: true },
  department: { type: String, required: true },
  phoneNumber: { type: String },
  eSignature: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
})

// Service Request Schema for CampusServe
const ServiceRequestSchema = new mongoose.Schema({
  requestNumber: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  assetCode: { type: String },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'], default: 'LOW' },
  emergencyReason: { type: String },
  requestedItem: { type: String },
  requestedQuantity: { type: Number, min: 1 },
  requestedUnit: { type: String, default: 'pcs' },
  adminAssessment: {
    requirementType: { type: String, enum: ['MAINTENANCE', 'REPLACEMENT', 'NEW_PURCHASE'] },
    note: { type: String },
    assessedBy: { type: String },
    assessedAt: { type: Date }
  },
  description: { type: String, required: true },
  status: { 
    type: String, 
    default: 'DRAFT' 
  },
  
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requesterName: { type: String, required: true },
  requesterEmail: { type: String, required: true },
  
  assignedManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedManagerName: { type: String },
  assignedManagerEmail: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  submittedAt: { type: Date },
  closedAt: { type: Date },
  currentOwnerRole: { type: String },
  slaDueAt: { type: Date },
  isEscalated: { type: Boolean, default: false },
  evidence: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    kind: { type: String, enum: ['ISSUE_PHOTO', 'QUOTATION', 'WORK_PHOTO', 'INVOICE', 'RECEIPT', 'OTHER'], default: 'OTHER' },
    note: { type: String },
    uploadedBy: { type: String },
    uploadedByRole: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  
  statusHistory: [{
    oldStatus: { type: String },
    newStatus: { type: String },
    actorId: { type: String },
    actorName: { type: String },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  
  inspection: {
    diagnosis: { type: String },
    recommendation: { type: String },
    estimatedDurationHours: { type: Number },
    serviceMode: { type: String, enum: ['INTERNAL_STAFF', 'EXTERNAL_VENDOR'] },
    inspectionDate: { type: Date }
  },
  
  quotation: {
    quotationNumber: { type: String },
    version: { type: Number, default: 1 },
    status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED'] },
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    additionalCharges: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    validUntil: { type: Date },
    terms: { type: String },
    createdBy: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    items: [{
      itemType: { type: String, enum: ['MATERIAL', 'LABOUR', 'SERVICE'] },
      description: { type: String, required: true },
      quantity: { type: Number, required: true },
      unit: { type: String, required: true },
      unitPrice: { type: Number, required: true },
      taxRate: { type: Number, default: 18 },
      discount: { type: Number, default: 0 },
      lineTotal: { type: Number, required: true }
    }]
  },
  
  workOrder: {
    workOrderNumber: { type: String },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    technicianName: { type: String },
    vendorId: { type: String },
    vendorName: { type: String },
    scope: { type: String },
    startDate: { type: Date },
    dueDate: { type: Date },
    approvedAmount: { type: Number },
    status: { type: String },
    declineReason: { type: String },
    updates: [{
      progressPercent: { type: Number },
      note: { type: String },
      createdBy: { type: String },
      createdAt: { type: Date, default: Date.now }
    }],
    materials: [{
      description: { type: String, required: true },
      quantity: { type: Number, required: true },
      unit: { type: String, required: true },
      unitCost: { type: Number, required: true },
      totalCost: { type: Number, required: true }
    }],
    additionalCosts: [{
      reason: { type: String },
      subtotal: { type: Number },
      taxTotal: { type: Number },
      grandTotal: { type: Number },
      status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
      requestedBy: { type: String },
      approvedBy: { type: String },
      createdAt: { type: Date, default: Date.now }
    }],
    completionReport: {
      summary: { type: String },
      completedAt: { type: Date },
      warrantyDetails: { type: String },
      recommendations: { type: String }
    }
  },
  
  requesterVerification: {
    result: { type: String, enum: ['RESOLVED', 'PARTIALLY_RESOLVED', 'UNRESOLVED'] },
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    verifiedBy: { type: String },
    verifiedAt: { type: Date }
  },
  
  invoice: {
    invoiceNumber: { type: String },
    version: { type: Number, default: 1 },
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED'] },
    createdBy: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    items: [{
      description: { type: String, required: true },
      quantity: { type: Number, required: true },
      unit: { type: String, required: true },
      unitPrice: { type: Number, required: true },
      taxRate: { type: Number, default: 18 },
      lineTotal: { type: Number, required: true }
    }]
  },
  
  payments: [{
    paymentNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT_CARD'], required: true },
    referenceNumber: { type: String },
    paidAt: { type: Date, default: Date.now },
    recordedBy: { type: String },
    notes: { type: String }
  }]
})

ServiceRequestSchema.index({ status: 1 })
ServiceRequestSchema.index({ requesterId: 1 })
ServiceRequestSchema.index({ assignedManagerId: 1 })
ServiceRequestSchema.index({ 'workOrder.technicianId': 1 })
ServiceRequestSchema.index({ currentOwnerRole: 1, slaDueAt: 1 })

// Notification Schema
const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userEmail: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  url: { type: String, default: '/' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
})

// ─── Vendor Schema ───────────────────────────────────────────────────────────
const VendorSchema = new mongoose.Schema({
  vendorCode: { type: String, required: true, unique: true },
  legalName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  taxNumber: { type: String },
  address: { type: String },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'BLACKLISTED'], default: 'ACTIVE' },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalValue: { type: Number, default: 0 },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String }
})
VendorSchema.index({ status: 1 })

// ─── Purchase Order Schema ────────────────────────────────────────────────────
const PurchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest' },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  vendorName: { type: String, required: true },
  vendorEmail: { type: String },
  version: { type: Number, default: 1 },
  status: { 
    type: String, 
    enum: ['DRAFT','SUBMITTED_FOR_APPROVAL','APPROVED','SENT_TO_VENDOR','VENDOR_ACCEPTED','ACTIVE','PARTIALLY_FULFILLED','FULFILLED','CLOSED','REVISION_REQUIRED','REJECTED','VENDOR_REJECTED','CANCELLED'],
    default: 'DRAFT'
  },
  billingAddress: { type: String, default: 'MSEC Campus, Chennai' },
  deliveryAddress: { type: String, required: true },
  deliveryLocation: { type: String },
  items: [{
    productId: { type: String, trim: true, uppercase: true },
    description: { type: String, required: true },
    specification: { type: String },
    brand: { type: String },
    model: { type: String },
    quantityOrdered: { type: Number, required: true },
    quantityAccepted: { type: Number, default: 0 },
    quantityRemaining: { type: Number },
    unit: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    taxRate: { type: Number, default: 18 },
    discount: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true }
  }],
  subtotal: { type: Number, default: 0 },
  taxTotal: { type: Number, default: 0 },
  discountTotal: { type: Number, default: 0 },
  deliveryCharge: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  expectedDeliveryDate: { type: Date },
  paymentTerms: { type: String, default: 'Net 30' },
  warrantyTerms: { type: String },
  notes: { type: String },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  vendorAcceptedAt: { type: Date },
  vendorRejectionReason: { type: String },
  documentUrl: { type: String },
  statusHistory: [{
    oldStatus: { type: String },
    newStatus: { type: String },
    actorId: { type: String },
    actorName: { type: String },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now }
  }]
})
PurchaseOrderSchema.index({ status: 1 })
PurchaseOrderSchema.index({ vendorId: 1 })
PurchaseOrderSchema.index({ requestId: 1 })

// ─── Delivery Person Schema ───────────────────────────────────────────────────
const DeliveryPersonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  idType: { type: String, enum: ['AADHAR', 'PAN', 'DRIVING_LICENSE', 'PASSPORT'], default: 'AADHAR' },
  idNumber: { type: String, required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  createdAt: { type: Date, default: Date.now }
})

// ─── Vehicle Schema ───────────────────────────────────────────────────────────
const VehicleSchema = new mongoose.Schema({
  vehicleNumber: { type: String, required: true },
  vehicleType: { type: String, enum: ['TRUCK', 'VAN', 'TEMPO', 'AUTO', 'CAR', 'BIKE', 'OTHER'], default: 'OTHER' },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  createdAt: { type: Date, default: Date.now }
})

// ─── Delivery Schedule Schema ─────────────────────────────────────────────────
const DeliveryScheduleSchema = new mongoose.Schema({
  deliveryNumber: { type: String, required: true, unique: true },
  poId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
  poNumber: { type: String },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  vendorName: { type: String },
  deliveryPersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPerson' },
  deliveryPersonName: { type: String },
  deliveryPersonPhone: { type: String },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  vehicleNumber: { type: String },
  scheduledDate: { type: Date, required: true },
  slotStart: { type: String },
  slotEnd: { type: String },
  deliveryLocation: { type: String, required: true },
  challanNumber: { type: String },
  challanUrl: { type: String },
  status: { 
    type: String,
    enum: ['SCHEDULED','PASS_GENERATED','AT_GATE','ENTRY_APPROVED','IN_INSPECTION','PARTIALLY_RECEIVED','FULLY_RECEIVED','EXIT_RECORDED','ENTRY_REJECTED','RESCHEDULED','CANCELLED','EXPIRED'],
    default: 'SCHEDULED'
  },
  qrToken: { type: String },
  qrTokenHash: { type: String },
  backupCode: { type: String },
  backupCodeHash: { type: String },
  passValidFrom: { type: Date },
  passValidUntil: { type: Date },
  passUsageCount: { type: Number, default: 0 },
  passRevoked: { type: Boolean, default: false },
  items: [{
    productId: { type: String },
    description: { type: String },
    quantityExpected: { type: Number },
    unit: { type: String }
  }],
  createdAt: { type: Date, default: Date.now },
  statusHistory: [{
    oldStatus: { type: String },
    newStatus: { type: String },
    actorId: { type: String },
    actorName: { type: String },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now }
  }]
})
DeliveryScheduleSchema.index({ poId: 1 })
DeliveryScheduleSchema.index({ status: 1 })
DeliveryScheduleSchema.index({ scheduledDate: 1 })

// ─── Gate Entry Schema ────────────────────────────────────────────────────────
const GateEntrySchema = new mongoose.Schema({
  deliveryScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliverySchedule', required: true },
  poId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  poNumber: { type: String },
  verificationMethod: { type: String, enum: ['QR', 'MANUAL_CODE'], required: true },
  decision: { type: String, enum: ['APPROVED', 'REJECTED'], required: true },
  rejectionReason: { type: String },
  securityUserId: { type: String },
  securityUserName: { type: String },
  actualDeliveryPersonName: { type: String },
  actualVehicleNumber: { type: String },
  entryTime: { type: Date, default: Date.now },
  exitTime: { type: Date },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
})
GateEntrySchema.index({ deliveryScheduleId: 1 })
GateEntrySchema.index({ entryTime: -1 })

// ─── Goods Receipt Schema ─────────────────────────────────────────────────────
const GoodsReceiptSchema = new mongoose.Schema({
  grnNumber: { type: String, required: true, unique: true },
  poId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
  poNumber: { type: String },
  deliveryScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliverySchedule' },
  grnType: { type: String, enum: ['PARTIAL', 'FINAL', 'REJECTION', 'RETURN'], required: true },
  status: { type: String, enum: ['DRAFT', 'FINALIZED'], default: 'DRAFT' },
  source: { type: String, enum: ['MANUAL', 'PO_QR'], default: 'MANUAL' },
  gateVerifiedAt: { type: Date },
  receivedBy: { type: String },
  receivedByName: { type: String },
  receivedAt: { type: Date, default: Date.now },
  remarks: { type: String },
  items: [{
    productId: { type: String },
    poItemId: { type: String },
    poItemDescription: { type: String },
    quantityOrdered: { type: Number },
    quantityPreviouslyAccepted: { type: Number, default: 0 },
    quantityDeliveredNow: { type: Number, default: 0 },
    quantityAcceptedNow: { type: Number, default: 0 },
    quantityDamaged: { type: Number, default: 0 },
    quantityRejected: { type: Number, default: 0 },
    quantityRemaining: { type: Number, default: 0 },
    unit: { type: String },
    serialNumbers: [{ type: String }],
    batchNumber: { type: String },
    expiryDate: { type: Date },
    remarks: { type: String }
  }],
  documentUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
})
GoodsReceiptSchema.index({ poId: 1 })
GoodsReceiptSchema.index({ grnType: 1 })
GoodsReceiptSchema.index({ status: 1 })

// ─── Audit Log Schema ─────────────────────────────────────────────────────────
const AuditLogSchema = new mongoose.Schema({
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  action: { type: String, required: true },
  actorId: { type: String },
  actorName: { type: String },
  actorRole: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  createdAt: { type: Date, default: Date.now }
})
AuditLogSchema.index({ entityType: 1, entityId: 1 })
AuditLogSchema.index({ actorId: 1 })
AuditLogSchema.index({ createdAt: -1 })

// ─── Email Verification Schema ───────────────────────────────────────────────
const EmailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  purpose: { type: String, required: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  lastAttemptAt: { type: Date },
  verifiedAt: { type: Date },
  sessionTokenHash: { type: String },
  sessionExpiresAt: { type: Date },
  tokenUsedAt: { type: Date },
  requestIp: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now }
})
EmailVerificationSchema.index({ email: 1, purpose: 1 })
EmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// Export all models
export const User = mongoose.models.User || mongoose.model('User', UserSchema)
export const ServiceRequest = mongoose.models.ServiceRequest || mongoose.model('ServiceRequest', ServiceRequestSchema)
export const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema)
export const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema)
export const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', PurchaseOrderSchema)
export const DeliveryPerson = mongoose.models.DeliveryPerson || mongoose.model('DeliveryPerson', DeliveryPersonSchema)
export const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', VehicleSchema)
export const DeliverySchedule = mongoose.models.DeliverySchedule || mongoose.model('DeliverySchedule', DeliveryScheduleSchema)
export const GateEntry = mongoose.models.GateEntry || mongoose.model('GateEntry', GateEntrySchema)
export const GoodsReceipt = mongoose.models.GoodsReceipt || mongoose.model('GoodsReceipt', GoodsReceiptSchema)
export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema)
export const EmailVerification = mongoose.models.EmailVerification || mongoose.model('EmailVerification', EmailVerificationSchema)
