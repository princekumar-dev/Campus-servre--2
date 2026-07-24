import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { ArrowLeft, Send, CheckCircle, XCircle, RefreshCw, Package, Truck, FileText, Clock, AlertCircle, Download, Upload, Eye, ShieldCheck } from 'lucide-react'

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'bg-zinc-100 text-zinc-700 border-zinc-300 ring-1 ring-zinc-200', step: 0 },
  SUBMITTED_FOR_APPROVAL: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-800 border-amber-300 ring-1 ring-amber-200', step: 1 },
  APPROVED: { label: 'Approved', color: 'bg-sky-100 text-sky-800 border-sky-300 ring-1 ring-sky-200', step: 2 },
  SENT_TO_VENDOR: { label: 'Sent to Vendor', color: 'bg-violet-100 text-violet-800 border-violet-300 ring-1 ring-violet-200', step: 2 },
  VENDOR_ACCEPTED: { label: 'Vendor Accepted', color: 'bg-cyan-100 text-cyan-800 border-cyan-300 ring-1 ring-cyan-200', step: 2 },
  ACTIVE: { label: 'Verified & Active', color: 'bg-lime-100 text-lime-800 border-lime-300 ring-1 ring-lime-200', step: 2 },
  PARTIALLY_FULFILLED: { label: 'Partially Fulfilled', color: 'bg-indigo-100 text-indigo-800 border-indigo-300 ring-1 ring-indigo-200', step: 3 },
  FULFILLED: { label: 'Fulfilled', color: 'bg-teal-100 text-teal-800 border-teal-300 ring-1 ring-teal-200', step: 4 },
  CLOSED: { label: 'Closed', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-1 ring-emerald-200', step: 5 },
  REVISION_REQUIRED: { label: 'Revision Required', color: 'bg-orange-100 text-orange-800 border-orange-300 ring-1 ring-orange-200', step: 1 },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-300 ring-1 ring-red-200', step: -1 },
  VENDOR_REJECTED: { label: 'Vendor Rejected', color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300 ring-1 ring-fuchsia-200', step: -1 },
  CANCELLED: { label: 'Cancelled', color: 'bg-slate-200 text-slate-700 border-slate-400 ring-1 ring-slate-300', step: -1 },
}

const poSteps = ['Draft', 'Signed PO Uploaded', 'Verified & Active', 'Partial Receipt', 'GRN Fulfilled', 'Closed']

function StatusTimeline({ currentStatus }) {
  const cfg = statusConfig[currentStatus] || {}
  const currentStep = cfg.step ?? 0
  const isTerminal = ['REJECTED', 'VENDOR_REJECTED', 'CANCELLED'].includes(currentStatus)

  return (
    <div className="premium-kpi p-5">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">PO Progress</h3>
      <div className="flex items-center space-x-1">
        {poSteps.map((step, idx) => (
          <div key={step} className="flex items-center flex-1">
            <div className={`flex flex-col items-center flex-1 ${idx < poSteps.length - 1 ? 'relative' : ''}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                isTerminal ? 'bg-rose-100 text-rose-600 border-2 border-rose-300' :
                idx < currentStep ? 'bg-violet-600 text-white' :
                idx === currentStep ? 'bg-violet-600 text-white ring-2 ring-violet-300 ring-offset-1 scale-110' :
                'bg-slate-100 text-slate-400 border-2 border-slate-200'
              }`}>
                {isTerminal ? '×' : idx < currentStep ? '✓' : idx + 1}
              </div>
              <span className={`text-[11px] mt-1 font-bold text-center w-full leading-tight ${idx <= currentStep && !isTerminal ? 'text-violet-700' : 'text-slate-400'}`}>
                {step}
              </span>
              {idx < poSteps.length - 1 && (
                <div className={`absolute left-1/2 top-3 h-0.5 w-full -z-10 ${idx < currentStep && !isTerminal ? 'bg-violet-500' : 'bg-slate-200'}`} style={{ left: '50%', width: 'calc(100% - 1.5rem)' }} />
              )}
            </div>
          </div>
        ))}
      </div>
      {isTerminal && (
        <div className="mt-3 text-center text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
          {statusConfig[currentStatus]?.label}
        </div>
      )}
    </div>
  )
}

export default function PurchaseOrderDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [po, setPo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [signedUpload, setSignedUpload] = useState(null)
  const [activeTab, setActiveTab] = useState('Overview')
  const [signedPhotoOpen, setSignedPhotoOpen] = useState(false)
  const { showSuccess, showError } = useAlert()
  const auth = getAuthOrNull()

  const isAdmin = ['admin', 'super_admin'].includes(auth?.role)
  const isManager = auth?.role === 'manager'

  const fetchPO = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get(`/api/purchase-orders?id=${id}`)
      if (res.success) setPo(res.data)
      else showError('Not Found', res.error)
    } catch (err) { showError('Error', err.message) }
    finally { setIsLoading(false) }
  }, [id, showError])

  useEffect(() => { fetchPO() }, [fetchPO])
  useEffect(() => {
    if (!signedPhotoOpen) return undefined
    const closeOnEscape = event => { if (event.key === 'Escape') setSignedPhotoOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [signedPhotoOpen])

  const doAction = async (action, payload = {}) => {
    setActionLoading(true)
    try {
      const res = await apiClient.post(`/api/purchase-orders?id=${id}&action=${action}`, payload)
      if (res.success) { showSuccess('Success', `PO ${action.replace(/-/g, ' ')} completed`); fetchPO(); setComment(''); return true }
      showError('Action Failed', res.error)
    } catch (err) { showError('Error', err.message) }
    finally { setActionLoading(false) }
    return false
  }

  const selectSignedPoPhoto = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return showError('Invalid Photo', 'Use a JPG, PNG, or WebP image of the signed PO')
    }
    if (file.size > 4 * 1024 * 1024) {
      return showError('Photo Too Large', 'The signed PO photo must be 4 MB or smaller')
    }
    const reader = new FileReader()
    reader.onerror = () => showError('Upload Failed', 'The selected photo could not be read')
    reader.onload = () => setSignedUpload({
      name: file.name,
      url: String(reader.result),
      mimeType: file.type,
      size: file.size
    })
    reader.readAsDataURL(file)
  }

  const uploadSignedPo = async () => {
    if (!signedUpload) return showError('Photo Required', 'Select the signed official PO photo first')
    const completed = await doAction('upload-signed-po', { document: signedUpload })
    if (completed) setSignedUpload(null)
  }

  const downloadPdf = async () => {
    if (pdfLoading || !po) return
    setPdfLoading(true)
    try {
      const blob = await apiClient.get(`/api/generate-pdf?type=purchase-order&id=${id}&template=academics-marksheet-v2&t=${Date.now()}`, {
        cache: false,
        dedupe: false,
        responseType: 'blob',
        timeout: 120000
      })
      if (!(blob instanceof Blob) || blob.size === 0) throw new Error('The generated PDF was empty')
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `${po.poNumber || 'purchase-order'}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      showSuccess('PDF Downloaded', `${po.poNumber}.pdf is ready`)
    } catch (err) {
      showError('PDF Download Failed', err.message || 'Unable to generate the purchase order PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-violet-500" /></div>
  if (!po) return <div className="text-center py-20 text-slate-400">PO not found</div>

  const tabs = ['Overview', 'Items', 'Signed PO', 'History']
  const cfg = statusConfig[po.status] || {}

  return (
    <div className="space-y-6 animate-fadeIn">
      {signedPhotoOpen && po.signedPo?.url && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Full signed purchase order photo" onClick={() => setSignedPhotoOpen(false)}>
          <div className="relative flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-800">{po.signedPo.name || 'Signed official PO'}</p>
                <p className="text-xs text-slate-500">Full uploaded attachment</p>
              </div>
              <button type="button" onClick={() => setSignedPhotoOpen(false)} aria-label="Close full photo" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                <XCircle size={22} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 text-center">
              <img src={po.signedPo.url} alt="Full signed official purchase order" className="mx-auto h-auto max-w-full rounded-lg bg-white object-contain shadow-sm" />
            </div>
          </div>
        </div>
      )}
      {/* Back */}
      <button onClick={() => navigate('/purchase-orders')} className="flex items-center space-x-2 text-sm text-slate-500 hover:text-slate-700 transition-all font-semibold">
        <ArrowLeft size={16} /><span>Back to Purchase Orders</span>
      </button>

      {/* Hero */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <span className="text-xs font-mono text-violet-600 font-bold">{po.poNumber}</span>
          <h1 className="text-xl font-black text-slate-800 mt-1">{po.vendorName}</h1>
          <p className="text-sm text-slate-500">Created by {po.createdBy} · {new Date(po.createdAt).toLocaleDateString('en-IN')}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button type="button" onClick={downloadPdf} disabled={pdfLoading} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60">
            {pdfLoading ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
            {pdfLoading ? 'Preparing PDF...' : 'Download PDF'}
          </button>
          <div className="text-right">
            <div className="text-xs text-slate-400">Grand Total</div>
            <div className="text-2xl font-black text-violet-700">₹{(po.grandTotal || 0).toFixed(2)}</div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${cfg.color}`}>{cfg.label || po.status}</span>
        </div>
      </div>

      {/* Status Timeline */}
      <StatusTimeline currentStatus={po.status} />

      {/* Workflow Action Cards */}
      {isManager && (
        ['DRAFT', 'REVISION_REQUIRED'].includes(po.status) ||
        (['ACTIVE', 'PARTIALLY_FULFILLED'].includes(po.status) && po.signedPo?.status !== 'VERIFIED')
      ) && (
        <div className="bg-white p-6 rounded-xl border border-violet-200 shadow-sm space-y-4 text-left">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><Upload size={17} className="text-violet-600" />Upload Signed Official PO</h3>
            <p className="mt-1 text-xs text-slate-500">Download the PO, obtain the required official signatures, then upload a clear photo for admin verification.</p>
          </div>
          {po.status === 'REVISION_REQUIRED' && po.signedPo?.verificationComment && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><strong>Previous upload rejected:</strong> {po.signedPo.verificationComment}</div>
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/60 p-5 text-sm font-bold text-violet-700 hover:bg-violet-50">
            <Upload size={18} />
            <span>{signedUpload ? 'Choose another photo' : 'Select signed PO photo'}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectSignedPoPhoto} className="hidden" />
          </label>
          {signedUpload && (
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
              <img src={signedUpload.url} alt="Signed PO preview" className="h-28 w-full rounded-lg bg-slate-50 object-contain sm:w-40" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{signedUpload.name}</p><p className="text-xs text-slate-500">{(signedUpload.size / 1024 / 1024).toFixed(2)} MB</p></div>
              <button onClick={uploadSignedPo} disabled={actionLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50">
                <Send size={14} />{actionLoading ? 'Uploading...' : 'Upload for Verification'}
              </button>
            </div>
          )}
        </div>
      )}

      {isAdmin && po.status === 'SUBMITTED_FOR_APPROVAL' && po.signedPo?.url && (
        <div className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm space-y-4 text-left">
          <h3 className="text-sm font-bold text-amber-700 flex items-center space-x-2"><ShieldCheck size={16} /><span>Verify Signed Official PO</span></h3>
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
            <img src={po.signedPo.url} alt="Uploaded signed PO" className="h-36 w-full rounded-lg bg-slate-50 object-contain sm:w-48" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{po.signedPo.name}</p>
              <p className="mt-1 text-xs text-slate-500">Uploaded by {po.signedPo.uploadedBy} · {new Date(po.signedPo.uploadedAt).toLocaleString('en-IN')}</p>
              <button type="button" onClick={() => setSignedPhotoOpen(true)} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-violet-700"><Eye size={14} />Open full photo</button>
            </div>
          </div>
          <textarea rows={2} placeholder="Verification notes or rejection reason..." value={comment} onChange={e => setComment(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-violet-400 resize-none" />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => doAction('verify-signed-po', { comment })} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50">✓ Verify & Activate PO</button>
            <button onClick={() => doAction('reject-signed-po', { comment })} disabled={actionLoading || !comment.trim()} className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50">✗ Reject Photo</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto space-x-1 border-b border-slate-200 pb-px">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-px ${activeTab === tab ? 'border-violet-600 text-violet-600 bg-violet-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Details</h3>
            {[
              { label: 'PO Number', value: po.poNumber },
              { label: 'Vendor', value: po.vendorName },
              { label: 'Delivery Address', value: po.deliveryAddress },
              { label: 'Payment Terms', value: po.paymentTerms },
              { label: 'Expected Delivery', value: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-IN') : '—' },
              { label: 'Approved By', value: po.approvedBy || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-500">{label}</span>
                <span className="font-bold text-slate-800 text-right max-w-xs">{value}</span>
              </div>
            ))}
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Financial Summary</h3>
            {[
              { label: 'Subtotal', value: `₹${(po.subtotal || 0).toFixed(2)}` },
              { label: 'Discount', value: `-₹${(po.discountTotal || 0).toFixed(2)}` },
              { label: 'GST / Tax', value: `₹${(po.taxTotal || 0).toFixed(2)}` },
              { label: 'Delivery Charge', value: `₹${(po.deliveryCharge || 0).toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-500">{label}</span>
                <span className="font-semibold text-slate-700">{value}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm border-t border-slate-100 pt-3">
              <span className="font-bold text-slate-800">Grand Total</span>
              <span className="font-black text-violet-700 text-base">₹{(po.grandTotal || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Items' && (
        <div className="premium-card overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Line Items ({po.items?.length || 0})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Product ID</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3 text-right">Ordered</th>
                  <th className="px-6 py-3 text-right">Accepted</th>
                  <th className="px-6 py-3 text-right">Remaining</th>
                  <th className="px-6 py-3 text-right">Unit Price</th>
                  <th className="px-6 py-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(po.items || []).map((item, idx) => {
                  const remaining = item.quantityRemaining ?? item.quantityOrdered
                  const progress = ((item.quantityOrdered - remaining) / item.quantityOrdered) * 100
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs font-bold text-violet-700">{item.productId || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{item.description}</div>
                        {item.specification && <div className="text-xs text-slate-400 mt-0.5">{item.specification}</div>}
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 bg-slate-100 rounded-full w-32">
                          <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{progress.toFixed(0)}% received</div>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600">{item.quantityOrdered} {item.unit}</td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-semibold">{item.quantityAccepted || 0}</td>
                      <td className="px-6 py-4 text-right"><span className={`font-bold ${remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{remaining}</span></td>
                      <td className="px-6 py-4 text-right text-slate-600">₹{(item.unitPrice || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-800">₹{(item.lineTotal || 0).toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Signed PO' && (
        <div className="premium-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h3 className="font-bold text-slate-800">Signed Official Purchase Order</h3>
              <p className="mt-1 text-xs text-slate-500">This verified artifact controls whether gate receiving and GRN creation are permitted.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${
              po.signedPo?.status === 'VERIFIED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
              po.signedPo?.status === 'PENDING_VERIFICATION' ? 'border-amber-200 bg-amber-50 text-amber-700' :
              po.signedPo?.status === 'REJECTED' ? 'border-rose-200 bg-rose-50 text-rose-700' :
              'border-slate-200 bg-slate-50 text-slate-500'
            }`}>{po.signedPo?.status?.replace(/_/g, ' ') || 'NOT UPLOADED'}</span>
          </div>
          {po.signedPo?.url ? (
            <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <button type="button" onClick={() => setSignedPhotoOpen(true)} className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <img src={po.signedPo.url} alt="Signed official PO" className="max-h-[560px] w-full object-contain transition-transform group-hover:scale-[1.01]" />
              </button>
              <div className="space-y-3 text-sm">
                {[
                  ['File', po.signedPo.name],
                  ['Uploaded by', po.signedPo.uploadedBy],
                  ['Uploaded at', po.signedPo.uploadedAt ? new Date(po.signedPo.uploadedAt).toLocaleString('en-IN') : '—'],
                  ['Verified by', po.signedPo.verifiedBy || 'Pending'],
                  ['Verified at', po.signedPo.verifiedAt ? new Date(po.signedPo.verifiedAt).toLocaleString('en-IN') : '—'],
                  ['Decision notes', po.signedPo.verificationComment || '—']
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</div>
                    <div className="mt-1 break-words font-semibold text-slate-800">{value}</div>
                  </div>
                ))}
                <button type="button" onClick={() => setSignedPhotoOpen(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-700"><Eye size={15} />Open Full Photo</button>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center">
              <FileText className="mx-auto text-slate-300" size={42} />
              <p className="mt-3 font-bold text-slate-700">No signed PO uploaded</p>
              <p className="mt-1 text-xs text-slate-500">The responsible manager must upload the officially signed PO photo.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'History' && (
        <div className="premium-card p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status History</h3>
          <div className="space-y-3">
            {(po.statusHistory || []).slice().reverse().map((entry, idx) => (
              <div key={idx} className="flex space-x-3 text-sm">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
                  {idx < (po.statusHistory?.length || 0) - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{entry.newStatus?.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString('en-IN')}</span>
                  </div>
                  {entry.comment && <p className="text-xs text-slate-500 mt-0.5">{entry.comment}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">by {entry.actorName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
