import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '../components/AlertContext'
import ModalShell from '../components/ModalShell'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { Truck, Plus, Calendar, Clock, QrCode, CheckCircle, AlertCircle, Send, RefreshCw, Package, Search } from 'lucide-react'

const statusColors = {
  SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
  PASS_GENERATED: 'bg-violet-50 text-violet-700 border-violet-200',
  AT_GATE: 'bg-amber-50 text-amber-700 border-amber-200',
  ENTRY_APPROVED: 'bg-teal-50 text-teal-700 border-teal-200',
  IN_INSPECTION: 'bg-orange-50 text-orange-700 border-orange-200',
  PARTIALLY_RECEIVED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  FULLY_RECEIVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXIT_RECORDED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  ENTRY_REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  RESCHEDULED: 'bg-orange-50 text-orange-700 border-orange-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
  EXPIRED: 'bg-rose-100 text-rose-800 border-rose-200',
}

function ScheduleDeliveryModal({ onClose, onSaved }) {
  const [pos, setPos] = useState([])
  const [deliveryPersons, setDeliveryPersons] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [form, setForm] = useState({ poId: '', deliveryPersonId: '', vehicleId: '', scheduledDate: '', slotStart: '09:00', slotEnd: '17:00', deliveryLocation: '', challanNumber: '' })
  const [loading, setLoading] = useState(false)
  const { showSuccess, showError } = useAlert()

  useEffect(() => {
    apiClient.get('/api/purchase-orders?status=ACTIVE').then(r => { if (r.success) setPos(r.data) })
    apiClient.get('/api/vendors?subResource=delivery-persons').then(r => { if (r.success) setDeliveryPersons(r.data) })
    apiClient.get('/api/vendors?subResource=vehicles').then(r => { if (r.success) setVehicles(r.data) })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.poId || !form.scheduledDate || !form.deliveryLocation) return showError('Missing Fields', 'PO, date, and location are required')
    setLoading(true)
    try {
      const res = await apiClient.post('/api/deliveries', form)
      if (res.success) { showSuccess('Scheduled', `Delivery ${res.data.deliveryNumber} scheduled`); onSaved(res.data) }
      else showError('Error', res.error)
    } finally { setLoading(false) }
  }

  return (
    <ModalShell panelClassName="max-w-lg space-y-5 animate-fadeIn">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">Schedule Delivery</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Purchase Order *</label>
            <select value={form.poId} onChange={e => setForm(p => ({ ...p, poId: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all">
              <option value="">Select active PO...</option>
              {pos.map(po => <option key={po._id} value={po._id}>{po.poNumber} — {po.vendorName}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Scheduled Date *</label>
              <input type="date" value={form.scheduledDate} onChange={e => setForm(p => ({ ...p, scheduledDate: e.target.value }))} min={new Date().toISOString().split('T')[0]} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Delivery Location *</label>
              <input type="text" value={form.deliveryLocation} onChange={e => setForm(p => ({ ...p, deliveryLocation: e.target.value }))} placeholder="e.g. Store Room A" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Slot Start</label>
              <input type="time" value={form.slotStart} onChange={e => setForm(p => ({ ...p, slotStart: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Slot End</label>
              <input type="time" value={form.slotEnd} onChange={e => setForm(p => ({ ...p, slotEnd: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Delivery Person</label>
              <select value={form.deliveryPersonId} onChange={e => setForm(p => ({ ...p, deliveryPersonId: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all">
                <option value="">Select person...</option>
                {deliveryPersons.map(dp => <option key={dp._id} value={dp._id}>{dp.name} · {dp.phone}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Vehicle</label>
              <select value={form.vehicleId} onChange={e => setForm(p => ({ ...p, vehicleId: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all">
                <option value="">Select vehicle...</option>
                {vehicles.map(v => <option key={v._id} value={v._id}>{v.vehicleNumber} ({v.vehicleType})</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Challan Number</label>
            <input type="text" value={form.challanNumber} onChange={e => setForm(p => ({ ...p, challanNumber: e.target.value }))} placeholder="DC/challan number..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 font-semibold text-sm py-2.5 rounded-xl hover:bg-slate-50 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all disabled:opacity-50">
              {loading ? 'Scheduling...' : 'Schedule Delivery'}
            </button>
          </div>
        </form>
    </ModalShell>
  )
}

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [generatingPass, setGeneratingPass] = useState(null)
  const { showSuccess, showError } = useAlert()
  const auth = getAuthOrNull()

  const canManage = ['admin', 'super_admin', 'manager'].includes(auth?.role)

  const fetchDeliveries = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/deliveries')
      if (res.success) setDeliveries(res.data)
      else showError('Load Error', res.error)
    } catch (err) { showError('Network Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchDeliveries() }, [fetchDeliveries])

  const handleGeneratePass = async (deliveryId) => {
    setGeneratingPass(deliveryId)
    try {
      const res = await apiClient.post(`/api/deliveries?id=${deliveryId}&action=generate-pass`)
      if (res.success) {
        setDeliveries(current => current.map(delivery => delivery._id === deliveryId ? { ...delivery, ...res.data } : delivery))
        showSuccess('Pass Generated', 'QR pass + backup code created for delivery')
      }
      else showError('Error', res.error)
    } finally { setGeneratingPass(null) }
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filtered = deliveries.filter(d => {
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter
    const matchesSearch = !normalizedSearch || [d.deliveryNumber, d.poNumber, d.vendorName, d.deliveryLocation, d.vehicleNumber, d.challanNumber]
      .some(value => String(value || '').toLowerCase().includes(normalizedSearch))
    return matchesStatus && matchesSearch
  })
  const statusOptions = ['ALL', 'SCHEDULED', 'PASS_GENERATED', 'ENTRY_APPROVED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'ENTRY_REJECTED', 'CANCELLED']

  return (
    <div className="space-y-6 animate-fadeIn">
      {showSchedule && <ScheduleDeliveryModal onClose={() => setShowSchedule(false)} onSaved={(delivery) => { setShowSchedule(false); setDeliveries(current => [delivery, ...current]) }} />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Delivery Schedules</h1>
          <p className="text-xs text-slate-500 mt-1">Manage inbound delivery schedules and gate passes</p>
        </div>
        {canManage && (
          <button onClick={() => setShowSchedule(true)} className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center space-x-2 transition-all shadow-sm shadow-violet-600/20 self-start">
            <Plus size={15} /><span>Schedule Delivery</span>
          </button>
        )}
      </div>

      {/* Status filters and search */}
      <div className="flex flex-col gap-3 p-3 premium-card sm:p-4 xl:flex-row xl:items-center xl:justify-between xl:gap-5">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 scrollbar-none xl:flex-1 xl:pb-0">
          {statusOptions.map(s => {
            const count = s === 'ALL' ? deliveries.length : deliveries.filter(d => d.status === s).length
            const isActive = statusFilter === s
            return (
              <button key={s} onClick={() => setStatusFilter(s)} aria-pressed={isActive}
                className={`group flex h-10 flex-none items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[11px] font-extrabold capitalize transition-all duration-200 xl:px-4 ${isActive ? 'border-violet-600 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-200/80' : 'border-slate-200/80 bg-white text-slate-600 shadow-sm hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50/70 hover:text-violet-700 hover:shadow-md hover:shadow-violet-100'}`}>
                <span>{s === 'ALL' ? 'All' : s.replace(/_/g, ' ').toLowerCase()}</span>
                <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none transition-colors ${isActive ? 'bg-white/20 text-white ring-1 ring-white/20' : 'bg-slate-100 text-slate-500 group-hover:bg-violet-100 group-hover:text-violet-700'}`}>{count}</span>
              </button>
            )
          })}
        </div>
        <div className="relative min-w-0 xl:w-80 xl:flex-none 2xl:w-96">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" aria-label="Search delivery schedules" placeholder="Search delivery, PO, vendor or location..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-11 w-full rounded-full border border-slate-200/80 bg-white py-2 pl-10 pr-4 text-xs text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 hover:border-violet-200 hover:shadow-md hover:shadow-violet-100/60 focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
        </div>
      </div>

      {/* Delivery Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No deliveries found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(delivery => (
            <div key={delivery._id} className="premium-card p-5 hover:border-violet-200 hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="p-2.5 bg-violet-50 rounded-xl text-violet-600 flex-shrink-0"><Truck size={18} /></div>
                  <div>
                    <div className="font-mono text-xs text-violet-600 font-bold">{delivery.deliveryNumber}</div>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">{delivery.vendorName}</div>
                    <div className="text-xs text-slate-500">PO: {delivery.poNumber} · {delivery.deliveryLocation}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 sm:flex-shrink-0">
                  <div className="text-right">
                    <div className="flex items-center space-x-1.5 text-xs text-slate-500">
                      <Calendar size={11} />
                      <span>{new Date(delivery.scheduledDate).toLocaleDateString('en-IN')}</span>
                    </div>
                    {delivery.slotStart && (
                      <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5">
                        <Clock size={11} />
                        <span>{delivery.slotStart} – {delivery.slotEnd}</span>
                      </div>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border flex-shrink-0 ${statusColors[delivery.status] || 'bg-slate-100 text-slate-500'}`}>
                    {delivery.status?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {delivery.deliveryPersonName && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center space-x-4 text-xs text-slate-500">
                  <span>Person: <strong className="text-slate-700">{delivery.deliveryPersonName}</strong></span>
                  {delivery.vehicleNumber && <span>Vehicle: <strong className="text-slate-700">{delivery.vehicleNumber}</strong></span>}
                  {delivery.challanNumber && <span>Challan: <strong className="text-slate-700">{delivery.challanNumber}</strong></span>}
                </div>
              )}

              {/* QR Pass Info */}
              {delivery.status === 'PASS_GENERATED' && (
                <div className="mt-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs text-violet-700">
                      <QrCode size={14} />
                      <span className="font-bold">Pass Active</span>
                      <span className="text-violet-500">Backup Code: <strong className="font-mono">{delivery.backupCode}</strong></span>
                    </div>
                    <span className="text-[11px] text-violet-500">Valid until {new Date(delivery.passValidUntil).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              {canManage && delivery.status === 'SCHEDULED' && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => handleGeneratePass(delivery._id)} disabled={generatingPass === delivery._id}
                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-2 px-4 rounded-lg transition-all disabled:opacity-50 flex items-center space-x-1.5">
                    {generatingPass === delivery._id ? <div className="h-3 w-3 border-t border-white rounded-full animate-spin" /> : <QrCode size={13} />}
                    <span>Generate Pass</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
