import { useState, useEffect } from 'react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { ClipboardCheck, Truck, Package, AlertTriangle, Clock } from 'lucide-react'
import { PageHeader, KpiCard, ActionCard, GlassPanel } from '../components/ui'

export default function ReceivingDashboard() {
  const [stats, setStats] = useState({ awaiting: 0, receiving: 0, partials: 0, damaged: 0, grns: 0 })
  const [queue, setQueue] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useAlert()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [delRes, grnRes] = await Promise.all([
          apiClient.get('/api/deliveries'),
          apiClient.get('/api/grn')
        ])
        if (delRes.success) {
          const dels = delRes.data
          setStats({
            awaiting: dels.filter(d => d.status === 'ENTRY_APPROVED').length,
            receiving: dels.filter(d => d.status === 'IN_INSPECTION').length,
            partials: dels.filter(d => d.status === 'PARTIALLY_RECEIVED').length,
            damaged: dels.filter(d => d.status === 'IN_INSPECTION').length,
            grns: grnRes.success ? grnRes.data.length : 0,
          })
          setQueue(dels.filter(d => ['ENTRY_APPROVED', 'IN_INSPECTION', 'PARTIALLY_RECEIVED'].includes(d.status)).slice(0, 6))
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
        title="Receiving Dashboard"
        subtitle="Inspect deliveries and record goods receipts"
        role="receiving_officer"
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Awaiting Inspection', value: stats.awaiting, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Currently Receiving', value: stats.receiving, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Partial Deliveries', value: stats.partials, icon: Truck, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Damaged Items', value: stats.damaged, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Total GRNs', value: stats.grns, icon: ClipboardCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(({ label, value, icon, color, bg }) => (
          <KpiCard key={label} label={label} value={value} icon={icon} iconBg={bg} iconColor={color} centered />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel>
          <h2 className="section-title mb-4">Receiving Queue</h2>
          <div className="space-y-2">
            {queue.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No deliveries awaiting inspection</p>
            ) : queue.map(d => (
              <div key={d._id} className="premium-list-item">
                <div>
                  <div className="font-mono text-xs text-violet-600 font-bold">{d.deliveryNumber}</div>
                  <div className="text-xs text-slate-600">{d.vendorName} · {d.poNumber}</div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.status === 'ENTRY_APPROVED' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {d.status?.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel>
          <h2 className="section-title mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <ActionCard to="/deliveries" icon={Truck} title="Delivery Queue" desc="View all deliveries" />
            <ActionCard to="/grn" icon={ClipboardCheck} iconBg="bg-emerald-50" iconColor="text-emerald-600" title="Record GRN" desc="Goods receipt notes" />
            <ActionCard to="/receiving/damaged" icon={AlertTriangle} iconBg="bg-rose-50" iconColor="text-rose-600" title="Damaged Goods" desc="Log inspection issues" />
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
