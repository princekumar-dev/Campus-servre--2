import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { QrCode, Keyboard, CheckCircle, XCircle, AlertCircle, Clock, Truck, Package, Eye } from 'lucide-react'

const rejectionReasons = [
  'EXPIRED', 'REVOKED', 'WRONG_DATE', 'WRONG_PERSON', 'WRONG_VEHICLE',
  'CANCELLED_PO', 'DUPLICATE_ENTRY', 'UNSCHEDULED_DELIVERY', 'OTHER'
]

function ScannerPanel({ onResult }) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const { showError } = useAlert()

  const handleScan = async (e) => {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true)
    try {
      const res = await apiClient.post('/api/gate?action=verify-qr', { token: token.trim() })
      onResult(res)
    } catch (err) { showError('Scan Error', err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:space-y-6 sm:p-8">
      <div className="flex items-center space-x-3">
        <div className="p-3 bg-violet-50 rounded-xl text-violet-600"><QrCode size={24} /></div>
        <div>
          <h2 className="font-bold text-slate-800">QR Code Scan</h2>
          <p className="text-xs text-slate-500">Scan vendor delivery QR pass</p>
        </div>
      </div>
      <form onSubmit={handleScan} className="space-y-4">
        <div className="space-y-3 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-4 text-center sm:p-8">
          <QrCode size={48} className="mx-auto text-violet-300" />
          <p className="text-xs text-slate-400 font-medium">Scan QR code or paste token below</p>
          <input
            type="text" value={token} onChange={e => setToken(e.target.value)}
            placeholder="Paste QR token here..."
            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-mono text-center focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            autoFocus
          />
        </div>
        <button type="submit" disabled={loading || !token.trim()}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black text-sm py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center space-x-2">
          {loading ? <div className="h-5 w-5 border-t-2 border-white rounded-full animate-spin" /> : <><QrCode size={16} /><span>Verify QR Pass</span></>}
        </button>
      </form>
    </div>
  )
}

