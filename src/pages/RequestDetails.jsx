import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { getWorkflowGuidance } from '../utils/workflowGuidance'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, CheckCircle2, AlertCircle, Wrench, Download, Clock,
  Plus, Trash2, IndianRupee, FileCheck, ChevronRight, Loader2,
  AlertTriangle, Check, CheckCircle, Circle, User, Calendar, MapPin, Tag,
  Paperclip, ExternalLink, TimerReset, ShieldCheck, Pencil, ImagePlus, Eye, X, Package, RefreshCw
} from 'lucide-react'

const WORKFLOW_STEPS = [
  { key: 'DRAFT', label: 'Request draft', short: 'Draft' },
  { key: 'SUBMITTED', label: 'Admin review', short: 'Review' },
  { key: 'ASSIGNED_TO_MANAGER', label: 'PM assigned', short: 'Assigned' },
  { key: 'PURCHASE_ORDER_CREATED', label: 'Order created', short: 'Order' },
  { key: 'CLOSED', label: 'Completed', short: 'Complete' },
]

const STATUS_META = {
  DRAFT: { label: 'Draft', color: 'border-slate-200 bg-slate-100 text-slate-700' },
  SUBMITTED: { label: 'Admin Review', color: 'border-amber-200 bg-amber-50 text-amber-700' },
  ASSIGNED_TO_MANAGER: { label: 'Assigned to PM', color: 'border-blue-200 bg-blue-50 text-blue-700' },
  PURCHASE_ORDER_CREATED: { label: 'Order Created', color: 'border-violet-200 bg-violet-50 text-violet-700' },
  CLOSED: { label: 'Completed', color: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Rejected', color: 'border-rose-200 bg-rose-50 text-rose-700' },
  CANCELLED: { label: 'Cancelled', color: 'border-slate-200 bg-slate-100 text-slate-600' },
}

const statusMeta = status => STATUS_META[status] || { label: status?.replace(/_/g, ' ') || 'Unknown', color: 'border-slate-200 bg-slate-100 text-slate-600' }

const STATUS_ORDER = WORKFLOW_STEPS.map(s => s.key)

const TABS = ['Overview', 'History']

function ConfirmModal({ open, title, message, onConfirm, onCancel, loading }) {
  useEffect(() => {
    if (!open) return undefined

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    const scrollContainers = document.querySelectorAll('.layout-container')
    const previousContainerOverflow = Array.from(scrollContainers, node => node.style.overflow)

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    scrollContainers.forEach(node => { node.style.overflow = 'hidden' })

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      scrollContainers.forEach((node, index) => { node.style.overflow = previousContainerOverflow[index] })
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-6" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-amber-50 rounded-full">
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        </div>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function StatusTimeline({ currentStatus }) {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus)
  const effectiveIdx = currentIdx >= 0 ? currentIdx : -1
  const isRejected = ['REJECTED', 'CANCELLED'].includes(currentStatus)
  const isOpen = ['CLARIFICATION_REQUIRED', 'REOPENED'].includes(currentStatus)
  if (effectiveIdx < 0 && !isRejected) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Archived workflow record</p>
        <div className="mt-2 flex items-center gap-3"><Clock size={18} className="text-slate-400" /><div><p className="text-sm font-extrabold text-slate-800">{currentStatus?.replace(/_/g, ' ')}</p><p className="mt-0.5 text-xs text-slate-500">This record is read-only because it belongs to the previous workflow.</p></div></div>
      </div>
    )
  }
  const displayIdx = Math.max(0, effectiveIdx)
  const currentStep = WORKFLOW_STEPS[displayIdx]
  const nextStep = WORKFLOW_STEPS[Math.min(displayIdx + 1, WORKFLOW_STEPS.length - 1)]
  const progress = Math.round((displayIdx / (WORKFLOW_STEPS.length - 1)) * 100)

  return (
    <div className="premium-card overflow-hidden p-4 sm:p-5">
      <div className="sm:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-500">Workflow progress</p>
            <h2 className="mt-1 truncate text-base font-extrabold text-slate-900">
              {isRejected ? currentStatus.replace(/_/g, ' ') : currentStep?.label}
            </h2>
            {!isRejected && displayIdx < WORKFLOW_STEPS.length - 1 && (
              <p className="mt-0.5 text-xs text-slate-500">Next: {nextStep?.label}</p>
            )}
          </div>
          <span className="flex-shrink-0 rounded-full bg-violet-50 px-3 py-1 text-xs font-extrabold text-violet-700">
            {isRejected ? 'Stopped' : `${displayIdx + 1}/${WORKFLOW_STEPS.length}`}
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${isRejected ? 'bg-rose-500' : 'bg-gradient-to-r from-violet-600 to-fuchsia-500'}`}
            style={{ width: isRejected ? '100%' : `${Math.max(5, progress)}%` }}
          />
        </div>
      </div>

      <div className="hidden overflow-x-auto scrollbar-none sm:block">
      <div className="grid min-w-[520px] grid-cols-[repeat(5,minmax(76px,1fr))] px-1 pt-1">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isCompleted = effectiveIdx > idx && !isRejected
          const isCurrent = step.key === currentStatus || (
            currentStatus === 'SUBMITTED' && step.key === 'UNDER_ADMIN_REVIEW'
          )
          return (
            <div key={step.key} className="relative flex min-w-0 flex-col items-center">
              {idx < WORKFLOW_STEPS.length - 1 && (
                <div className={`absolute left-1/2 top-[15px] h-0.5 w-full ${isCompleted ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
              <div className={`step-dot relative z-10 ${isCompleted ? 'completed' : ''} ${isCurrent ? 'active' : ''}`} title={step.label}>
                {isCompleted ? <Check size={10} /> : <span className="text-xs">{idx + 1}</span>}
              </div>
              <span className={`mt-2 w-full truncate px-1 text-center text-[7px] font-bold uppercase tracking-wide ${
                idx === effectiveIdx ? 'text-violet-600' : 'text-slate-300'
              }`} title={step.label}>{step.short}</span>
            </div>
          )
        })}
      </div>
      </div>
      {(isRejected || isOpen) && (
        <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-bold ${
          isRejected ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {isRejected ? `Request ${currentStatus.toLowerCase()}` : `Status: ${currentStatus.replace(/_/g, ' ')}`}
        </div>
      )}
    </div>
  )
}

