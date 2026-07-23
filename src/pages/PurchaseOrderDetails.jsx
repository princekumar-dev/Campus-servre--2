import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { ArrowLeft, Send, CheckCircle, XCircle, RefreshCw, Package, Truck, FileText, Clock, AlertCircle, Download } from 'lucide-react'

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-600 border-slate-200', step: 0 },
  SUBMITTED_FOR_APPROVAL: { label: 'Pending Approval', color: 'bg-amber-50 text-amber-700 border-amber-200', step: 1 },
  APPROVED: { label: 'Approved', color: 'bg-blue-50 text-blue-700 border-blue-200', step: 2 },
  SENT_TO_VENDOR: { label: 'Sent to Vendor', color: 'bg-violet-50 text-violet-700 border-violet-200', step: 3 },
  VENDOR_ACCEPTED: { label: 'Vendor Accepted', color: 'bg-teal-50 text-teal-700 border-teal-200', step: 4 },
  ACTIVE: { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', step: 4 },
  PARTIALLY_FULFILLED: { label: 'Partially Fulfilled', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', step: 5 },
  FULFILLED: { label: 'Fulfilled', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', step: 6 },
  CLOSED: { label: 'Closed', color: 'bg-slate-100 text-slate-500 border-slate-200', step: 7 },
  REVISION_REQUIRED: { label: 'Revision Required', color: 'bg-orange-50 text-orange-700 border-orange-200', step: 1 },
  REJECTED: { label: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200', step: -1 },
  VENDOR_REJECTED: { label: 'Vendor Rejected', color: 'bg-rose-100 text-rose-800 border-rose-300', step: -1 },
  CANCELLED: { label: 'Cancelled', color: 'bg-slate-100 text-slate-400 border-slate-200', step: -1 },
}

const poSteps = ['Draft', 'Submitted', 'Approved', 'Sent to Vendor', 'Active', 'Partial Delivery', 'Fulfilled', 'Closed']

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
  const [activeTab, setActiveTab] = useState('Overview')
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

  const doAction = async (action, payload = {}) => {
    setActionLoading(true)
    try {
      const res = await apiClient.post(`/api/purchase-orders?id=${id}&action=${action}`, payload)
      if (res.success) { showSuccess('Success', `PO ${action} action completed`); fetchPO(); setComment('') }
      else showError('Action Failed', res.error)
    } catch (err) { showError('Error', err.message) }
    finally { setActionLoading(false) }
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

  const tabs = ['Overview', 'Items', 'History']
  const cfg = statusConfig[po.status] || {}

  return (
    <div className="space-y-6 animate-fadeIn">
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
      {false && isManager && po.status === 'DRAFT' && (
        <div className="bg-white p-6 rounded-xl border border-violet-200 shadow-sm space-y-4 text-left">
          <h3 className="text-sm font-bold text-slate-800">Submit for Admin Approval</h3>
          <p className="text-xs text-slate-500">Review the PO details and submit for admin approval when ready.</p>
          <button onClick={() => doAction('submit')} disabled={actionLoading} className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg transition-all disabled:opacity-50 flex items-center space-x-2">
            <Send size={14} /><span>{actionLoading ? 'Submitting...' : 'Submit for Approval'}</span>
          </button>
        </div>
      )}

      {false && isAdmin && po.status === 'SUBMITTED_FOR_APPROVAL' && (
        <div className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm space-y-4 text-left">
          <h3 className="text-sm font-bold text-amber-700 flex items-center space-x-2"><AlertCircle size={16} /><span>Admin Approval Required</span></h3>
          <textarea rows={2} placeholder="Enter approval decision notes..." value={comment} onChange={e => setComment(e.target.value)} className="w-full bg-slate-50 border-none rounded-lg p-2.5 text-sm focus:outline-none resize-none" />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => doAction('approve', { comment })} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50">✓ Approve PO</button>
            <button onClick={() => doAction('request-revision', { comment: comment || 'Please revise' })} disabled={actionLoading || !comment} className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50">↺ Request Revision</button>
            <button onClick={() => doAction('reject', { comment: comment || 'Rejected by admin' })} disabled={actionLoading || !comment} className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50">✗ Reject</button>
          </div>
        </div>
      )}

      {false && isManager && po.status === 'APPROVED' && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm space-y-4 text-left">
          <h3 className="text-sm font-bold text-blue-700">Send PO to Vendor</h3>
          <p className="text-xs text-slate-500">PO approved. Send to vendor <strong>{po.vendorName}</strong> ({po.vendorEmail}) to proceed with order.</p>
          <button onClick={() => doAction('send-to-vendor')} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2.5 px-6 rounded-lg transition-all disabled:opacity-50 flex items-center space-x-2">
            <Send size={14} /><span>{actionLoading ? 'Sending...' : 'Send to Vendor'}</span>
          </button>
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
