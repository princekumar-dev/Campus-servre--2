import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { ShoppingCart, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { PageHeader, KpiCard, ActionCard, GlassPanel } from '../components/ui'

export default function AccountsDashboard() {
  const [stats, setStats] = useState({ total: 0, draft: 0, active: 0, completed: 0 })
  const [recentPOs, setRecentPOs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useAlert()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const poRes = await apiClient.get('/api/purchase-orders')
        if (poRes.success) {
          const pos = poRes.data || []
          setStats({
            total: pos.length,
            draft: pos.filter(po => ['DRAFT', 'REVISION_REQUIRED', 'SUBMITTED_FOR_APPROVAL'].includes(po.status)).length,
            active: pos.filter(po => ['ACTIVE', 'PARTIALLY_FULFILLED'].includes(po.status)).length,
            completed: pos.filter(po => ['FULFILLED', 'CLOSED'].includes(po.status)).length,
          })
          setRecentPOs(pos.slice(0, 5))
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
        subtitle="Track purchase orders from creation through closure"
        role="accounts"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total POs', value: stats.total, icon: ShoppingCart, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Draft / Under Review', value: stats.draft, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Active POs', value: stats.active, icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Completed POs', value: stats.completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(({ label, value, icon, color, bg }) => (
          <KpiCard key={label} label={label} value={value} icon={icon} iconBg={bg} iconColor={color} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel>
          <h2 className="section-title mb-4">Recent Purchase Orders</h2>
          <div className="space-y-2">
            {recentPOs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No purchase orders yet</p>
            ) : recentPOs.map(po => (
              <div key={po._id} className="flex items-center justify-between p-3 rounded-lg bg-violet-50/80 border border-violet-200/60">
                <div>
                  <div className="font-mono text-xs text-violet-600 font-bold">{po.poNumber || '—'}</div>
                  <div className="text-xs text-slate-600">{po.vendorName || '—'}</div>
                </div>
                <div className="text-xs font-bold text-slate-700">{po.status?.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel>
          <h2 className="section-title mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <ActionCard to="/purchase-orders" icon={ShoppingCart} iconBg="bg-violet-50" iconColor="text-violet-600" title="Purchase Orders" desc="View the complete PO workflow" />
            <ActionCard to="/grn" icon={FileText} iconBg="bg-emerald-50" iconColor="text-emerald-600" title="Goods Receipts" desc="View finalized GRNs" />
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
