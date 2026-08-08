import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import ModalShell from '../components/ModalShell'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { normalizeUnit, UnitOptions } from '../utils/unitOptions'
import { ShoppingCart, Plus, Search, ChevronRight, Clock, CheckCircle2, AlertCircle, Send, XCircle, RefreshCw, Package, FileText } from 'lucide-react'
import RefreshButton from '../components/RefreshButton'
import InstitutionBadge from '../components/InstitutionBadge'

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'bg-zinc-100 text-zinc-700 border-zinc-300 ring-1 ring-zinc-200' },
  SUBMITTED_FOR_APPROVAL: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-800 border-amber-300 ring-1 ring-amber-200' },
  APPROVED: { label: 'Approved', color: 'bg-sky-100 text-sky-800 border-sky-300 ring-1 ring-sky-200' },
  SENT_TO_VENDOR: { label: 'Sent to Vendor', color: 'bg-violet-100 text-violet-800 border-violet-300 ring-1 ring-violet-200' },
  VENDOR_ACCEPTED: { label: 'Vendor Accepted', color: 'bg-cyan-100 text-cyan-800 border-cyan-300 ring-1 ring-cyan-200' },
  ACTIVE: { label: 'Active', color: 'bg-lime-100 text-lime-800 border-lime-300 ring-1 ring-lime-200' },
  PARTIALLY_FULFILLED: { label: 'Partial Delivery', color: 'bg-indigo-100 text-indigo-800 border-indigo-300 ring-1 ring-indigo-200' },
  FULFILLED: { label: 'Fulfilled', color: 'bg-teal-100 text-teal-800 border-teal-300 ring-1 ring-teal-200' },
  CLOSED: { label: 'Closed', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-1 ring-emerald-200' },
  REVISION_REQUIRED: { label: 'Revision Required', color: 'bg-orange-100 text-orange-800 border-orange-300 ring-1 ring-orange-200' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-300 ring-1 ring-red-200' },
  VENDOR_REJECTED: { label: 'Vendor Rejected', color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300 ring-1 ring-fuchsia-200' },
  CANCELLED: { label: 'Cancelled', color: 'bg-slate-200 text-slate-700 border-slate-400 ring-1 ring-slate-300' },
}

const poTypeConfig = {
  SERVICE: { label: 'Service PO', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  GOODS: { label: 'Goods PO', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  REPLACEMENT: { label: 'Replacement PO', color: 'bg-orange-50 text-orange-700 border-orange-200' },
}

// The request's admin classification is the source of truth for request-based POs.
// poType is used for manually created POs, which have no upstream request classification.
const getPoType = po => po?.adminRequirementType === 'MAINTENANCE'
  ? 'SERVICE'
  : po?.adminRequirementType === 'REPLACEMENT'
    ? 'REPLACEMENT'
    : po?.adminRequirementType === 'NEW_PURCHASE'
      ? 'GOODS'
      : (po?.poType || 'GOODS')

function CreatePOModal({ onClose, onSaved, sourceRequest, selectedQuotation }) {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState([])
  const [serviceProviders, setServiceProviders] = useState([])
  const [form, setForm] = useState({ poType: sourceRequest?.adminAssessment?.requirementType === 'MAINTENANCE' ? 'SERVICE' : sourceRequest?.adminAssessment?.requirementType === 'REPLACEMENT' ? 'REPLACEMENT' : 'GOODS', vendorId: selectedQuotation?.vendorId || '', serviceProviderId: '', deliveryAddress: '363, Arcot Road, Kodambakkam, Chennai - 600024', deliveryLocation: sourceRequest?.location || '', expectedDeliveryDate: '', paymentTerms: 'Net 30', notes: sourceRequest ? `Generated for ${sourceRequest.requestNumber}: ${sourceRequest.title}` : '', deliveryCharge: 0 })
  const isServicePo = form.poType === 'SERVICE'
  const [items, setItems] = useState(selectedQuotation?.items?.length ? selectedQuotation.items.map(item => ({ description: item.description, specification: sourceRequest?.description || '', brand: '', quantityOrdered: item.quantity, unit: normalizeUnit(item.unit), unitPrice: item.unitPrice, taxRate: item.taxRate, discount: item.discount || 0 })) : [{ description: isServicePo ? sourceRequest?.title : sourceRequest?.requestedItem || '', specification: sourceRequest?.description || '', brand: '', quantityOrdered: isServicePo ? 1 : sourceRequest?.requestedQuantity || 1, unit: isServicePo ? 'service' : normalizeUnit(sourceRequest?.requestedUnit), unitPrice: 0, taxRate: isServicePo ? 0 : 18, discount: 0 }])
  const [loading, setLoading] = useState(false)
  const { showSuccess, showError } = useAlert()

  useEffect(() => {
    apiClient.get('/api/vendors?status=ACTIVE').then(r => { if (r.success) setVendors(r.data) })
    apiClient.get('/api/users?role=service_provider', { cache: false }).then(r => { if (r.success) setServiceProviders(r.users || []) })
  }, [])

  const addItem = () => {
    if (sourceRequest) return
    setItems(p => [...p, { description: '', specification: '', brand: '', quantityOrdered: 1, unit: 'pcs', unitPrice: 0, taxRate: 18, discount: 0 }])
  }
  const removeItem = idx => setItems(p => p.filter((_, i) => i !== idx))
  const updateItem = (idx, field, val) => setItems(p => p.map((item, i) => i === idx ? { ...item, [field]: val } : item))

  const getLineValues = (item) => {
    const quantity = Math.max(1, Number(item.quantityOrdered) || 1)
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0)
    const subtotal = quantity * unitPrice
    const discount = Math.max(0, Number(item.discount) || 0)
    const tax = Math.max(0, subtotal - discount) * (Math.max(0, Number(item.taxRate) || 0) / 100)
    return { unitPrice, subtotal, tax, total: subtotal - discount + tax }
  }

  const calcTotal = () => {
    let sub = 0, tax = 0, disc = 0
    items.forEach(item => {
      const lineSub = getLineValues(item).subtotal
      const lineDisc = Number(item.discount || 0)
      const lineTax = Math.max(0, lineSub - lineDisc) * (Math.max(0, Number(item.taxRate) || 0) / 100)
      sub += lineSub; disc += lineDisc; tax += lineTax
    })
    return { subtotal: sub, taxTotal: tax, discountTotal: disc, grandTotal: sub - disc + tax + Number(form.deliveryCharge || 0) }
  }
  const totals = calcTotal()
  const requirementType = sourceRequest?.adminAssessment?.requirementType || 'NEW_PURCHASE'
  const requirementLabel = {
    MAINTENANCE: 'Maintenance / service order',
    REPLACEMENT: 'Replacement order',
    NEW_PURCHASE: 'New purchase order'
  }[requirementType] || 'Purchase order'
  const poTypeLabel = form.poType === 'SERVICE' ? 'Service PO' : form.poType === 'REPLACEMENT' ? 'Replacement PO' : 'Goods PO'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if ((isServicePo ? !form.serviceProviderId : !form.vendorId) || !items.some(i => i.description)) return showError('Missing Info', isServicePo ? 'Select a service provider and confirm the service scope' : 'Select a vendor and add at least one item')
    setLoading(true)
    try {
      const normalizedItems = items.map(item => ({ ...item, unitPrice: getLineValues(item).unitPrice }))
      const submittedItems = sourceRequest && !selectedQuotation ? [{
        ...normalizedItems[0],
        description: isServicePo ? sourceRequest.title : sourceRequest.requestedItem || sourceRequest.title,
        specification: sourceRequest.description || normalizedItems[0].specification,
        quantityOrdered: isServicePo ? 1 : sourceRequest.requestedQuantity || 1,
        unit: isServicePo ? 'service' : sourceRequest.requestedUnit || 'pcs',
      }] : normalizedItems
      const res = await apiClient.post('/api/purchase-orders', { ...form, requestId: sourceRequest?._id, selectedQuotationId: selectedQuotation?._id, items: submittedItems })
      if (res.success) {
        showSuccess(res.existing ? 'PO Already Created' : 'PO Created', res.existing ? `${res.data.poNumber} opened for this request` : `${res.data.poNumber} created as draft`)
        onSaved(res.data)
      }
      else showError('Error', res.error)
    } catch (err) {
      showError('Unable to Create PO', err.message || 'Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <ModalShell panelClassName="max-w-3xl space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-500">{requirementLabel}</p><h2 className="mt-1 text-lg font-black text-slate-800">Create {poTypeLabel}</h2></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {!sourceRequest && (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">PO Type *</label>
              <select value={form.poType} onChange={e => setForm(p => ({ ...p, poType: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-500">
                <option value="GOODS">Goods PO</option>
                <option value="SERVICE">Service PO</option>
                <option value="REPLACEMENT">Replacement PO</option>
              </select>
              <p className="mt-1.5 text-xs text-slate-500">Choose Service for labour or maintenance work; choose Goods for physical items.</p>
            </div>
          )}
          {sourceRequest && (
            <div className="space-y-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Request</p><p className="mt-1 text-xs font-extrabold text-violet-700">{sourceRequest.requestNumber}</p><InstitutionBadge institution={sourceRequest.institution} compact className="mt-1.5" /></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Purpose</p><p className="mt-1 text-xs font-extrabold text-slate-800">{requirementLabel}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Requested</p><p className="mt-1 text-xs font-extrabold text-slate-800">{sourceRequest.requestedQuantity || 1} {sourceRequest.requestedUnit || 'pcs'} · {sourceRequest.requestedItem || sourceRequest.title}</p></div>
              </div>
              <div className="flex flex-col gap-2 border-t border-violet-100 pt-3 sm:flex-row">
                {!isServicePo && <button type="button" onClick={() => navigate(`/quotations?requestId=${sourceRequest._id}&mode=create`)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-violet-700 ring-1 ring-violet-200 transition-all hover:bg-violet-100">
                  <FileText size={14} /> Create quotation for this request
                </button>}
                {!isServicePo && <button type="button" onClick={() => navigate('/quotations')} className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-white hover:text-violet-700">
                  View all quotations <ChevronRight size={14} />
                </button>}
                {isServicePo && <p className="text-xs font-semibold text-cyan-700">Quotation not required. Actual costs and scanned bills are recorded after service completion.</p>}
              </div>
              {selectedQuotation && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Selected quotation: {selectedQuotation.quotationNumber} · {selectedQuotation.vendorName} · ₹{Number(selectedQuotation.grandTotal || 0).toFixed(2)}</div>}
            </div>
          )}
          {/* Vendor / service provider */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">{isServicePo ? 'Assigned Service Provider *' : 'Vendor *'}</label>
            {isServicePo ? <select
              value={form.serviceProviderId}
              onChange={e => setForm(p => ({ ...p, serviceProviderId: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all focus:border-violet-500 focus:outline-none"
            >
              <option value="">Select active service provider...</option>
              {serviceProviders.map(provider => <option key={provider._id} value={provider._id}>{provider.name} ({provider.email})</option>)}
            </select> : <select
              value={form.vendorId}
              onChange={e => setForm(p => ({ ...p, vendorId: e.target.value }))}
              disabled={Boolean(selectedQuotation)}
              className={`w-full rounded-xl border p-3 text-sm transition-all focus:outline-none focus:border-violet-500 ${selectedQuotation ? 'cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50'}`}
            >
              <option value="">Select active vendor...</option>
              {vendors.map(v => <option key={v._id} value={v._id}>{v.legalName} ({v.vendorCode})</option>)}
            </select>}
            {isServicePo && serviceProviders.length === 0 && <p className="mt-2 text-xs font-semibold text-amber-700">No active service-provider account is available. Ask the administrator to create or activate one.</p>}
            {selectedQuotation && (
              <p className="mt-2 text-xs font-medium text-emerald-700">Vendor is locked to the selected quotation.</p>
            )}
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">{isServicePo ? 'Service Scope *' : 'Line Items *'}</label>
              {!sourceRequest && (
                <button type="button" onClick={addItem} className="text-xs text-violet-600 font-bold hover:text-violet-700 flex items-center space-x-1">
                  <Plus size={12} /><span>Add Item</span>
                </button>
              )}
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-3 sm:gap-x-3 sm:gap-y-3">
                  {!isServicePo && <div className="min-w-0">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Description *</label>
                    <input type="text" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} readOnly={Boolean(sourceRequest)} placeholder="Item name..." className={`w-full mt-1 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-violet-500 ${sourceRequest ? 'cursor-not-allowed bg-slate-100 text-slate-600' : 'bg-white'}`} />
                  </div>}
                  {!isServicePo && <div className="min-w-0">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Qty *</label>
                    <input type="number" value={item.quantityOrdered} onChange={e => updateItem(idx, 'quantityOrdered', e.target.value)} readOnly={Boolean(sourceRequest)} min="1" className={`w-full mt-1 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-violet-500 ${sourceRequest ? 'cursor-not-allowed bg-slate-100 text-slate-600' : 'bg-white'}`} />
                  </div>}
                  {!isServicePo && <div className="min-w-0">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unit</label>
                    <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} disabled={Boolean(sourceRequest)} className={`w-full mt-1 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-violet-500 ${sourceRequest ? 'cursor-not-allowed bg-slate-100 text-slate-600' : 'bg-white'}`}><UnitOptions /></select>
                  </div>}
                  <div className="min-w-0">
                    <label className="block truncate whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-400" title={isServicePo ? 'Optional initial estimate' : 'Unit price'}>{isServicePo ? 'Initial estimate (₹)' : 'Unit price (₹) *'}</label>
                    <input type="number" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} min="0" step="0.01" required={!isServicePo} className="mt-1 w-full rounded-lg border border-violet-300 bg-white p-2 text-xs font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                  </div>
                  <div className="min-w-0">
                    <label className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-400">GST (%) *</label>
                    <input type="number" value={item.taxRate} onChange={e => updateItem(idx, 'taxRate', e.target.value)} min="0" max="100" step="0.01" className="mt-1 w-full rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-semibold outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
                  </div>
                  <div className="min-w-0">
                    <label className="block truncate whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-400" title="Calculated total">Calculated total (₹)</label>
                    <div className="mt-1 flex min-h-[34px] items-center justify-end rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-extrabold text-slate-700">₹{getLineValues(item).subtotal.toFixed(2)}</div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3 sm:col-span-full">
                    <span className="text-xs text-slate-500">{isServicePo ? 'Actual costs and scanned bills will be recorded by the service provider after completing the work.' : `${item.quantityOrdered || 1} ${item.unit || 'unit'} × ₹${getLineValues(item).unitPrice.toFixed(2)} = ₹${getLineValues(item).subtotal.toFixed(2)} · GST ${Number(item.taxRate) || 0}%`}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition-all hover:bg-rose-100">
                        Remove item
                      </button>
                    )}
                    </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Preview */}
          {!isServicePo && <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-right space-y-1 text-sm">
            <div className="text-slate-500">Subtotal: <strong className="text-slate-800">₹{totals.subtotal.toFixed(2)}</strong></div>
            <div className="text-slate-500">Tax (GST): <strong className="text-slate-800">₹{totals.taxTotal.toFixed(2)}</strong></div>
            <div className="text-violet-700 text-base font-black">Grand Total: ₹{totals.grandTotal.toFixed(2)}</div>
          </div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">{isServicePo ? 'Service Address *' : 'Delivery Address *'}</label>
              <input type="text" value={form.deliveryAddress} onChange={e => setForm(p => ({ ...p, deliveryAddress: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">{isServicePo ? 'Expected Service Date' : 'Expected Delivery Date'}</label>
              <input type="date" value={form.expectedDeliveryDate} onChange={e => setForm(p => ({ ...p, expectedDeliveryDate: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 font-semibold text-sm py-2.5 rounded-xl hover:bg-slate-50 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all disabled:opacity-50">
              {loading ? 'Creating...' : `Create ${poTypeLabel} Draft`}
            </button>
          </div>
        </form>
    </ModalShell>
  )
}

export default function PurchaseOrders() {
  const [pos, setPos] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const { showSuccess, showError } = useAlert()
  const auth = getAuthOrNull()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestId = searchParams.get('requestId')
  const quotationId = searchParams.get('quotationId')
  const [sourceRequest, setSourceRequest] = useState(null)
  const [selectedQuotation, setSelectedQuotation] = useState(null)

  const canCreate = auth?.role === 'manager'

  const openDirectCreate = () => {
    setSourceRequest(null)
    setShowCreate(true)
  }

  useEffect(() => {
    if (!requestId) return
    Promise.all([
      apiClient.get(`/api/requests?id=${requestId}`, { cache: false }),
      quotationId ? apiClient.get(`/api/quotations?id=${quotationId}`, { cache: false }) : Promise.resolve(null)
    ]).then(([res, quoteRes]) => {
      if (res?.success && (!quotationId || quoteRes?.success)) {
        setSourceRequest(res.data)
        setSelectedQuotation(quoteRes?.data || null)
        setShowCreate(true)
      }
    }).catch(err => showError('Request unavailable', err.message))
  }, [requestId, quotationId, showError])

  const fetchPOs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/purchase-orders', { cache: false, dedupe: false })
      if (res.success) setPos(res.data)
      else showError('Load Error', res.error)
    } catch (err) { showError('Network Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchPOs() }, [fetchPOs])

  const normalizeSearch = value => String(value ?? '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const searchTerms = normalizeSearch(searchQuery).split(' ').filter(Boolean)
  const filtered = pos.filter(po => {
    const searchableText = normalizeSearch([
      po.poNumber,
      po.vendorName,
      po.vendorEmail,
      po.status,
      getPoType(po),
      poTypeConfig[getPoType(po)]?.label,
      statusConfig[po.status]?.label,
      po.requestNumber,
      po.deliveryLocation,
      po.deliveryAddress,
      po.grandTotal,
      ...(po.items || []).flatMap(item => [
        item.productId,
        item.description,
        item.specification,
        item.brand,
        item.unit
      ])
    ].filter(Boolean).join(' '))
    const matchSearch = searchTerms.length === 0 || searchTerms.every(term => searchableText.includes(term))
    const matchStatus = statusFilter === 'ALL' || po.status === statusFilter
    const matchType = typeFilter === 'ALL' || getPoType(po) === typeFilter
    return matchSearch && matchStatus && matchType
  })

  // Keep the filters aligned with every status rendered by the PO workflow.
  // CLOSED is distinct from FULFILLED and must have its own count/filter.
  const statusGroups = ['ALL', ...Object.keys(statusConfig)]

  return (
    <div className="space-y-6 animate-fadeIn">
      {showCreate && <CreatePOModal sourceRequest={sourceRequest} selectedQuotation={selectedQuotation} onClose={() => setShowCreate(false)} onSaved={(po) => { setShowCreate(false); if (po?._id) navigate(`/purchase-orders/${po._id}`); else fetchPOs() }} />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Purchase Orders</h1>
          <p className="text-xs text-slate-500 mt-1">Manage all purchase orders from creation to closure</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 self-start sm:w-auto sm:justify-end">
          <RefreshButton isLoading={isLoading} onClick={fetchPOs} ariaLabel="Refresh purchase orders" />
          {canCreate && (<>
            <Link to="/requests" className="flex items-center space-x-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-bold text-violet-700 transition-all hover:border-violet-300 hover:bg-violet-100">
              <Package size={15} /><span>Assigned Requests</span>
            </Link>
            <button type="button" onClick={openDirectCreate} className="flex items-center space-x-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-violet-700">
              <Plus size={15} /><span>Create Purchase Order</span>
            </button>
          </>)}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 p-3 premium-card sm:p-4 xl:flex-row xl:items-center xl:justify-between xl:gap-5">
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:flex-1">
          {statusGroups.map(s => {
            const count = s === 'ALL' ? pos.length : pos.filter(p => p.status === s).length
            const isActive = statusFilter === s
            return (
              <button key={s} onClick={() => setStatusFilter(s)} aria-pressed={isActive}
                className={`group flex min-w-0 items-center justify-between gap-1.5 rounded-xl border px-3 py-2.5 text-left text-[11px] font-extrabold transition-all duration-200 sm:h-10 sm:w-auto sm:flex-none sm:justify-start sm:whitespace-nowrap sm:rounded-full sm:px-3.5 xl:px-4 ${isActive ? 'border-violet-600 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-200/80' : 'border-slate-200/80 bg-white text-slate-600 shadow-sm hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50/70 hover:text-violet-700 hover:shadow-md hover:shadow-violet-100'}`}>
                <span className="min-w-0 leading-tight">{s === 'ALL' ? 'All' : (statusConfig[s]?.label || s)}</span>
                <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none transition-colors ${isActive ? 'bg-white/20 text-white ring-1 ring-white/20' : 'bg-slate-100 text-slate-500 group-hover:bg-violet-100 group-hover:text-violet-700'}`}>{count}</span>
              </button>
            )
          })}
        </div>
        <div className="relative min-w-0 xl:w-80 xl:flex-none 2xl:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors pointer-events-none" />
          <input type="text" aria-label="Search purchase orders" placeholder="Search PO, vendor, item, product or status..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-11 w-full rounded-full border border-slate-200/80 bg-white py-2 pl-10 pr-10 text-xs text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 hover:border-violet-200 hover:shadow-md hover:shadow-violet-100/60 focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear purchase order search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <XCircle size={16} />
            </button>
          )}
        </div>
        <select aria-label="Filter by PO type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-11 rounded-full border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100">
          <option value="ALL">All PO Types ({pos.length})</option>
          {Object.entries(poTypeConfig).map(([value, config]) => <option key={value} value={value}>{config.label} ({pos.filter(po => getPoType(po) === value).length})</option>)}
        </select>
      </div>

      {/* PO Table */}
      <div className="premium-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No purchase orders found</p>
          </div>
        ) : (
          <>
          <div className="space-y-3 p-3 md:hidden">
            {filtered.map(po => (
              <article key={po._id} className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] font-bold text-violet-600">{po.poNumber}</p>
                    <h3 className="mt-1 truncate text-sm font-bold text-slate-800">{po.vendorName}</h3>
                    <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${poTypeConfig[getPoType(po)].color}`}>{poTypeConfig[getPoType(po)].label}</span>
                  </div>
                  <Link
                    to={`/purchase-orders/${po._id}`}
                    aria-label={`View details for ${po.poNumber}`}
                    className="inline-flex flex-shrink-0 items-center gap-1 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-violet-700 active:bg-violet-800"
                  >
                    Details <ChevronRight size={13} />
                  </Link>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Items</p>
                    <p className="mt-1 font-semibold text-slate-700">{po.items?.length || 0}</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Grand total</p>
                    <p className="mt-1 truncate font-bold text-slate-800">₹{Number(po.grandTotal || 0).toFixed(2)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expected</p>
                    <p className="mt-1 truncate font-semibold text-slate-600">
                      {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-IN') : '—'}
                    </p>
                  </div>
                  <div className="flex min-w-0 items-end justify-end">
                    <span className={`max-w-full truncate rounded-full border px-2 py-1 text-[10px] font-bold ${statusConfig[po.status]?.color || 'bg-slate-100 text-slate-500'}`}>
                      {statusConfig[po.status]?.label || po.status}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">PO Number</th>
                  <th className="px-6 py-4">Vendor</th>
                  <th className="px-6 py-4">PO Type</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4 text-right">Grand Total</th>
                  <th className="px-6 py-4">Expected Delivery</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                {filtered.map(po => (
                  <tr key={po._id} className="table-row-hover group cursor-pointer" onClick={() => navigate(`/purchase-orders/${po._id}`)}>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-violet-600">{po.poNumber}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{po.vendorName}</td>
                    <td className="px-6 py-4"><span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${poTypeConfig[getPoType(po)].color}`}>{poTypeConfig[getPoType(po)].label}</span></td>
                    <td className="px-6 py-4 text-slate-500 text-xs">{po.items?.length || 0} items</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-800">₹{(po.grandTotal || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${statusConfig[po.status]?.color || 'bg-slate-100 text-slate-500'}`}>
                        {statusConfig[po.status]?.label || po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/purchase-orders/${po._id}`} onClick={e => e.stopPropagation()} className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-1.5 px-4 rounded-lg transition-all inline-flex items-center space-x-1">
                        <span>View</span><ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
