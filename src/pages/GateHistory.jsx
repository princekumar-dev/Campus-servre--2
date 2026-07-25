import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { Clock, CheckCircle, Search } from 'lucide-react'

export default function GateHistory() {
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
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
      e.grnNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.receivedByName?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchType = typeFilter === 'ALL' || e.grnType === typeFilter
    return matchSearch && matchType
  })

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Gate History</h1>
        <p className="text-xs text-slate-500 mt-1">Complete history of purchase orders received through gate QR verification</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 p-4 premium-card">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by PO, GRN, or receiver..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-lg py-2 pl-9 pr-4 text-xs focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none transition-all" />
        </div>
        <div className="flex gap-2">
          {['ALL', 'PARTIAL', 'FINAL'].map(d => (
            <button key={d} onClick={() => setTypeFilter(d)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${typeFilter === d ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
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
                  <th className="px-5 py-3">GRN Number</th>
                  <th className="px-5 py-3">Receipt Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Received By</th>
                  <th className="px-5 py-3 text-right">GRN Value</th>
                  <th className="px-5 py-3">Received At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-violet-600">{entry.poNumber || '—'}</td>
                    <td className="px-5 py-4 font-mono text-xs font-bold text-slate-700">{entry.grnNumber || '—'}</td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-700">{entry.grnType}</td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <CheckCircle size={12} /> {entry.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">{entry.receivedByName || 'Gate verification'}</td>
                    <td className="px-5 py-4 text-right text-xs font-bold text-slate-800">₹{Number(entry.grandTotal || 0).toFixed(2)}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">{new Date(entry.receivedAt || entry.createdAt).toLocaleString('en-IN')}</td>
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
