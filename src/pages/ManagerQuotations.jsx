import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { FileText, Search, CheckCircle, Clock, XCircle } from 'lucide-react'

const statusColors = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-50 text-blue-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  REVISION_REQUIRED: 'bg-amber-50 text-amber-700',
}

export default function ManagerQuotations() {
  const [quotations, setQuotations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const { showError } = useAlert()

  const fetchQuotations = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/quotations')
      if (res.success) setQuotations(res.data)
    } catch (err) { showError('Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchQuotations() }, [fetchQuotations])

  const filtered = quotations.filter(q => filter === 'ALL' || q.status === filter)

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Quotations</h1>
        <p className="text-xs text-slate-500 mt-1">Manage and compare vendor quotations</p>
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
            <div key={q._id} className="premium-card p-5 hover:border-violet-200 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-2.5 bg-violet-50 rounded-xl text-violet-600"><FileText size={18} /></div>
                  <div>
                    <div className="font-mono text-xs text-violet-600 font-bold">{q.quotationNumber || q._id?.slice(-6)}</div>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">{q.vendorName || 'Unknown Vendor'}</div>
                    <div className="text-xs text-slate-500">Version {q.version || 1}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-slate-800">₹{(q.grandTotal || 0).toLocaleString('en-IN')}</div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[q.status] || 'bg-slate-100 text-slate-600'}`}>
                    {q.status?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
