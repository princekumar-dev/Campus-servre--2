import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { FileText, Upload, CheckCircle, Clock, AlertCircle, Search } from 'lucide-react'

const statusColors = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-50 text-blue-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  PAID: 'bg-violet-50 text-violet-700',
}

export default function VendorInvoices() {
  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const { showError } = useAlert()

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/invoices')
      if (res.success) setInvoices(res.data)
    } catch (err) { showError('Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const filtered = invoices.filter(i => filter === 'ALL' || i.status === filter)

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">My Invoices</h1>
        <p className="text-xs text-slate-500 mt-1">Track invoice status and payments</p>
      </div>

      <div className="flex flex-wrap gap-2 p-4 premium-card">
        {['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === s ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {s === 'ALL' ? 'All' : s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No invoices found</p>
        </div>
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">PO Number</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(inv => (
                  <tr key={inv._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-violet-600">{inv.invoiceNumber || '—'}</td>
                    <td className="px-5 py-4 text-xs text-slate-600">{inv.poNumber || '—'}</td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-800">₹{(inv.grandTotal || 0).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[inv.status] || 'bg-slate-100 text-slate-600'}`}>
                        {inv.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : '—'}</td>
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
