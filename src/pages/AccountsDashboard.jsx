import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { IndianRupee, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { PageHeader, KpiCard, ActionCard, GlassPanel } from '../components/ui'

export default function AccountsDashboard() {
  const [stats, setStats] = useState({ approved: 0, pending: 0, paid: 0, overdue: 0 })
  const [recentInvoices, setRecentInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useAlert()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invRes] = await Promise.all([
          apiClient.get('/api/invoices'),
          apiClient.get('/api/payments')
        ])
        if (invRes.success) {
          const invoices = invRes.data
          setStats({
            approved: invoices.filter(i => i.status === 'APPROVED').length,
            pending: invoices.filter(i => i.status === 'SUBMITTED').length,
            paid: invoices.filter(i => i.status === 'PAID').length,
            overdue: 0,
          })
          setRecentInvoices(invoices.filter(i => i.status === 'APPROVED').slice(0, 5))
        }
      } catch (err) { showError('Error', err.message) }
      finally { setIsLoading(false) }
    }
    fetchData()
  }, [showError])

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="premium-spinner" /></div>

  return (
    <div className="space-y-6 page-enter">
      <PageHeader
        title="Accounts Dashboard"
        subtitle="Manage invoices, payments, and vendor ledgers"
        role="accounts"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Approved Invoices', value: stats.approved, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Paid This Month', value: stats.paid, icon: IndianRupee, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Overdue', value: stats.overdue, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map(({ label, value, icon, color, bg }) => (
          <KpiCard key={label} label={label} value={value} icon={icon} iconBg={bg} iconColor={color} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel>
          <h2 className="section-title mb-4">Approved Invoices Awaiting Payment</h2>
          <div className="space-y-2">
            {recentInvoices.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No invoices awaiting payment</p>
            ) : recentInvoices.map(inv => (
              <div key={inv._id} className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/80 border border-emerald-200/60">
                <div>
                  <div className="font-mono text-xs text-violet-600 font-bold">{inv.invoiceNumber || '—'}</div>
                  <div className="text-xs text-slate-600">{inv.poNumber || '—'}</div>
                </div>
                <div className="text-sm font-bold text-slate-800">₹{(inv.grandTotal || 0).toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel>
          <h2 className="section-title mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <ActionCard to="/accounts/payments" icon={IndianRupee} iconBg="bg-emerald-50" iconColor="text-emerald-600" title="Record Payments" desc="Process vendor settlements" />
            <ActionCard to="/reports" icon={FileText} iconBg="bg-violet-50" iconColor="text-violet-600" title="Financial Reports" desc="Department and vendor spend" />
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