function ManualCodePanel({ onResult }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { showError } = useAlert()

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    try {
      const res = await apiClient.post('/api/gate?action=verify-code', { code: code.trim() })
      onResult(res)
    } catch (err) { showError('Verify Error', err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:space-y-6 sm:p-8">
      <div className="flex items-center space-x-3">
        <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600"><Keyboard size={24} /></div>
        <div>
          <h2 className="font-bold text-slate-800">Manual Code Entry</h2>
          <p className="text-xs text-slate-500">Enter 6-digit backup delivery code</p>
        </div>
      </div>
      <form onSubmit={handleVerify} className="space-y-4">
        <div className="text-center">
          <input
            type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="• • • • • •"
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 text-3xl font-black text-center tracking-[0.5em] text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
            maxLength={8}
          />
          <p className="text-xs text-slate-400 mt-2">{code.length}/6-8 digits</p>
        </div>
        <button type="submit" disabled={loading || code.length < 6}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center space-x-2">
          {loading ? <div className="h-5 w-5 border-t-2 border-white rounded-full animate-spin" /> : <><Keyboard size={16} /><span>Verify Code</span></>}
        </button>
      </form>
    </div>
  )
}

function ResultCard({ result, onClear, onReject }) {
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  if (!result) return null
  const isApproved = result.decision === 'APPROVED'
  const delivery = result.delivery

  return (
    <div className={`rounded-2xl border-2 shadow-lg p-6 space-y-5 animate-fadeIn ${isApproved ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {isApproved ? <CheckCircle size={32} className="text-emerald-600" /> : <XCircle size={32} className="text-rose-600" />}
          <div>
            <h2 className={`text-xl font-black ${isApproved ? 'text-emerald-800' : 'text-rose-800'}`}>
              {isApproved ? '✓ ENTRY APPROVED' : '✗ ENTRY REJECTED'}
            </h2>
            <p className="text-xs font-medium mt-0.5 text-slate-600">
              {isApproved ? 'Vendor may proceed to receiving area' : (result.message || result.reason)}
            </p>
          </div>
        </div>
        <button onClick={onClear} className="text-slate-400 hover:text-slate-600 text-xl font-bold p-2">×</button>
      </div>

      {isApproved && delivery && (
        <div className="bg-white rounded-xl border border-emerald-200 p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delivery Information</h3>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {[
              { label: 'PO Number', value: delivery.poNumber },
              { label: 'Vendor', value: delivery.vendorName },
              { label: 'Delivery No.', value: delivery.deliveryNumber },
              { label: 'Person', value: delivery.deliveryPersonName || '—' },
              { label: 'Vehicle', value: delivery.vehicleNumber || '—' },
              { label: 'Location', value: delivery.deliveryLocation },
              { label: 'Slot', value: delivery.slotStart && delivery.slotEnd ? `${delivery.slotStart} – ${delivery.slotEnd}` : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
                <div className="font-semibold text-slate-800 mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          {delivery.items && delivery.items.length > 0 && (
            <div className="pt-3 border-t border-emerald-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Expected Items</div>
              {delivery.items.map((item, idx) => (
                <div key={idx} className="text-xs text-slate-600 flex justify-between">
                  <span>{item.description}</span>
                  <span className="font-semibold">{item.quantityExpected} {item.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!showReject && isApproved && (
        <button onClick={() => setShowReject(true)} className="text-xs text-rose-600 font-bold hover:text-rose-700 underline">
          Actually reject this entry?
        </button>
      )}

      {showReject && (
        <div className="bg-white border border-rose-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-rose-700">Select rejection reason:</p>
          <select value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none">
            <option value="">Select reason...</option>
            {rejectionReasons.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={() => onReject(rejectReason)} disabled={!rejectReason} className="w-full bg-rose-600 text-white font-bold text-xs py-2.5 rounded-lg disabled:opacity-50">Confirm Rejection</button>
        </div>
      )}
    </div>
  )
}

export default function GateScanner() {
  const [activeMode, setActiveMode] = useState('qr')
  const [result, setResult] = useState(null)
  const [todayEntries, setTodayEntries] = useState([])
  const { showSuccess, showError } = useAlert()
  const auth = getAuthOrNull()

  useEffect(() => {
    apiClient.get('/api/gate?action=today').then(res => {
      if (res.success) setTodayEntries(res.data)
    })
  }, [result])

  const handleResult = (res) => { setResult(res) }
  const handleClear = () => setResult(null)

  const handleReject = async (reason) => {
    try {
      await apiClient.post('/api/gate?action=reject', {
        deliveryScheduleId: result?.data?.deliveryScheduleId,
        reason,
        method: activeMode === 'qr' ? 'QR' : 'MANUAL_CODE'
      })
      showSuccess('Rejection Recorded', 'Entry rejected and logged')
      setResult(null)
    } catch (err) { showError('Error', err.message) }
  }

  return (
    <div className="space-y-6 animate-fadeIn max-w-2xl mx-auto">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Gate Security Scanner</h1>
        <p className="text-xs text-slate-500 mt-1">Verify vendor delivery passes for campus entry</p>
      </div>

      {/* Mode Toggle */}
      {!result && (
        <>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            <button onClick={() => setActiveMode('qr')} className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center space-x-2 ${activeMode === 'qr' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500'}`}>
              <QrCode size={16} /><span>QR Scan</span>
            </button>
            <button onClick={() => setActiveMode('code')} className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center space-x-2 ${activeMode === 'code' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500'}`}>
              <Keyboard size={16} /><span>Manual Code</span>
            </button>
          </div>

          {activeMode === 'qr' ? <ScannerPanel onResult={handleResult} /> : <ManualCodePanel onResult={handleResult} />}
        </>
      )}

      {result && <ResultCard result={result} onClear={handleClear} onReject={handleReject} />}

      {/* Today's Entries */}
      <div className="premium-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Gate Log</h2>
          <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">{todayEntries.length} entries</span>
        </div>
        {todayEntries.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">No gate entries recorded today</div>
        ) : (
          <div className="space-y-2">
            {todayEntries.slice(0, 10).map((entry, idx) => (
              <div key={idx} className={`flex items-center justify-between p-3 rounded-lg text-xs border ${entry.decision === 'APPROVED' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <div className="flex items-center space-x-2">
                  {entry.decision === 'APPROVED' ? <CheckCircle size={14} className="text-emerald-600 flex-shrink-0" /> : <XCircle size={14} className="text-rose-600 flex-shrink-0" />}
                  <div>
                    <div className="font-bold text-slate-800">{entry.poNumber || 'Unknown PO'}</div>
                    <div className="text-slate-500">{entry.actualDeliveryPersonName} · {entry.verificationMethod}</div>
                  </div>
                </div>
                <div className="text-right text-slate-400">
                  {new Date(entry.entryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
