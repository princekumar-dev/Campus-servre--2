import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { Shield, Search, Filter } from 'lucide-react'

export default function AdminAudit() {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [entityFilter, setEntityFilter] = useState('ALL')
  const { showError } = useAlert()

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/reports?reportType=audit')
      if (res.success) setLogs(res.data || [])
    } catch (err) { showError('Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const entities = ['ALL', ...new Set(logs.map(l => l.entityType).filter(Boolean))]
  const filtered = logs.filter(l => {
    const matchSearch = !searchQuery ||
      l.entityType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.actorName?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchEntity = entityFilter === 'ALL' || l.entityType === entityFilter
    return matchSearch && matchEntity
  })

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Audit Logs</h1>
        <p className="text-xs text-slate-500 mt-1">Track all system actions and changes</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 p-4 premium-card">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by entity, action, user..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-lg py-2 pl-9 pr-4 text-xs focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none transition-all" />
        </div>
        <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none">
          {entities.map(e => <option key={e} value={e}>{e === 'ALL' ? 'All Entities' : e}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Shield size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No audit logs found</p>
        </div>
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 text-xs font-semibold text-slate-800">{log.entityType}</td>
                    <td className="px-5 py-4 text-xs text-slate-600">{log.action}</td>
                    <td className="px-5 py-4 text-xs text-slate-700">{log.actorName || '—'}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">{log.actorRole || '—'}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">{log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN') : '—'}</td>
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
