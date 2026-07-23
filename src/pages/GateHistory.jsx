import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { Clock, CheckCircle, XCircle, Search, Filter } from 'lucide-react'

export default function GateHistory() {
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [decisionFilter, setDecisionFilter] = useState('ALL')
  const { showError } = useAlert()

  const fetchHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/gate?action=history')
      if (res.success) setEntries(res.data)
    } catch (err) { showError('Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const filtered = entries.filter(e => {
    const matchSearch = !searchQuery ||
      e.poNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.actualDeliveryPersonName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.actualVehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchDecision = decisionFilter === 'ALL' || e.decision === decisionFilter
    return matchSearch && matchDecision
  })

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Gate History</h1>
        <p className="text-xs text-slate-500 mt-1">Complete log of all gate entries and exits</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 p-4 premium-card">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by PO, person, vehicle..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-lg py-2 pl-9 pr-4 text-xs focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none transition-all" />
        </div>
        <div className="flex gap-2">
          {['ALL', 'APPROVED', 'REJECTED'].map(d => (
            <button key={d} onClick={() => setDecisionFilter(d)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${decisionFilter === d ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {d === 'ALL' ? 'All' : d}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No gate entries found</p>
        </div>
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">PO Number</th>
                  <th className="px-5 py-3">Delivery Person</th>
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Decision</th>
                  <th className="px-5 py-3">Entry Time</th>
                  <th className="px-5 py-3">Exit Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-violet-600">{entry.poNumber || '—'}</td>
                    <td className="px-5 py-4 text-xs text-slate-700">{entry.actualDeliveryPersonName || '—'}</td>
                    <td className="px-5 py-4 text-xs text-slate-700">{entry.actualVehicleNumber || '—'}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">{entry.verificationMethod}</td>
                    <td className="px-5 py-4">
                      <span className={`flex items-center gap-1 text-xs font-bold ${entry.decision === 'APPROVED' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {entry.decision === 'APPROVED' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {entry.decision}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">{new Date(entry.entryTime).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">{entry.exitTime ? new Date(entry.exitTime).toLocaleString('en-IN') : '—'}</td>
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
