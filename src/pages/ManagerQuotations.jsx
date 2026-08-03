import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import ModalShell from '../components/ModalShell'
import apiClient from '../utils/apiClient'
import { FileText, ArrowLeft, Plus, Trash2, Download } from 'lucide-react'

const statusColors = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-50 text-blue-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  REVISION_REQUIRED: 'bg-amber-50 text-amber-700',
  SELECTED: 'bg-emerald-100 text-emerald-800',
  NOT_SELECTED: 'bg-slate-100 text-slate-500',
}

export default function ManagerQuotations() {
  const [quotations, setQuotations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const requestId = searchParams.get('requestId')
  const isCreating = searchParams.get('mode') === 'create' && Boolean(requestId)
  const [sourceRequest, setSourceRequest] = useState(null)
  const [vendors, setVendors] = useState([])
  const [vendorId, setVendorId] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [terms, setTerms] = useState('Standard purchase quotation terms apply.')
  const [validUntil, setValidUntil] = useState('')
  const [items, setItems] = useState([])
  const [showRequestPicker, setShowRequestPicker] = useState(false)
  const [eligibleRequests, setEligibleRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const { showSuccess, showError } = useAlert()

  const downloadQuotation = quotation => {
    const origin = import.meta.env.VITE_API_URL || ''
    window.open(`${origin}/api/generate-pdf?type=vendor-quotation&id=${quotation._id}`, '_blank', 'noopener,noreferrer')
  }

  const fetchQuotations = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/quotations')
      if (res.success) setQuotations(res.data)
    } catch (err) { showError('Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchQuotations() }, [fetchQuotations])

  useEffect(() => {
    if (!isCreating) return
    Promise.all([
      apiClient.get(`/api/requests?id=${requestId}`, { cache: false }),
      apiClient.get('/api/vendors?status=ACTIVE', { cache: false })
    ]).then(([requestRes, vendorRes]) => {
      if (!requestRes?.success) throw new Error(requestRes?.error || 'Request not found')
      if (!vendorRes?.success) throw new Error(vendorRes?.error || 'Vendors could not be loaded')
      const request = requestRes.data
      setSourceRequest(request)
      setVendors(vendorRes.data || [])
      setVendorId(request.quotation?.vendorId || '')
      const existing = request.quotation?.items
      setItems(existing?.length ? existing : [{
        itemType: 'MATERIAL',
        description: request.requestedItem || request.title || '',
        quantity: request.requestedQuantity || 1,
        unit: request.requestedUnit || 'pcs',
        unitPrice: 0,
        taxRate: 18,
        discount: 0
      }])
      if (request.quotation?.terms) setTerms(request.quotation.terms)
      if (request.quotation?.validUntil) setValidUntil(new Date(request.quotation.validUntil).toISOString().slice(0, 10))
    }).catch(err => {
      showError('Unable to open quotation', err.message)
      navigate('/quotations', { replace: true })
    })
  }, [isCreating, requestId, navigate, showError])

  const updateItem = (index, field, value) => setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  const lineTotal = item => {
    const subtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
    return subtotal - (Number(item.discount) || 0) + Math.max(0, subtotal - (Number(item.discount) || 0)) * ((Number(item.taxRate) || 0) / 100)
  }
  const grandTotal = items.reduce((total, item) => total + lineTotal(item), 0)

  const saveQuotation = async event => {
    event.preventDefault()
    if (!vendorId) return showError('Vendor required', 'Select the vendor who supplied this quotation.')
    if (!items.length || items.some(item => !item.description?.trim())) return showError('Missing information', 'Add a description for every quotation item.')
    setFormLoading(true)
    try {
      const res = await apiClient.post(`/api/quotations?requestId=${requestId}`, { vendorId, items, terms, validUntil })
      if (!res.success) throw new Error(res.error || 'Could not create quotation')
      showSuccess('Quotation created', `Draft quotation created for ${sourceRequest?.requestNumber || 'the request'}.`)
      navigate('/quotations', { replace: true })
      fetchQuotations()
    } catch (err) { showError('Unable to create quotation', err.message) }
    finally { setFormLoading(false) }
  }

  const selectQuotation = async quotation => {
    setFormLoading(true)
    try {
      const res = await apiClient.post(`/api/quotations?id=${quotation._id}&action=select`, {})
      if (!res.success) throw new Error(res.error || 'Could not select quotation')
      showSuccess('Quotation selected', `${quotation.vendorName} was selected for ${quotation.requestNumber}.`)
      navigate(`/purchase-orders?requestId=${quotation.requestId}&quotationId=${quotation._id}`)
    } catch (err) { showError('Unable to select quotation', err.message) }
    finally { setFormLoading(false) }
  }

  const openRequestPicker = async () => {
    setShowRequestPicker(true)
    setRequestsLoading(true)
    try {
      const res = await apiClient.get('/api/requests', { cache: false })
      if (!res.success) throw new Error(res.error || 'Could not load assigned requests')
      const openStatuses = ['ASSIGNED_TO_MANAGER', 'QUOTATION_IN_PROGRESS', 'QUOTATION_REVISION_REQUIRED', 'QUOTATION_REJECTED']
      setEligibleRequests((res.data || []).filter(request => openStatuses.includes(request.status)))
    } catch (err) {
      showError('Unable to load indents', err.message)
      setShowRequestPicker(false)
    } finally { setRequestsLoading(false) }
  }

  const filtered = quotations.filter(q => (!requestId || String(q.requestId) === String(requestId)) && (filter === 'ALL' || q.status === filter))

  if (isCreating) return (
    <div className="mx-auto w-full max-w-4xl space-y-6 animate-fadeIn">
      <button type="button" onClick={() => navigate('/quotations')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-violet-700"><ArrowLeft size={16} /> Back to quotations</button>
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-500">New quotation</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-800">Create Quotation</h1>
        <p className="mt-1 text-xs text-slate-500">{sourceRequest ? `${sourceRequest.requestNumber} · ${sourceRequest.title}` : 'Loading request details…'}</p>
      </div>
      {!sourceRequest ? <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-100 border-t-violet-600" /></div> : (
        <form onSubmit={saveQuotation} className="premium-card space-y-6 p-5 sm:p-7">
          <div className="grid gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 sm:grid-cols-3">
            <div><p className="text-[10px] font-bold uppercase text-slate-400">Request</p><p className="mt-1 text-xs font-extrabold text-violet-700">{sourceRequest.requestNumber}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-slate-400">Requester</p><p className="mt-1 text-xs font-extrabold text-slate-800">{sourceRequest.requesterName || '—'}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-slate-400">Requested</p><p className="mt-1 text-xs font-extrabold text-slate-800">{sourceRequest.requestedQuantity || 1} {sourceRequest.requestedUnit || 'pcs'} · {sourceRequest.requestedItem || sourceRequest.title}</p></div>
          </div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Vendor *
            <select required value={vendorId} onChange={event => setVendorId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium normal-case text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
              <option value="">Select active vendor…</option>
              {vendors.map(vendor => <option key={vendor._id} value={vendor._id}>{vendor.legalName} ({vendor.vendorCode})</option>)}
            </select>
            {vendors.length === 0 && <span className="mt-2 block text-xs font-medium normal-case text-amber-600">No active vendors are available. Add or activate a vendor first.</span>}
          </label>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">Quotation items</h2><button type="button" onClick={() => setItems(current => [...current, { itemType: 'MATERIAL', description: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 18, discount: 0 }])} className="inline-flex items-center gap-1 text-xs font-bold text-violet-600"><Plus size={14} /> Add item</button></div>
            {items.map((item, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-6">
                <label className="sm:col-span-2 text-[10px] font-bold uppercase text-slate-400">Description<input required value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium normal-case text-slate-800 outline-none focus:border-violet-500" /></label>
                <label className="text-[10px] font-bold uppercase text-slate-400">Quantity<input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800" /></label>
                <label className="text-[10px] font-bold uppercase text-slate-400">Unit<input value={item.unit} onChange={e => updateItem(index, 'unit', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs normal-case text-slate-800" /></label>
                <label className="text-[10px] font-bold uppercase text-slate-400">Unit price (₹)<input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(index, 'unitPrice', e.target.value)} className="mt-1 w-full rounded-lg border border-violet-200 bg-white p-2.5 text-xs text-slate-800" /></label>
                <label className="text-[10px] font-bold uppercase text-slate-400">GST %<div className="mt-1 flex gap-2"><input type="number" min="0" max="100" step="0.01" value={item.taxRate} onChange={e => updateItem(index, 'taxRate', e.target.value)} className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white p-2.5 text-xs text-slate-800" />{items.length > 1 && <button type="button" aria-label="Remove item" onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 size={15} /></button>}</div></label>
                <p className="text-right text-xs font-bold text-slate-600 sm:col-span-6">Line total: ₹{lineTotal(item).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">Valid until<input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" /></label>
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-right"><p className="text-xs text-slate-500">Grand total</p><p className="text-xl font-black text-violet-700">₹{grandTotal.toFixed(2)}</p></div>
          </div>
          <label className="block text-xs font-bold text-slate-600">Terms<textarea rows={3} value={terms} onChange={e => setTerms(e.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" /></label>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => navigate('/quotations')} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button type="submit" disabled={formLoading} className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">{formLoading ? 'Creating…' : 'Create quotation draft'}</button></div>
        </form>
      )}
    </div>
  )

  return (
    <div className="space-y-6 animate-fadeIn">
      {showRequestPicker && (
        <ModalShell panelClassName="max-w-2xl space-y-5 animate-fadeIn">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-500">New quotation</p><h2 className="mt-1 text-xl font-black text-slate-800">Choose an indent</h2><p className="mt-1 text-xs text-slate-500">Select an open request assigned to you.</p></div>
            <button type="button" onClick={() => setShowRequestPicker(false)} className="rounded-lg p-2 text-xl font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
          </div>
          {requestsLoading ? (
            <div className="flex justify-center py-14"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-100 border-t-violet-600" /></div>
          ) : eligibleRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center"><FileText size={32} className="mx-auto mb-3 text-slate-300" /><p className="text-sm font-bold text-slate-600">No eligible indents</p><p className="mt-1 text-xs text-slate-400">All assigned requests are closed or already have purchase orders.</p></div>
          ) : (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {eligibleRequests.map(request => (
                <button key={request._id} type="button" onClick={() => navigate(`/quotations?requestId=${request._id}&mode=create`)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-violet-300 hover:bg-violet-50/60">
                  <span className="min-w-0"><span className="block font-mono text-xs font-bold text-violet-600">{request.requestNumber}</span><span className="mt-1 block truncate text-sm font-bold text-slate-800">{request.title}</span><span className="mt-1 block text-xs text-slate-500">{request.requestedQuantity || 1} {request.requestedUnit || 'pcs'} · {request.requestedItem || request.title}</span></span>
                  <span className="flex-shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white">Create quote</span>
                </button>
              ))}
            </div>
          )}
        </ModalShell>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Quotations</h1>
          <p className="text-xs text-slate-500 mt-1">{requestId ? 'Compare quotations for this indent and select one for the PO' : 'Manage and compare vendor quotations'}</p>
        </div>
        <button type="button" onClick={requestId ? () => navigate(`/quotations?requestId=${requestId}&mode=create`) : openRequestPicker} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700"><Plus size={15} className="mr-1.5 inline" /> {requestId ? 'Add quotation' : 'Create quotation'}</button>
      </div>

      <div className="flex flex-wrap gap-2 p-4 premium-card">
        {['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === s ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No quotations found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => (
            <div key={q._id} className={`premium-card p-5 transition-all hover:border-violet-200 ${q.selected ? 'border-emerald-300 ring-2 ring-emerald-100' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-2.5 bg-violet-50 rounded-xl text-violet-600"><FileText size={18} /></div>
                  <div>
                    <div className="font-mono text-xs text-violet-600 font-bold">{q.quotationNumber || q._id?.slice(-6)}</div>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">{q.vendorName || 'Unknown Vendor'}</div>
                    <div className="text-xs text-slate-500">{q.requestNumber || 'Legacy quotation'}{q.vendorCode ? ` · ${q.vendorCode}` : ''}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-slate-800">₹{(q.grandTotal || 0).toLocaleString('en-IN')}</div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[q.status] || 'bg-slate-100 text-slate-600'}`}>
                    {q.status?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => downloadQuotation(q)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Download size={13} /> PDF</button>
                {q.hasPurchaseOrder || ['PURCHASE_ORDER_CREATED', 'CLOSED'].includes(q.requestStatus) ? (
                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">{q.requestStatus === 'CLOSED' ? 'Procurement closed' : 'PO already generated'}</span>
                ) : <>
                  <button type="button" onClick={() => navigate(`/quotations?requestId=${q.requestId}&mode=create`)} className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50">Add another quote</button>
                  {q.selected ? (
                    <button type="button" onClick={() => navigate(`/purchase-orders?requestId=${q.requestId}&quotationId=${q._id}`)} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">Generate PO</button>
                  ) : (
                    <button type="button" disabled={formLoading} onClick={() => selectQuotation(q)} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50">Select for PO</button>
                  )}
                </>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
