import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import ModalShell from '../components/ModalShell'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { ShoppingCart, Plus, Search, ChevronRight, Clock, CheckCircle2, AlertCircle, Send, XCircle, RefreshCw, Package } from 'lucide-react'

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  SUBMITTED_FOR_APPROVAL: { label: 'Pending Approval', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Approved', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  SENT_TO_VENDOR: { label: 'Sent to Vendor', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  VENDOR_ACCEPTED: { label: 'Vendor Accepted', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  ACTIVE: { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PARTIALLY_FULFILLED: { label: 'Partial Delivery', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  FULFILLED: { label: 'Fulfilled', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  CLOSED: { label: 'Closed', color: 'bg-slate-100 text-slate-500 border-slate-200' },
  REVISION_REQUIRED: { label: 'Revision Required', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  REJECTED: { label: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  VENDOR_REJECTED: { label: 'Vendor Rejected', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  CANCELLED: { label: 'Cancelled', color: 'bg-slate-100 text-slate-400 border-slate-200' },
}

function CreatePOModal({ onClose, onSaved, sourceRequest }) {
  const [vendors, setVendors] = useState([])
  const [form, setForm] = useState({ vendorId: '', deliveryAddress: 'MSEC Campus, Aravayal, Chennai - 600089', deliveryLocation: sourceRequest?.location || '', expectedDeliveryDate: '', paymentTerms: 'Net 30', notes: sourceRequest ? `Generated for ${sourceRequest.requestNumber}: ${sourceRequest.title}` : '', deliveryCharge: 0 })
  const [items, setItems] = useState([{ description: sourceRequest?.requestedItem || '', specification: sourceRequest?.description || '', brand: '', quantityOrdered: sourceRequest?.requestedQuantity || 1, unit: sourceRequest?.requestedUnit || 'pcs', unitPrice: 0, priceMode: 'UNIT', taxRate: 18, discount: 0 }])
  const [loading, setLoading] = useState(false)
  const { showSuccess, showError } = useAlert()

  useEffect(() => {
    apiClient.get('/api/vendors?status=ACTIVE').then(r => { if (r.success) setVendors(r.data) })
  }, [])

  const addItem = () => setItems(p => [...p, { description: '', specification: '', brand: '', quantityOrdered: 1, unit: 'pcs', unitPrice: 0, priceMode: 'UNIT', taxRate: 18, discount: 0 }])
  const removeItem = idx => setItems(p => p.filter((_, i) => i !== idx))
  const updateItem = (idx, field, val) => setItems(p => p.map((item, i) => i === idx ? { ...item, [field]: val } : item))

  const getLineValues = (item) => {
    const quantity = Math.max(1, Number(item.quantityOrdered) || 1)
    const enteredPrice = Math.max(0, Number(item.unitPrice) || 0)
    const unitPrice = item.priceMode === 'TOTAL' ? enteredPrice / quantity : enteredPrice
    const subtotal = unitPrice * quantity
    const discount = Math.max(0, Number(item.discount) || 0)
    const tax = Math.max(0, subtotal - discount) * (Number(item.taxRate || 0) / 100)
    return { unitPrice, subtotal, tax, total: subtotal - discount + tax }
  }

  const changePriceMode = (idx, nextMode) => setItems(current => current.map((item, index) => {
    if (index !== idx || item.priceMode === nextMode) return item
    const quantity = Math.max(1, Number(item.quantityOrdered) || 1)
    const currentPrice = Number(item.unitPrice) || 0
    return { ...item, priceMode: nextMode, unitPrice: nextMode === 'TOTAL' ? currentPrice * quantity : currentPrice / quantity }
  }))

  const calcTotal = () => {
    let sub = 0, tax = 0, disc = 0
    items.forEach(item => {
      const lineSub = getLineValues(item).subtotal
      const lineDisc = Number(item.discount || 0)
      const lineTax = (lineSub - lineDisc) * (Number(item.taxRate) / 100)
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.vendorId || !items.some(i => i.description)) return showError('Missing Info', 'Select vendor and add at least one item')
    setLoading(true)
    try {
      const normalizedItems = items.map(item => ({ ...item, unitPrice: getLineValues(item).unitPrice }))
      const res = await apiClient.post('/api/purchase-orders', { ...form, requestId: sourceRequest?._id, items: normalizedItems })
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
          <div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-500">{requirementLabel}</p><h2 className="mt-1 text-lg font-black text-slate-800">Create Fulfilment Order</h2></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {sourceRequest && (
            <div className="grid gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 sm:grid-cols-3">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Request</p><p className="mt-1 text-xs font-extrabold text-violet-700">{sourceRequest.requestNumber}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Purpose</p><p className="mt-1 text-xs font-extrabold text-slate-800">{requirementLabel}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Requested</p><p className="mt-1 text-xs font-extrabold text-slate-800">{sourceRequest.requestedQuantity || 1} {sourceRequest.requestedUnit || 'pcs'} · {sourceRequest.requestedItem || sourceRequest.title}</p></div>
            </div>
          )}
          {/* Vendor */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Vendor *</label>
            <select value={form.vendorId} onChange={e => setForm(p => ({ ...p, vendorId: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all">
              <option value="">Select active vendor...</option>
              {vendors.map(v => <option key={v._id} value={v._id}>{v.legalName} ({v.vendorCode})</option>)}
            </select>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Line Items *</label>
              <button type="button" onClick={addItem} className="text-xs text-violet-600 font-bold hover:text-violet-700 flex items-center space-x-1">
                <Plus size={12} /><span>Add Item</span>
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-12 sm:gap-x-3 sm:gap-y-2">
                  <div className="sm:col-span-3">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Description *</label>
                    <input type="text" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Item name..." className="w-full mt-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-violet-500" />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Qty *</label>
                    <input type="number" value={item.quantityOrdered} onChange={e => updateItem(idx, 'quantityOrdered', e.target.value)} min="1" className="w-full mt-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-violet-500" />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unit</label>
                    <input type="text" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} placeholder="pcs" className="w-full mt-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-violet-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-400">Price entry *</label>
                    <select value={item.priceMode || 'UNIT'} onChange={e => changePriceMode(idx, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-violet-500">
                      <option value="UNIT">Per item</option>
                      <option value="TOTAL">Full quantity</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-400">{item.priceMode === 'TOTAL' ? 'Total price (₹)' : 'Unit price (₹)'} *</label>
                    <input type="number" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} min="0" step="0.01" className="mt-1 w-full rounded-lg border border-violet-200 bg-white p-2 text-xs font-semibold outline-none focus:border-violet-500" />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-400">Line subtotal</label>
                    <div className="mt-1 flex min-h-[34px] items-center justify-end rounded-lg border border-violet-100 bg-violet-50 px-3 text-sm font-extrabold text-violet-700">
                      ₹{getLineValues(item).subtotal.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3 sm:col-span-12">
                    <span className="text-xs text-slate-500">{item.quantityOrdered || 1} × ₹{getLineValues(item).unitPrice.toFixed(2)} per {item.unit || 'unit'}</span>
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
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-right space-y-1 text-sm">
            <div className="text-slate-500">Subtotal: <strong className="text-slate-800">₹{totals.subtotal.toFixed(2)}</strong></div>
            <div className="text-slate-500">Tax (GST): <strong className="text-slate-800">₹{totals.taxTotal.toFixed(2)}</strong></div>
            <div className="text-violet-700 text-base font-black">Grand Total: ₹{totals.grandTotal.toFixed(2)}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Delivery Address *</label>
              <input type="text" value={form.deliveryAddress} onChange={e => setForm(p => ({ ...p, deliveryAddress: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Expected Delivery Date</label>
              <input type="date" value={form.expectedDeliveryDate} onChange={e => setForm(p => ({ ...p, expectedDeliveryDate: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 font-semibold text-sm py-2.5 rounded-xl hover:bg-slate-50 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all disabled:opacity-50">
              {loading ? 'Creating...' : 'Create PO Draft'}
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
  const [showCreate, setShowCreate] = useState(false)
  const { showSuccess, showError } = useAlert()
  const auth = getAuthOrNull()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestId = searchParams.get('requestId')
  const [sourceRequest, setSourceRequest] = useState(null)

  const canCreate = auth?.role === 'manager'

  const openDirectCreate = () => {
    setSourceRequest(null)
    setShowCreate(true)
  }

  useEffect(() => {
    if (!requestId) return
    apiClient.get(`/api/requests?id=${requestId}`, { cache: false }).then(res => {
      if (res?.success) {
        setSourceRequest(res.data)
        setShowCreate(true)
      }
    }).catch(err => showError('Request unavailable', err.message))
  }, [requestId, showError])

  const fetchPOs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/purchase-orders')
      if (res.success) setPos(res.data)
      else showError('Load Error', res.error)
    } catch (err) { showError('Network Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchPOs() }, [fetchPOs])

  const filtered = pos.filter(po => {
    const matchSearch = !searchQuery || po.poNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || po.vendorName?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === 'ALL' || po.status === statusFilter
    return matchSearch && matchStatus
  })

  const statusGroups = ['ALL', 'DRAFT', 'SUBMITTED_FOR_APPROVAL', 'APPROVED', 'ACTIVE', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED']

  return (
    <div className="space-y-6 animate-fadeIn">
      {showCreate && <CreatePOModal sourceRequest={sourceRequest} onClose={() => setShowCreate(false)} onSaved={(po) => { setShowCreate(false); if (po?._id) navigate(`/purchase-orders/${po._id}`); else fetchPOs() }} />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Purchase Orders</h1>
          <p className="text-xs text-slate-500 mt-1">Manage all purchase orders from creation to closure</p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap items-center gap-2 self-start">
            <Link to="/requests" className="flex items-center space-x-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-bold text-violet-700 transition-all hover:border-violet-300 hover:bg-violet-100">
              <Package size={15} /><span>Assigned Requests</span>
            </Link>
            <button type="button" onClick={openDirectCreate} className="flex items-center space-x-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-violet-700">
              <Plus size={15} /><span>Create Purchase Order</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 p-3 premium-card sm:p-4 xl:flex-row xl:items-center xl:justify-between xl:gap-5">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 scrollbar-none xl:flex-1 xl:pb-0">
          {statusGroups.map(s => {
            const count = s === 'ALL' ? pos.length : pos.filter(p => p.status === s).length
            const isActive = statusFilter === s
            return (
              <button key={s} onClick={() => setStatusFilter(s)} aria-pressed={isActive}
                className={`group flex h-10 flex-none items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[11px] font-extrabold transition-all duration-200 xl:px-4 ${isActive ? 'border-violet-600 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-200/80' : 'border-slate-200/80 bg-white text-slate-600 shadow-sm hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50/70 hover:text-violet-700 hover:shadow-md hover:shadow-violet-100'}`}>
                <span>{s === 'ALL' ? 'All' : (statusConfig[s]?.label || s)}</span>
                <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none transition-colors ${isActive ? 'bg-white/20 text-white ring-1 ring-white/20' : 'bg-slate-100 text-slate-500 group-hover:bg-violet-100 group-hover:text-violet-700'}`}>{count}</span>
              </button>
            )
          })}
        </div>
        <div className="relative min-w-0 xl:w-80 xl:flex-none 2xl:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors pointer-events-none" />
          <input type="search" aria-label="Search purchase orders" placeholder="Search by PO number or vendor..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-11 w-full rounded-full border border-slate-200/80 bg-white py-2 pl-10 pr-4 text-xs text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 hover:border-violet-200 hover:shadow-md hover:shadow-violet-100/60 focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
        </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">PO Number</th>
                  <th className="px-6 py-4">Vendor</th>
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
        )}
      </div>
    </div>
  )
}