function ActionButton({ onClick, loading, variant = 'primary', disabled, children, className = '' }) {
  const variants = {
    primary: 'bg-violet-600 hover:bg-violet-700 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white',
    warning: 'bg-amber-600 hover:bg-amber-500 text-white',
    ghost: 'bg-violet-50 hover:bg-violet-100 border border-violet-150 text-violet-750',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${variants[variant]} px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${className}`}
    >
      {loading && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  )
}

function RequestDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showSuccess, showError } = useAlert()
  const auth = getAuthOrNull()

  const [request, setRequest] = useState(null)
  const [activeTab, setActiveTab] = useState('Overview')
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [technicians, setTechnicians] = useState([])
  const [managers, setManagers] = useState([])

  const [adminComment, setAdminComment] = useState('')
  const [assignedManagerId, setAssignedManagerId] = useState('')
  const [requirementType, setRequirementType] = useState('MAINTENANCE')

  const [diagnosis, setDiagnosis] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [estDuration, setEstDuration] = useState('4')
  const [serviceMode, setServiceMode] = useState('INTERNAL_STAFF')

  const [quoItems, setQuoItems] = useState([{ description: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 18, discount: 0, itemType: 'MATERIAL' }])
  const [quoTerms, setQuoTerms] = useState('')

  const [selectedTechId, setSelectedTechId] = useState('')
  const [woVendorName, setWoVendorName] = useState('')
  const [woScope, setWoScope] = useState('')

  const [progressPercent, setProgressPercent] = useState(0)
  const [progressNote, setProgressNote] = useState('')
  const [materialDesc, setMaterialDesc] = useState('')
  const [materialQty, setMaterialQty] = useState(1)
  const [materialUnit, setMaterialUnit] = useState('pcs')
  const [materialUnitCost, setMaterialUnitCost] = useState(0)

  const [costReason, setCostReason] = useState('')
  const [costSubtotal, setCostSubtotal] = useState(0)
  const [costTax, setCostTax] = useState(0)

  const [completionSummary, setCompletionSummary] = useState('')
  const [completionWarranty, setCompletionWarranty] = useState('')
  const [completionRecs, setCompletionRecs] = useState('')

  const [verifyResult, setVerifyResult] = useState('RESOLVED')
  const [verifyRating, setVerifyRating] = useState(5)
  const [verifyComment, setVerifyComment] = useState('')

  const [invDiscount, setInvDiscount] = useState(0)

  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState('CASH')
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')

  const [confirmModal, setConfirmModal] = useState({ open: false })
  const [evidenceName, setEvidenceName] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [evidenceKind, setEvidenceKind] = useState('ISSUE_PHOTO')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [evidenceFile, setEvidenceFile] = useState(null)
  const [previewPhoto, setPreviewPhoto] = useState(null)

  const fetchRequestDetails = async () => {
    try {
      const res = await apiClient.get(`/api/requests?id=${id}`)
      if (res.success) {
        setRequest(res.data)
        if (res.data.inspection) {
          setDiagnosis(res.data.inspection.diagnosis || '')
          setRecommendation(res.data.inspection.recommendation || '')
          setEstDuration(res.data.inspection.estimatedDurationHours || '4')
          setServiceMode(res.data.inspection.serviceMode || 'INTERNAL_STAFF')
        }
        if (res.data.quotation) {
          setQuoTerms(res.data.quotation.terms || '')
          if (res.data.quotation.items?.length > 0) setQuoItems(res.data.quotation.items)
        }
        if (res.data.invoice) {
          setInvDiscount(res.data.invoice.discountTotal || 0)
        }
      }
    } catch (err) {
      showError('Load Error', 'Failed to load request details')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchRequestDetails() }, [id])

  useEffect(() => {
    if (auth?.role === 'admin') {
      apiClient.get('/api/users?role=manager').then(res => {
        if (res.success) setManagers(res.users)
      })
    }
    if (['manager', 'admin', 'super_admin'].includes(auth?.role)) {
      apiClient.get('/api/users?role=technician').then(res => {
        if (res.success) setTechnicians(res.users)
      })
    }
  }, [auth?.role])

  const handleWorkflowAction = async (endpoint, payload, confirmMessage) => {
    if (confirmMessage) {
      setConfirmModal({
        open: true,
        title: 'Confirm Action',
        message: confirmMessage,
        onConfirm: async () => {
          setConfirmModal({ open: false })
          setActionLoading(true)
          try {
            const res = await apiClient.post(endpoint, payload)
            if (res.success) {
              showSuccess('Success', 'Action completed successfully')
              fetchRequestDetails()
              setAdminComment('')
            } else {
              showError('Failed', res.error || 'Action could not be executed')
            }
          } catch (err) {
            showError('Error', err.message || 'Connection error')
          } finally {
            setActionLoading(false)
          }
        },
        onCancel: () => setConfirmModal({ open: false })
      })
      return
    }
    setActionLoading(true)
    try {
      const res = await apiClient.post(endpoint, payload)
      if (res.success) {
        showSuccess('Success', 'Action completed successfully')
        fetchRequestDetails()
        setAdminComment('')
      } else {
        showError('Failed', res.error || 'Action could not be executed')
      }
    } catch (err) {
      showError('Error', err.message || 'Connection error')
    } finally {
      setActionLoading(false)
    }
  }

  const openPdf = (type) => {
    const origin = import.meta.env.VITE_API_URL || ''
    window.open(`${origin}/api/generate-pdf?type=${type}&id=${id}`, '_blank')
  }

  const addEvidence = async () => {
    if (!evidenceName.trim() || !evidenceUrl.trim()) {
      showError('Evidence required', 'Upload a photo or add a valid document link')
      return
    }
    await handleWorkflowAction(`/api/requests?action=add-evidence&id=${id}`, {
      name: evidenceName.trim(), url: evidenceUrl.trim(), kind: evidenceKind, note: evidenceNote.trim()
    })
    setEvidenceName('')
    setEvidenceUrl('')
    setEvidenceNote('')
    setEvidenceFile(null)
  }

  const selectEvidencePhoto = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showError('Unsupported photo', 'Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      showError('Photo is too large', 'Choose an image that is 2 MB or smaller.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setEvidenceFile({ name: file.name, preview: reader.result })
      setEvidenceName(file.name)
      setEvidenceUrl(reader.result)
      setEvidenceKind('ISSUE_PHOTO')
    }
    reader.onerror = () => showError('Photo upload failed', 'This image could not be read. Please try another file.')
    reader.readAsDataURL(file)
  }

  const addQuoItem = () => setQuoItems([...quoItems, { description: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 18, discount: 0, itemType: 'MATERIAL' }])
  const removeQuoItem = (i) => setQuoItems(quoItems.filter((_, idx) => idx !== i))
  const handleQuoItemChange = (i, field, val) => { const n = [...quoItems]; n[i][field] = val; setQuoItems(n) }

  const getTabDot = (tab) => {
    if (!request) return false
    if (tab === 'Overview' && ['SUBMITTED', 'APPROVED', 'REOPENED', 'CLARIFICATION_REQUIRED'].includes(request.status)) return true
    if (tab === 'Diagnosis' && ['ASSIGNED_TO_MANAGER'].includes(request.status) && auth?.role === 'manager') return true
    if (tab === 'Quotation' && ['QUOTATION_IN_PROGRESS', 'QUOTATION_REVISION_REQUIRED', 'QUOTATION_SUBMITTED'].includes(request.status)) return true
    if (tab === 'Work Order' && ['QUOTATION_APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'].includes(request.status)) return true
    if (tab === 'Invoice' && ['SERVICE_VERIFIED', 'INVOICE_SUBMITTED', 'INVOICE_REVISION_REQUIRED'].includes(request.status)) return true
    if (tab === 'Payments' && ['PAYMENT_PENDING', 'PARTIALLY_PAID'].includes(request.status)) return true
    return false
  }

  const nextAction = getWorkflowGuidance(request?.status, auth?.role)
  const visibleTabs = TABS

  const isRequestOwner = request && String(request.requesterId) === String(auth?.id)
  const canManageRequest = isRequestOwner
  const submittedAt = request?.submittedAt || request?.createdAt
  const canEditRequest = canManageRequest && (
    ['DRAFT', 'CLARIFICATION_REQUIRED'].includes(request?.status) ||
    (request?.status === 'SUBMITTED' && submittedAt && Date.now() - new Date(submittedAt).getTime() <= 24 * 60 * 60 * 1000)
  )

  const deleteRequest = () => {
    setConfirmModal({
      open: true,
      title: 'Delete request permanently?',
      message: `This will permanently delete ${request.requestNumber} and its history. This action cannot be undone.`,
      onCancel: () => setConfirmModal({ open: false }),
      onConfirm: async () => {
        setActionLoading(true)
        try {
          const res = await apiClient.del(`/api/requests?id=${id}`)
          if (res?.success) {
            showSuccess('Request deleted', 'The request was removed successfully.')
            navigate('/requests', { replace: true })
          }
        } catch (err) {
          showError('Delete failed', err.message || 'Could not delete this request')
        } finally {
          setActionLoading(false)
          setConfirmModal({ open: false })
        }
      }
    })
  }

  if (isLoading || !request) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-12 rounded-xl" />
        <div className="skeleton h-16 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ConfirmModal {...confirmModal} loading={actionLoading} />

      {/* Back + Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button onClick={() => navigate('/requests')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-all font-semibold">
          <ArrowLeft size={16} /> Back to Requests
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEditRequest && (
            <button type="button" onClick={() => navigate(`/requests/${id}/edit`)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100">
              <Pencil size={13} /> Edit
            </button>
          )}
          {canManageRequest && (
            <button type="button" onClick={deleteRequest} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">
              <Trash2 size={13} /> Delete
            </button>
          )}
          <span className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide ${statusMeta(request.status).color}`}>{statusMeta(request.status).label}</span>
        </div>
      </div>

      {/* Status Timeline */}
      <StatusTimeline currentStatus={request.status} />

      {/* Role-aware handoff */}
      <section className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
        nextAction.isMyTurn
          ? 'border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50'
          : 'border-slate-200 bg-white'
      }`} aria-labelledby="next-action-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`mt-0.5 rounded-xl p-2.5 ${nextAction.isMyTurn ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {request.status === 'CLOSED' ? <CheckCircle2 size={18} /> : nextAction.isMyTurn ? <AlertCircle size={18} /> : <Clock size={18} />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                {nextAction.isMyTurn ? 'Your next action' : nextAction.ownerLabel ? `Waiting for ${nextAction.ownerLabel}` : 'Current outcome'}
              </p>
              <h2 id="next-action-title" className="mt-1 text-sm font-extrabold text-slate-900 sm:text-base">{nextAction.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{nextAction.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab(nextAction.tab)}
            className={`inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              nextAction.isMyTurn ? 'bg-violet-600 text-white hover:bg-violet-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {nextAction.isMyTurn ? 'Open required action' : 'View request details'} <ChevronRight size={14} />
          </button>
        </div>
      </section>

      {/* Hero Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <span className="text-xs font-mono text-violet-600 font-bold tracking-wider">{request.requestNumber}</span>
            <h1 className="mt-1 break-words text-xl font-black text-slate-800 sm:text-2xl">{request.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><MapPin size={12} /> {request.location}</span>
              <span className="flex items-center gap-1"><User size={12} /> {request.requesterName}</span>
              <span className="flex items-center gap-1"><Tag size={12} /> {request.category}</span>
              <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(request.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            request.priority === 'EMERGENCY' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
            request.priority === 'HIGH' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
            request.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
            'bg-slate-100 text-slate-600'
          }`}>
            {request.priority}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">
            <ShieldCheck size={12} /> Owner: {(request.currentOwnerRole || nextAction.ownerLabel || 'Complete').toString().replace(/_/g, ' ')}
          </span>
          {request.slaDueAt && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${request.isEscalated ? 'bg-rose-100 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
              <TimerReset size={12} /> {request.isEscalated ? 'SLA overdue' : `Due ${formatDistanceToNow(new Date(request.slaDueAt), { addSuffix: true })}`}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">
            <ShieldCheck size={12} /> Official audit trail enabled
          </span>
        </div>
      </div>

      {/* Evidence register */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="evidence-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-500">Official record</p>
            <h2 id="evidence-title" className="mt-1 text-sm font-extrabold text-slate-900">Evidence & documents</h2>
            <p className="mt-1 text-xs text-slate-500">Upload issue photos for visual proof, or attach secure links for documents and receipts.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{request.evidence?.length || 0} attached</span>
        </div>

        {request.evidence?.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {request.evidence.map((item, index) => {
              const isPhoto = ['ISSUE_PHOTO', 'WORK_PHOTO'].includes(item.kind) || item.url?.startsWith('data:image/')
              return isPhoto ? (
                <button key={item._id || `${item.url}-${index}`} type="button" onClick={() => setPreviewPhoto(item)} className="interactive-surface group overflow-hidden rounded-xl bg-white text-left hover:-translate-y-0.5">
                  <div className="relative aspect-video overflow-hidden bg-slate-100">
                    <img src={item.url} alt={item.name || 'Request evidence'} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-white opacity-0 transition-all group-hover:bg-slate-950/35 group-hover:opacity-100"><Eye size={24} /></span>
                    <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-violet-700 shadow-sm">{(item.kind || 'PHOTO').replace(/_/g, ' ')}</span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-xs font-bold text-slate-800">{item.name}</p>
                    <p className="mt-1 truncate text-[10px] text-slate-400">{item.uploadedBy || 'College user'}{item.note ? ` · ${item.note}` : ''}</p>
                  </div>
                </button>
              ) : (
                <a key={item._id || `${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="interactive-surface group flex min-w-0 items-start gap-3 rounded-xl p-3">
                  <div className="rounded-lg bg-violet-100 p-2 text-violet-700"><Paperclip size={14} /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{item.name}</p><p className="mt-0.5 text-[10px] font-semibold text-violet-600">{(item.kind || 'OTHER').replace(/_/g, ' ')}</p><p className="mt-1 truncate text-[10px] text-slate-400">{item.uploadedBy || 'College user'}{item.note ? ` · ${item.note}` : ''}</p></div>
                  <ExternalLink size={13} className="mt-1 text-slate-400 group-hover:text-violet-600" />
                </a>
              )
            })}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-4 py-7 text-center">
            <ImagePlus size={26} className="text-slate-300" />
            <p className="mt-2 text-xs font-bold text-slate-600">No evidence attached yet</p>
            <p className="mt-1 text-[11px] text-slate-400">Upload a clear issue photo below to help the maintenance team.</p>
          </div>
        )}

        {!['CLOSED', 'CANCELLED'].includes(request.status) && isRequestOwner && (
          <div className="mt-4 grid gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-200 bg-white px-4 py-4 text-xs font-bold text-violet-700 transition-all hover:border-violet-400 hover:bg-violet-50 sm:col-span-2 lg:col-span-5">
              <ImagePlus size={18} /> {evidenceFile ? 'Choose a different photo' : 'Upload issue photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectEvidencePhoto} className="sr-only" />
            </label>
            {evidenceFile && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2 sm:col-span-2 lg:col-span-5">
                <img src={evidenceFile.preview} alt="Selected evidence" className="h-14 w-20 rounded-lg object-cover" />
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700">{evidenceFile.name}</p><p className="mt-0.5 text-[10px] text-emerald-700">Ready to attach · maximum 2 MB</p></div>
                <button type="button" onClick={() => { setEvidenceFile(null); setEvidenceName(''); setEvidenceUrl('') }} aria-label="Remove selected photo" className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-rose-600"><X size={16} /></button>
              </div>
            )}
            <input aria-label="Evidence name" value={evidenceName} onChange={e => setEvidenceName(e.target.value)} placeholder="Document name" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-violet-500" />
            <input aria-label="Evidence link" type="url" value={evidenceFile ? '' : evidenceUrl} disabled={Boolean(evidenceFile)} onChange={e => setEvidenceUrl(e.target.value)} placeholder={evidenceFile ? 'Photo selected above' : 'Or paste a secure document link'} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-violet-500 disabled:bg-slate-100 lg:col-span-2" />
            <select aria-label="Evidence type" value={evidenceKind} onChange={e => setEvidenceKind(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-violet-500">
              <option value="ISSUE_PHOTO">Issue photo</option><option value="WORK_PHOTO">Work photo</option><option value="INVOICE">Invoice</option><option value="RECEIPT">Receipt</option><option value="OTHER">Other</option>
            </select>
            <button type="button" onClick={addEvidence} disabled={actionLoading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"><Paperclip size={13} /> {actionLoading ? 'Attaching...' : 'Attach evidence'}</button>
            <input aria-label="Evidence note" value={evidenceNote} onChange={e => setEvidenceNote(e.target.value)} placeholder="Optional note" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-violet-500 sm:col-span-2 lg:col-span-5" />
          </div>
        )}
      </section>

      {previewPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => setPreviewPhoto(null)}>
          <div className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <button type="button" onClick={() => setPreviewPhoto(null)} aria-label="Close photo preview" className="absolute right-3 top-3 z-10 rounded-full bg-slate-950/70 p-2 text-white hover:bg-slate-950"><X size={20} /></button>
            <img src={previewPhoto.url} alt={previewPhoto.name || 'Evidence preview'} className="max-h-[78vh] w-full bg-slate-950 object-contain" />
            <div className="p-4 sm:p-5"><p className="text-sm font-extrabold text-slate-900">{previewPhoto.name}</p><p className="mt-1 text-xs text-slate-500">{(previewPhoto.kind || 'PHOTO').replace(/_/g, ' ')} · {previewPhoto.uploadedBy || 'College user'}{previewPhoto.note ? ` · ${previewPhoto.note}` : ''}</p></div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="request-detail-tabs mobile-edge-scroll flex snap-x snap-mandatory gap-2 overflow-x-auto border-b border-slate-200 pb-1 scrollbar-none sm:gap-1">
        {visibleTabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`request-detail-tab relative flex-shrink-0 snap-start whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-all sm:-mb-px sm:px-5 ${
              activeTab === tab ? 'border-violet-600 text-violet-600 bg-violet-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {tab}
            {getTabDot(tab) && <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-violet-500 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">

        {/* OVERVIEW */}
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 text-left">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{request.description}</p>
                {request.requestedItem && (
                  <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-500">Item / service required</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{request.requestedItem}</p>
                    <p className="mt-1 text-xs text-slate-500">Quantity: <span className="font-bold text-slate-700">{request.requestedQuantity} {request.requestedUnit || 'pcs'}</span></p>
                  </div>
                )}
                {request.emergencyReason && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs mt-4">
                    <strong>Emergency Reason:</strong> {request.emergencyReason}
                  </div>
                )}
              </div>

              {auth?.role === 'manager' && request.status === 'ASSIGNED_TO_MANAGER' && String(request.assignedManagerId) === String(auth?.id) && (
                <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 text-left shadow-sm sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-violet-600 p-2.5 text-white"><FileCheck size={18} /></div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-500">Purchase manager action</p>
                      <h3 className="mt-1 text-base font-extrabold text-slate-900">Create the fulfilment order</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">Use the confirmed requirement below to prepare the vendor order and official PDF.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-violet-100 bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order purpose</p><p className="mt-1 text-xs font-extrabold text-violet-700">{request.adminAssessment?.requirementType?.replace(/_/g, ' ') || 'Service requirement'}</p></div>
                    <div className="rounded-xl border border-violet-100 bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Item / service</p><p className="mt-1 text-xs font-extrabold text-slate-800">{request.requestedItem || request.title}</p></div>
                    <div className="rounded-xl border border-violet-100 bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quantity</p><p className="mt-1 text-xs font-extrabold text-slate-800">{request.requestedQuantity || 1} {request.requestedUnit || 'pcs'}</p></div>
                  </div>
                  {request.adminAssessment?.note && <p className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-600"><strong>Admin note:</strong> {request.adminAssessment.note}</p>}
                  <button type="button" onClick={() => navigate(`/purchase-orders?requestId=${id}`)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700">
                    <FileCheck size={16} /> Create Order & PDF <ChevronRight size={15} />
                  </button>
                </div>
              )}

              {/* Requester Verification */}
              {false && auth?.role === 'requester' && request.status === 'TECHNICIAN_COMPLETED' && (
                <div className="bg-white p-6 rounded-xl border border-rose-200 shadow-sm space-y-4 text-left">
                  <h3 className="text-sm font-bold text-rose-700 uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle size={16} /> Verify Completion
                  </h3>
                  <p className="text-xs text-slate-500">The technician has marked this complete. Please verify.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2">Result</label>
                      <select value={verifyResult} onChange={e => setVerifyResult(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none">
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="PARTIALLY_RESOLVED">PARTIALLY RESOLVED</option>
                        <option value="UNRESOLVED">UNRESOLVED</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2">Rating</label>
                      <input type="number" min="1" max="5" value={verifyRating} onChange={e => setVerifyRating(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none" />
                    </div>
                  </div>
                  <textarea rows={3} placeholder="Feedback notes..." value={verifyComment} onChange={e => setVerifyComment(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none resize-none" />
                  <ActionButton onClick={() => handleWorkflowAction(`/api/requests?action=verify&id=${id}`, { result: verifyResult, rating: verifyRating, comment: verifyComment }, 'Submit verification report?')} loading={actionLoading}>
                    Submit Verification
                  </ActionButton>
                </div>
              )}

              {/* Admin triage: classify the need and assign a manager */}
              {['admin', 'super_admin'].includes(auth?.role) && request.status === 'SUBMITTED' && (
                <div className="space-y-5 rounded-xl border border-violet-200 bg-white p-5 text-left shadow-sm sm:p-6">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-500">Admin triage</p>
                    <h3 className="mt-1 text-base font-extrabold text-slate-900">Verify the requirement and assign a manager</h3>
                    <p className="mt-1 text-xs text-slate-500">Review the request details and evidence, then identify how the requirement should be handled.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      ['MAINTENANCE', 'Maintenance / service', 'Repair or service the existing asset', Wrench],
                      ['REPLACEMENT', 'Replacement', 'Replace a damaged or unusable asset', RefreshCw],
                      ['NEW_PURCHASE', 'New purchase', 'Procure a new item or facility', Package],
                    ].map(([value, label, description, Icon]) => (
                      <button key={value} type="button" onClick={() => setRequirementType(value)} className={`rounded-xl border p-4 text-left transition-all ${requirementType === value ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
                        <span className={`mb-3 inline-flex rounded-lg p-2 ${requirementType === value ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon size={16} /></span>
                        <span className="block text-sm font-extrabold text-slate-800">{label}</span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">{description}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Assign manager <span className="text-rose-500">*</span></label>
                      <select value={assignedManagerId} onChange={e => setAssignedManagerId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500">
                        <option value="">Select an active manager</option>
                        {managers.map(m => <option key={m._id} value={m._id}>{m.name} ({m.department})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Assessment note <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span></label>
                      <textarea rows={2} placeholder="Add useful context for the manager..." value={adminComment} onChange={e => setAdminComment(e.target.value)} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
                    </div>
                  </div>
                  <ActionButton onClick={() => handleWorkflowAction(`/api/requests?action=triage&id=${id}`, { requirementType, managerId: assignedManagerId, note: adminComment }, 'Confirm classification and assign this manager?')} disabled={!assignedManagerId} loading={actionLoading} className="w-full sm:w-auto">
                    Verify & Assign Manager
                  </ActionButton>
                </div>
              )}

              {/* Reopened */}
              {false && auth?.role === 'super_admin' && request.status === 'REOPENED' && (
                <div className="bg-white p-6 rounded-xl border border-rose-200 shadow-sm space-y-4 text-left">
                  <h3 className="text-sm font-bold text-rose-700 uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle size={16} /> Request Reopened
                  </h3>
                  <textarea rows={2} placeholder="Decision notes..." value={adminComment} onChange={e => setAdminComment(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none resize-none" />
                  <div className="flex flex-wrap gap-2">
                    <ActionButton variant="success" onClick={() => handleWorkflowAction(`/api/requests?action=approve&id=${id}`, { comment: adminComment || 'Re-approved' }, 'Re-approve this request?')} loading={actionLoading}>
                      Re-Approve
                    </ActionButton>
                    <ActionButton variant="danger" onClick={() => handleWorkflowAction(`/api/requests?action=reject&id=${id}`, { comment: adminComment || 'Closed' }, 'Close this request?')} loading={actionLoading}>
                      Close
                    </ActionButton>
                  </div>
                </div>
              )}

              {/* Clarification Required */}
              {false && auth?.role === 'requester' && request.status === 'CLARIFICATION_REQUIRED' && (
                <div className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm space-y-4 text-left">
                  <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle size={16} /> Clarification Required
                  </h3>
                  <p className="text-xs text-slate-500">Admin has requested additional information.</p>
                  <ActionButton onClick={() => handleWorkflowAction(`/api/requests?action=submit&id=${id}`, { comment: 'Resubmitted after clarification' }, 'Resubmit for review?')} loading={actionLoading}>
                    Resubmit for Review
                  </ActionButton>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6 text-left">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 text-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">Details</h3>
                {[
                  ['Category', request.category],
                  ['Asset Code', request.assetCode || 'N/A'],
                  ['Required Qty', request.requestedItem ? `${request.requestedQuantity} ${request.requestedUnit || 'pcs'}` : 'N/A'],
                  ['Requirement', request.adminAssessment?.requirementType ? request.adminAssessment.requirementType.replace(/_/g, ' ') : 'Pending triage'],
                  ['Created', new Date(request.createdAt).toLocaleDateString()],
                  ['Manager', request.assignedManagerName || 'Unassigned'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-500 font-medium">{label}</span>
                    <span className="text-slate-800 font-bold text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DIAGNOSIS */}
        {activeTab === 'Diagnosis' && (
          <div className="mx-auto w-full max-w-xl space-y-5 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm sm:space-y-6 sm:p-8">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2 bg-violet-50 rounded-lg text-violet-600"><Wrench size={18} /></div>
              <h3 className="text-base font-bold text-slate-800">Diagnostic Assessment</h3>
            </div>
            {request.inspection ? (
              <div className="space-y-4 text-sm text-slate-700">
                <div>
                  <strong className="text-slate-400 font-bold block mb-1">Diagnosis:</strong>
                  <p className="bg-slate-50 p-3 rounded border border-slate-100 leading-relaxed text-xs">{request.inspection.diagnosis}</p>
                </div>
                <div>
                  <strong className="text-slate-400 font-bold block mb-1">Recommendation:</strong>
                  <p className="bg-slate-50 p-3 rounded border border-slate-100 leading-relaxed text-xs">{request.inspection.recommendation}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div><strong className="text-slate-400 font-bold block mb-0.5">Duration:</strong><span className="text-slate-800 font-semibold">{request.inspection.estimatedDurationHours}h</span></div>
                  <div><strong className="text-slate-400 font-bold block mb-0.5">Mode:</strong><span className="text-slate-800 font-semibold capitalize">{request.inspection.serviceMode.replace(/_/g, ' ')}</span></div>
                </div>
              </div>
            ) : auth?.role === 'manager' && request.status === 'ASSIGNED_TO_MANAGER' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">Diagnosis *</label>
                  <textarea rows={3} placeholder="Diagnostic analysis..." value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">Recommendation *</label>
                  <textarea rows={3} placeholder="Recommendation..." value={recommendation} onChange={e => setRecommendation(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none resize-none" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">Est. Hours</label>
                    <input type="number" value={estDuration} onChange={e => setEstDuration(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">Service Mode</label>
                    <select value={serviceMode} onChange={e => setServiceMode(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none">
                      <option value="INTERNAL_STAFF">Internal</option>
                      <option value="EXTERNAL_VENDOR">External Vendor</option>
                    </select>
                  </div>
                </div>
                <ActionButton onClick={() => handleWorkflowAction(`/api/requests?action=inspect&id=${id}`, { diagnosis, recommendation, estimatedDurationHours: estDuration, serviceMode }, 'Submit diagnosis report?')} loading={actionLoading} className="w-full">
                  Submit Diagnosis
                </ActionButton>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">No inspection data available.</div>
            )}
          </div>
        )}

        {/* QUOTATION */}
        {activeTab === 'Quotation' && (
          <div className="space-y-6">
            {auth?.role === 'super_admin' && request.status === 'QUOTATION_SUBMITTED' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 text-left">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Budget Approval</h3>
                <textarea rows={2} placeholder="Approval notes..." value={adminComment} onChange={e => setAdminComment(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none resize-none" />
                <div className="flex gap-2">
                  <ActionButton variant="success" onClick={() => handleWorkflowAction(`/api/quotations?action=approve&id=${id}`, { comment: adminComment }, 'Approve quotation?')} loading={actionLoading}>Approve</ActionButton>
                  <ActionButton variant="primary" onClick={() => handleWorkflowAction(`/api/quotations?action=revise&id=${id}`, { comment: adminComment })} loading={actionLoading}>Request Revision</ActionButton>
                  <ActionButton variant="danger" onClick={() => handleWorkflowAction(`/api/quotations?action=reject&id=${id}`, { comment: adminComment }, 'Reject quotation?')} loading={actionLoading}>Reject</ActionButton>
                </div>
              </div>
            )}

            {request.quotation ? (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 text-left">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-xs text-slate-400 font-mono">{request.quotation.quotationNumber}</span>
                    <h3 className="text-base font-bold text-slate-800">v{request.quotation.version}</h3>
                  </div>
                  <ActionButton variant="ghost" onClick={() => openPdf('quotation')}><Download size={14} /> PDF</ActionButton>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <th className="pb-2">Type</th><th className="pb-2">Description</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Price</th><th className="pb-2 text-right">Tax</th><th className="pb-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {request.quotation.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 capitalize text-xs">{item.itemType.toLowerCase()}</td>
                          <td className="py-2.5 font-semibold text-slate-800">{item.description}</td>
                          <td className="py-2.5 text-right text-xs">{item.quantity} {item.unit}</td>
                          <td className="py-2.5 text-right text-xs">₹{item.unitPrice.toFixed(2)}</td>
                          <td className="py-2.5 text-right text-xs">{item.taxRate}%</td>
                          <td className="py-2.5 text-right font-bold text-slate-800 text-xs">₹{item.lineTotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end pt-4 border-t border-slate-100 text-sm">
                  <div className="space-y-1 text-right">
                    <div className="text-xs text-slate-500">Subtotal: ₹{request.quotation.subtotal.toFixed(2)}</div>
                    <div className="text-xs text-slate-500">Tax: ₹{request.quotation.taxTotal.toFixed(2)}</div>
                    <div className="text-violet-700 font-bold">Total: ₹{request.quotation.grandTotal.toFixed(2)}</div>
                  </div>
                </div>
                {auth?.role === 'manager' && request.status === 'QUOTATION_IN_PROGRESS' && (
                  <ActionButton onClick={() => handleWorkflowAction(`/api/quotations?action=submit&id=${id}`, {}, 'Submit quotation for approval?')} loading={actionLoading}>
                    Submit Quotation
                  </ActionButton>
                )}
              </div>
            ) : null}

            {auth?.role === 'manager' && (['QUOTATION_IN_PROGRESS', 'QUOTATION_REVISION_REQUIRED'].includes(request.status) || !request.quotation) && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 text-left">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Build Estimate</h3>
                <div className="space-y-4">
                  {quoItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                        <select value={item.itemType} onChange={e => handleQuoItemChange(idx, 'itemType', e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none">
                          <option value="MATERIAL">Material</option><option value="LABOUR">Labour</option><option value="SERVICE">Service</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                        <input type="text" placeholder="Description..." value={item.description} onChange={e => handleQuoItemChange(idx, 'description', e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qty</label>
                        <input type="number" value={item.quantity} onChange={e => handleQuoItemChange(idx, 'quantity', e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price (₹)</label>
                        <input type="number" value={item.unitPrice} onChange={e => handleQuoItemChange(idx, 'unitPrice', e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none" />
                      </div>
                      <button type="button" onClick={() => removeQuoItem(idx)} className="p-2 text-rose-600 hover:bg-rose-50 rounded border border-rose-100 mt-5 bg-rose-50"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={addQuoItem} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-bold">
                    <Plus size={14} /> Add Line Item
                  </button>
                  <div className="pt-4 border-t border-slate-200">
                    <ActionButton onClick={() => handleWorkflowAction(`/api/quotations?requestId=${id}`, { items: quoItems, terms: quoTerms })} loading={actionLoading}>
                      Save Draft
                    </ActionButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WORK ORDER */}
        {activeTab === 'Work Order' && (
          <div className="space-y-6">
            {auth?.role === 'manager' && request.status === 'QUOTATION_APPROVED' && !request.workOrder?.workOrderNumber && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 text-left">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Create Work Order</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">Technician</label>
                    <select value={selectedTechId} onChange={e => setSelectedTechId(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none">
                      <option value="">Select...</option>
                      {technicians.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">Vendor (if external)</label>
                    <input type="text" placeholder="Vendor name..." value={woVendorName} onChange={e => setWoVendorName(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">Scope of Work</label>
                  <textarea rows={3} placeholder="Details..." value={woScope} onChange={e => setWoScope(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none resize-none" />
                </div>
                <ActionButton onClick={() => handleWorkflowAction(`/api/work-orders?requestId=${id}`, { technicianId: selectedTechId, vendorName: woVendorName, scope: woScope }, 'Issue work order?')} loading={actionLoading}>
                  Issue Work Order
                </ActionButton>
              </div>
            )}

            {request.workOrder?.workOrderNumber ? (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 text-left">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-xs text-slate-400 font-mono">{request.workOrder.workOrderNumber}</span>
                    <h3 className="text-base font-bold text-slate-800">Work Order</h3>
                  </div>
                  <ActionButton variant="ghost" onClick={() => openPdf('workorder')}><Download size={14} /> PDF</ActionButton>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-2">
                    <div><strong>Technician:</strong> {request.workOrder.technicianName || 'External'}</div>
                    {request.workOrder.vendorName && <div><strong>Vendor:</strong> {request.workOrder.vendorName}</div>}
                    <div><strong>Budget:</strong> ₹{request.workOrder.approvedAmount?.toFixed(2)}</div>
                  </div>
                  <div>
                    <strong>Scope:</strong>
                    <p className="bg-slate-50 p-3 rounded border border-slate-100 text-xs mt-1">{request.workOrder.scope}</p>
                  </div>
                </div>

                {['manager', 'admin', 'super_admin'].includes(auth?.role) && request.status === 'WORK_DECLINED' && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-800">Assignment declined</h4>
                    <p className="mt-1 text-xs text-amber-700">{request.workOrder.declineReason || 'No reason recorded.'}</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <select aria-label="Replacement technician" value={selectedTechId} onChange={e => setSelectedTechId(e.target.value)} className="flex-1 rounded-lg border border-amber-200 bg-white p-2.5 text-xs outline-none focus:border-violet-500">
                        <option value="">Select replacement technician</option>
                        {technicians.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                      </select>
                      <ActionButton disabled={!selectedTechId} onClick={() => handleWorkflowAction(`/api/work-orders?action=reassign&id=${id}`, { technicianId: selectedTechId }, 'Reassign this work order?')} loading={actionLoading}>Reassign Work</ActionButton>
                    </div>
                  </div>
                )}

                {/* Additional Costs */}
                {request.workOrder.additionalCosts?.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Additional Costs</h4>
                    <div className="space-y-3">
                      {request.workOrder.additionalCosts.map(c => (
                        <div key={c._id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded">
                          <div>
                            <div className="text-xs font-bold text-slate-700">{c.reason}</div>
                            <div className="text-xs text-slate-400">{c.requestedBy}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold">₹{c.grandTotal.toFixed(2)}</span>
                            {c.status === 'PENDING' && auth?.role === 'admin' ? (
                              <div className="flex gap-1.5">
                                <ActionButton variant="success" onClick={() => handleWorkflowAction(`/api/work-orders?action=approve-cost&id=${id}&costId=${c._id}`, {}, 'Approve cost?')} loading={actionLoading} className="text-xs py-1 px-2">Approve</ActionButton>
                                <ActionButton variant="danger" onClick={() => handleWorkflowAction(`/api/work-orders?action=reject-cost&id=${id}&costId=${c._id}`, {}, 'Reject cost?')} loading={actionLoading} className="text-xs py-1 px-2">Reject</ActionButton>
                              </div>
                            ) : (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${c.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : c.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{c.status}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Materials */}
                {request.workOrder.materials?.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Materials</h4>
                    <ul className="text-xs divide-y divide-slate-50">
                      {request.workOrder.materials.map((m, idx) => (
                        <li key={idx} className="flex justify-between py-2">
                          <span>{m.description} (×{m.quantity})</span>
                          <span className="font-bold">₹{m.totalCost.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Technician Actions */}
                {auth?.role === 'technician' && String(request.workOrder.technicianId) === String(auth?.id) && (
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <h4 className="text-xs font-bold text-violet-600 uppercase tracking-wider">Work Center</h4>

                    {request.status === 'TECHNICIAN_ASSIGNED' && (
                      <div className="flex gap-2">
                        <ActionButton variant="success" onClick={() => handleWorkflowAction(`/api/work-orders?action=accept&id=${id}`, {}, 'Accept this assignment?')} loading={actionLoading}>Accept</ActionButton>
                        <ActionButton variant="danger" onClick={() => {
                          const reason = prompt('Decline reason:')
                          if (reason) handleWorkflowAction(`/api/work-orders?action=decline&id=${id}`, { reason })
                        }} loading={actionLoading}>Decline</ActionButton>
                      </div>
                    )}

                    {['WORK_ACCEPTED', 'PAUSED'].includes(request.status) && (
                      <ActionButton onClick={() => handleWorkflowAction(`/api/work-orders?action=start&id=${id}`, {}, 'Start work?')} loading={actionLoading}>Start Work</ActionButton>
                    )}

                    {['IN_PROGRESS', 'ADDITIONAL_COST_PENDING'].includes(request.status) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="space-y-3">
                          <h5 className="text-xs font-bold text-slate-800">Progress Update</h5>
                          <div className="grid grid-cols-4 gap-2">
                            <input type="number" placeholder="%" value={progressPercent} onChange={e => setProgressPercent(e.target.value)} className="bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none" />
                            <input type="text" placeholder="Note..." value={progressNote} onChange={e => setProgressNote(e.target.value)} className="col-span-3 bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none" />
                          </div>
                          <ActionButton variant="ghost" onClick={() => handleWorkflowAction(`/api/work-orders?action=update&id=${id}`, { progressPercent, note: progressNote })} loading={actionLoading} className="text-xs py-1.5">Post Update</ActionButton>

                          <div className="border-t border-slate-200 pt-3 space-y-2">
                            <h5 className="text-xs font-bold text-slate-800">Add Material</h5>
                            <input type="text" placeholder="Material name..." value={materialDesc} onChange={e => setMaterialDesc(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none" />
                            <div className="grid grid-cols-2 gap-2">
                              <input type="number" placeholder="Qty" value={materialQty} onChange={e => setMaterialQty(e.target.value)} className="bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none" />
                              <input type="number" placeholder="Cost/unit ₹" value={materialUnitCost} onChange={e => setMaterialUnitCost(e.target.value)} className="bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none" />
                            </div>
                            <ActionButton variant="ghost" onClick={() => handleWorkflowAction(`/api/work-orders?action=material&id=${id}`, { description: materialDesc, quantity: materialQty, unit: materialUnit, unitCost: materialUnitCost })} loading={actionLoading} className="text-xs py-1.5">Add Material</ActionButton>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="text-xs font-bold text-slate-800">Extra Budget</h5>
                          <input type="text" placeholder="Reason..." value={costReason} onChange={e => setCostReason(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none" />
                          <input type="number" placeholder="Amount ₹" value={costSubtotal} onChange={e => setCostSubtotal(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none" />
                          <ActionButton variant="ghost" onClick={() => handleWorkflowAction(`/api/work-orders?action=additional-cost&id=${id}`, { reason: costReason, subtotal: costSubtotal, taxTotal: costTax })} loading={actionLoading} className="text-xs py-1.5">Submit Cost Request</ActionButton>

                          <div className="border-t border-slate-200 pt-3 space-y-2">
                            <h5 className="text-xs font-bold text-slate-800">Complete</h5>
                            <textarea rows={2} placeholder="Summary..." value={completionSummary} onChange={e => setCompletionSummary(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none resize-none" />
                            <ActionButton variant="success" onClick={() => handleWorkflowAction(`/api/work-orders?action=complete&id=${id}`, { summary: completionSummary, warrantyDetails: completionWarranty, recommendations: completionRecs }, 'Mark as complete?')} loading={actionLoading} className="w-full">
                              Complete Work
                            </ActionButton>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">No work order yet.</div>
            )}
          </div>
        )}

        {/* INVOICE */}
        {activeTab === 'Invoice' && (
          <div className="space-y-6">
            {auth?.role === 'super_admin' && request.status === 'INVOICE_SUBMITTED' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 text-left">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Invoice Review</h3>
                <textarea rows={2} placeholder="Notes..." value={adminComment} onChange={e => setAdminComment(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none resize-none" />
                <div className="flex gap-2">
                  <ActionButton variant="success" onClick={() => handleWorkflowAction(`/api/invoices?action=approve&id=${id}`, { comment: adminComment }, 'Approve invoice?')} loading={actionLoading}>Approve</ActionButton>
                  <ActionButton variant="primary" onClick={() => handleWorkflowAction(`/api/invoices?action=revise&id=${id}`, { comment: adminComment })} loading={actionLoading}>Revision</ActionButton>
                  <ActionButton variant="danger" onClick={() => handleWorkflowAction(`/api/invoices?action=reject&id=${id}`, { comment: adminComment }, 'Reject invoice?')} loading={actionLoading}>Reject</ActionButton>
                </div>
              </div>
            )}

            {request.invoice?.invoiceNumber ? (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 text-left">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-xs text-slate-400 font-mono">{request.invoice.invoiceNumber}</span>
                    <h3 className="text-base font-bold text-slate-800">v{request.invoice.version}</h3>
                  </div>
                  <ActionButton variant="ghost" onClick={() => openPdf('invoice')}><Download size={14} /> PDF</ActionButton>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <th className="pb-2">Description</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Price</th><th className="pb-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {request.invoice.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 font-semibold text-slate-800">{item.description}</td>
                          <td className="py-2.5 text-right text-xs">{item.quantity} {item.unit}</td>
                          <td className="py-2.5 text-right text-xs">₹{item.unitPrice.toFixed(2)}</td>
                          <td className="py-2.5 text-right font-bold text-slate-800 text-xs">₹{item.lineTotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end pt-4 border-t border-slate-100 text-sm">
                  <div className="space-y-1 text-right">
                    <div className="text-xs text-slate-500">Subtotal: ₹{request.invoice.subtotal.toFixed(2)}</div>
                    <div className="text-xs text-slate-500">Tax: ₹{request.invoice.taxTotal.toFixed(2)}</div>
                    <div className="text-violet-700 font-bold">Due: ₹{request.invoice.grandTotal.toFixed(2)}</div>
                    <div className="text-emerald-600 font-bold text-xs">Balance: ₹{request.invoice.balanceDue.toFixed(2)}</div>
                  </div>
                </div>
                {auth?.role === 'manager' && request.status === 'INVOICE_IN_PROGRESS' && (
                  <ActionButton onClick={() => handleWorkflowAction(`/api/invoices?action=submit&id=${id}`, {}, 'Submit invoice?')} loading={actionLoading}>Submit Invoice</ActionButton>
                )}
              </div>
            ) : null}

            {auth?.role === 'manager' && ['SERVICE_VERIFIED', 'INVOICE_REVISION_REQUIRED'].includes(request.status) && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 text-left">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Generate Invoice</h3>
                <ActionButton onClick={() => {
                  const items = []
                  if (request.quotation) request.quotation.items.forEach(i => items.push({ description: i.description, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice, taxRate: i.taxRate }))
                  if (request.workOrder?.materials) request.workOrder.materials.forEach(m => items.push({ description: `Material: ${m.description}`, quantity: m.quantity, unit: m.unit, unitPrice: m.unitCost }))
                  handleWorkflowAction(`/api/invoices?requestId=${id}`, { items }, 'Import quotation & create invoice?')
                }} loading={actionLoading}>
                  Import & Draft Invoice
                </ActionButton>
              </div>
            )}
          </div>
        )}

        {/* PAYMENTS */}
        {activeTab === 'Payments' && (
          <div className="space-y-6">
            {(auth?.role === 'accounts' || auth?.role === 'super_admin') && ['PAYMENT_PENDING', 'PARTIALLY_PAID'].includes(request.status) && request.invoice?.status === 'APPROVED' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 text-left">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Record Payment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">Amount (₹)</label>
                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">Method</label>
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none">
                      <option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">Reference</label>
                    <input type="text" placeholder="Ref number..." value={payRef} onChange={e => setPayRef(e.target.value)} className="w-full bg-slate-100 border-none rounded-lg p-2.5 text-sm focus:outline-none" />
                  </div>
                </div>
                <ActionButton onClick={() => handleWorkflowAction(`/api/payments?id=${id}`, { amount: payAmount, method: payMethod, referenceNumber: payRef, notes: payNotes }, 'Record payment?')} loading={actionLoading}>
                  Record Payment
                </ActionButton>
              </div>
            )}

            {request.payments?.length > 0 ? (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 text-left">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Payment History</h3>
                  <ActionButton variant="ghost" onClick={() => openPdf('receipt')}><Download size={14} /> Receipt</ActionButton>
                </div>
                <div className="space-y-3">
                  {request.payments.map(p => (
                    <div key={p._id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">{p.paymentNumber}</div>
                        <div className="text-xs text-slate-400">{p.method} · {p.referenceNumber || 'N/A'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-600 text-sm">₹{p.amount.toFixed(2)}</div>
                        <div className="text-xs text-slate-400">{new Date(p.paidAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">No payments recorded.</div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {activeTab === 'History' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 text-left">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">Audit Trail</h3>
            <div className="space-y-4 relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {request.statusHistory?.map((h, idx) => (
                <div key={idx} className="relative space-y-1">
                  <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-violet-600 ring-4 ring-white" />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span className="font-bold text-violet-600 uppercase tracking-wide">{h.newStatus.replace(/_/g, ' ')}</span>
                    <span>{formatDistanceToNow(new Date(h.createdAt), { addSuffix: true })}</span>
                  </div>
                  <div className="text-sm text-slate-700">
                    <span className="font-bold text-slate-800">{h.actorName}</span>: {h.comment || 'Status updated'}
                  </div>
                </div>
              ))}
              {(!request.statusHistory || request.statusHistory.length === 0) && (
                <div className="text-center py-6 text-slate-400 text-xs">No history records.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RequestDetails
