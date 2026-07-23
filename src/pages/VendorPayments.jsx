import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { IndianRupee, CheckCircle, Clock, AlertCircle } from 'lucide-react'

export default function VendorPayments() {
  const [payments, setPayments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useAlert()

  useEffect(() => {
    const fetchPayments = async () => {
      setIsLoading(true)
      try {
        const res = await apiClient.get('/api/payments')
        if (res.success) setPayments(res.data)
      } catch (err) { showError('Error', err.message) }
      finally { setIsLoading(false) }
    }
    fetchPayments()
  }, [showError])

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0)

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Payment Status</h1>
        <p className="text-xs text-slate-500 mt-1">Track payments against your invoices</p>
      </div>

      <div className="premium-kpi p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Received</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">₹{totalPaid.toLocaleString('en-IN')}</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl"><IndianRupee size={24} className="text-emerald-600" /></div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : payments.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <IndianRupee size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No payments recorded yet</p>
        </div>
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Payment #</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => (
                  <tr key={p._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-violet-600">{p.paymentNumber}</td>
                    <td className="px-5 py-4 text-sm font-bold text-emerald-600">₹{(p.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-xs text-slate-600">{p.method}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">{p.referenceNumber || '—'}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">{p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN') : '—'}</td>
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
