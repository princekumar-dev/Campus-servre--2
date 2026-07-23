import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '../components/AlertContext'
import ModalShell from '../components/ModalShell'
import apiClient from '../utils/apiClient'
import { IndianRupee, Plus, Search, CheckCircle, Clock } from 'lucide-react'

function RecordPaymentModal({ onClose, onSaved, invoice }) {
  const [form, setForm] = useState({ amount: '', method: 'BANK_TRANSFER', referenceNumber: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const { showSuccess, showError } = useAlert()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.amount) return showError('Missing Amount', 'Enter payment amount')
    setLoading(true)
    try {
      const res = await apiClient.post('/api/payments', { ...form, invoiceId: invoice?._id })
      if (res.success) { showSuccess('Payment Recorded', `₹${Number(form.amount).toLocaleString('en-IN')} recorded`); onSaved() }
      else showError('Error', res.error)
    } finally { setLoading(false) }
  }

  return (
    <ModalShell panelClassName="max-w-md space-y-5 animate-fadeIn">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">Record Payment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        {invoice && (
          <div className="bg-slate-50 rounded-xl p-4 text-xs space-y-1">
            <div>Invoice: <strong className="text-violet-600">{invoice.invoiceNumber}</strong></div>
            <div>Amount Due: <strong className="text-slate-800">₹{(invoice.grandTotal || 0).toLocaleString('en-IN')}</strong></div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Amount *</label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Method *</label>
            <select value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all">
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CREDIT_CARD">Credit Card</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Reference Number</label>
            <input type="text" value={form.referenceNumber} onChange={e => setForm(p => ({ ...p, referenceNumber: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all" placeholder="Transaction/Cheque number" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 transition-all resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 font-semibold text-sm py-2.5 rounded-xl hover:bg-slate-50 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all disabled:opacity-50">
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
    </ModalShell>
  )
}

export default function AccountsPayments() {
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [showRecord, setShowRecord] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const { showError } = useAlert()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [payRes, invRes] = await Promise.all([
        apiClient.get('/api/payments'),
        apiClient.get('/api/invoices')
      ])
      if (payRes.success) setPayments(payRes.data)
      if (invRes.success) setInvoices(invRes.data)
    } catch (err) { showError('Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = payments.filter(p => filter === 'ALL' || p.method === filter)

  return (
    <div className="space-y-6 animate-fadeIn">
      {showRecord && <RecordPaymentModal onClose={() => { setShowRecord(false); setSelectedInvoice(null) }} onSaved={() => { setShowRecord(false); setSelectedInvoice(null); fetchData() }} invoice={selectedInvoice} />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Payments</h1>
          <p className="text-xs text-slate-500 mt-1">Record and track all payments</p>
        </div>
        <button onClick={() => setShowRecord(true)} className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center space-x-2 transition-all shadow-sm self-start">
          <Plus size={15} /><span>Record Payment</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <IndianRupee size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No payments recorded</p>
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
                  <th className="px-5 py-3">Recorded By</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => (
                  <tr key={p._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-violet-600">{p.paymentNumber}</td>
                    <td className="px-5 py-4 text-sm font-bold text-emerald-600">₹{(p.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-xs text-slate-600">{p.method}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">{p.referenceNumber || '—'}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">{p.recordedBy || '—'}</td>
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
