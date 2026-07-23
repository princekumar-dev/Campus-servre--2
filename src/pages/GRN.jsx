import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '../components/AlertContext'
import ModalShell from '../components/ModalShell'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { ClipboardCheck, Plus, Package, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'

const grnTypeColors = {
  PARTIAL: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  FINAL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTION: 'bg-rose-50 text-rose-700 border-rose-200',
  RETURN: 'bg-amber-50 text-amber-700 border-amber-200',
}

function CreateGRNModal({ onClose, onSaved }) {
  const [pos, setPos] = useState([])
  const [selectedPO, setSelectedPO] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [selectedDelivery, setSelectedDelivery] = useState('')
  const [items, setItems] = useState([])
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)
  const { showSuccess, showError } = useAlert()

  useEffect(() => {
    apiClient.get('/api/purchase-orders?status=ACTIVE').then(r => { if (r.success) setPos(r.data) })
    apiClient.get('/api/purchase-orders?status=PARTIALLY_FULFILLED').then(r => { if (r.success) setPos(p => [...p, ...r.data]) })
  }, [])

  const handlePOChange = async (poId) => {
    const po = pos.find(p => p._id === poId)
    setSelectedPO(po)
    if (po) {
      setItems(po.items.map(item => ({
        productId: item.productId,
        poItemId: item._id,
        poItemDescription: item.description,
        quantityOrdered: item.quantityOrdered,
        quantityPreviouslyAccepted: item.quantityAccepted || 0,
        unit: item.unit,
        quantityDeliveredNow: 0,
        quantityAcceptedNow: 0,
        quantityDamaged: 0,
        quantityRejected: 0,
      })))
      const delRes = await apiClient.get(`/api/deliveries?poId=${poId}&status=ENTRY_APPROVED`)
      if (delRes.success) setDeliveries(delRes.data)
    }
  }

  const updateItem = (idx, field, val) => setItems(p => p.map((item, i) => i === idx ? { ...item, [field]: Number(val) } : item))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedPO) return showError('Missing Info', 'Select a Purchase Order')
    setLoading(true)
    try {
      const res = await apiClient.post('/api/grn', {
        poId: selectedPO._id,
        deliveryScheduleId: selectedDelivery || undefined,
        items,
        remarks
      })
      if (res.success) {
        showSuccess('GRN Created', `${res.data.grnNumber} — ${res.grnType} GRN recorded. PO is now ${res.poStatus?.replace(/_/g, ' ')}`)
        onSaved(res.data)
      } else showError('GRN Error', res.error)
    } finally { setLoading(false) }
  }

  return (
    <ModalShell panelClassName="max-w-2xl space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">Record Goods Receipt (GRN)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Purchase Order *</label>
            <select onChange={e => handlePOChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all">
              <option value="">Select PO...</option>
              {pos.map(po => <option key={po._id} value={po._id}>{po.poNumber} — {po.vendorName}</option>)}
            </select>
          </div>

          {deliveries.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Link to Delivery Schedule (optional)</label>
              <select value={selectedDelivery} onChange={e => setSelectedDelivery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all">
                <option value="">No delivery schedule</option>
                {deliveries.map(d => <option key={d._id} value={d._id}>{d.deliveryNumber} — {new Date(d.scheduledDate).toLocaleDateString('en-IN')}</option>)}
              </select>
            </div>
          )}

          {/* Item Entry Table */}
          {items.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Receiving Quantities</label>
              <p className="text-xs text-slate-400 mb-3">Rule: Accepted + Damaged + Rejected ≤ Delivered. Cumulative Accepted ≤ Ordered.</p>
              <div className="space-y-3">
                {items.map((item, idx) => {
                  const remaining = item.quantityOrdered - item.quantityPreviouslyAccepted
                  return (
                    <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono text-[11px] font-bold text-violet-700">{item.productId}</div>
                          <span className="font-semibold text-slate-800 text-sm">{item.poItemDescription}</span>
                        </div>
                        <div className="text-xs text-slate-400 space-x-2">
                          <span>Ordered: <strong className="text-slate-600">{item.quantityOrdered}</strong></span>
                          <span>Previously: <strong className="text-violet-600">{item.quantityPreviouslyAccepted}</strong></span>
                          <span>Remaining: <strong className="text-amber-600">{remaining}</strong></span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { field: 'quantityDeliveredNow', label: 'Delivered Now', color: 'text-blue-600' },
                          { field: 'quantityAcceptedNow', label: 'Accepted', color: 'text-emerald-600' },
                          { field: 'quantityDamaged', label: 'Damaged', color: 'text-amber-600' },
                          { field: 'quantityRejected', label: 'Rejected', color: 'text-rose-600' },
                        ].map(({ field, label, color }) => (
                          <div key={field}>
                            <label className={`text-[11px] font-bold uppercase tracking-wider ${color} mb-1 block`}>{label}</label>
                            <input
                              type="number" min="0" value={item[field]}
                              onChange={e => updateItem(idx, field, e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm font-bold text-center focus:outline-none focus:border-violet-500 transition-all"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Remarks</label>
            <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional notes about the delivery condition..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 font-semibold text-sm py-2.5 rounded-xl hover:bg-slate-50 transition-all">Cancel</button>
            <button type="submit" disabled={loading || !selectedPO} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all disabled:opacity-50">
              {loading ? 'Recording...' : 'Record GRN'}
            </button>
          </div>
        </form>
    </ModalShell>
  )
}

function GRNCard({ grn }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="premium-card hover:border-violet-200 transition-all">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 flex-shrink-0"><ClipboardCheck size={18} /></div>
            <div>
              <div className="font-mono text-xs text-violet-600 font-bold">{grn.grnNumber}</div>
              <div className="font-bold text-slate-800 text-sm mt-0.5">PO: {grn.poNumber}</div>
              <div className="text-xs text-slate-500">{grn.receivedByName} · {new Date(grn.receivedAt).toLocaleDateString('en-IN')}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {grn.source === 'PO_QR' && <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">GATE QR</span>}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${grnTypeColors[grn.grnType]}`}>{grn.grnType}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${grn.status === 'FINALIZED' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{grn.status}</span>
          </div>
        </div>

        {grn.remarks && <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">{grn.remarks}</p>}

        <button onClick={() => setExpanded(e => !e)} className="mt-3 text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center space-x-1">
          <span>{expanded ? 'Hide' : 'Show'} Items</span>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-5 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-2">Product ID</th>
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-right">Delivered</th>
                  <th className="pb-2 text-right text-emerald-600">Accepted</th>
                  <th className="pb-2 text-right text-amber-600">Damaged</th>
                  <th className="pb-2 text-right text-rose-600">Rejected</th>
                  <th className="pb-2 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(grn.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="whitespace-nowrap py-2 pr-4 font-mono font-bold text-violet-700">{item.productId || '—'}</td>
                    <td className="py-2 font-medium text-slate-800">{item.poItemDescription}</td>
                    <td className="py-2 text-right text-slate-600">{item.quantityDeliveredNow}</td>
                    <td className="py-2 text-right text-emerald-600 font-bold">{item.quantityAcceptedNow}</td>
                    <td className="py-2 text-right text-amber-600 font-bold">{item.quantityDamaged}</td>
                    <td className="py-2 text-right text-rose-600 font-bold">{item.quantityRejected}</td>
                    <td className="py-2 text-right"><span className={`font-bold ${item.quantityRemaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{item.quantityRemaining}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GRN() {
  const [grns, setGrns] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const { showError } = useAlert()
  const auth = getAuthOrNull()

  const canRecord = ['admin', 'super_admin', 'manager', 'receiving_officer'].includes(auth?.role)

  const fetchGRNs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/grn')
      if (res.success) setGrns(res.data)
      else showError('Load Error', res.error)
    } catch (err) { showError('Network Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchGRNs() }, [fetchGRNs])

  const filtered = grns.filter(g => filter === 'ALL' || g.grnType === filter)

  return (
    <div className="space-y-6 animate-fadeIn">
      {showCreate && <CreateGRNModal onClose={() => setShowCreate(false)} onSaved={(grn) => { setShowCreate(false); setGrns(current => [grn, ...current]) }} />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Goods Receipts (GRN)</h1>
          <p className="text-xs text-slate-500 mt-1">Record and track all inbound goods receipts with quantity validation</p>
        </div>
        {canRecord && (
          <button onClick={() => setShowCreate(true)} className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center space-x-2 transition-all shadow-sm shadow-violet-600/20 self-start">
            <Plus size={15} /><span>Record GRN</span>
          </button>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { type: 'ALL', label: 'Total GRNs', value: grns.length, color: 'bg-slate-50 text-slate-600' },
          { type: 'PARTIAL', label: 'Partial', value: grns.filter(g => g.grnType === 'PARTIAL').length, color: 'bg-indigo-50 text-indigo-700' },
          { type: 'FINAL', label: 'Final', value: grns.filter(g => g.grnType === 'FINAL').length, color: 'bg-emerald-50 text-emerald-700' },
          { type: 'REJECTION', label: 'Rejections', value: grns.filter(g => g.grnType === 'REJECTION').length, color: 'bg-rose-50 text-rose-700' },
        ].map(({ type, label, value, color }) => (
          <button key={type} onClick={() => setFilter(type)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${filter === type ? 'border-violet-400 shadow-sm' : 'border-slate-200'} bg-white`}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className={`text-2xl font-black mt-1 ${filter === type ? 'text-violet-700' : 'text-slate-800'}`}>{value}</div>
          </button>
        ))}
      </div>

      {/* GRN List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No GRNs recorded yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(grn => <GRNCard key={grn._id} grn={grn} />)}
        </div>
      )}
    </div>
  )
}
