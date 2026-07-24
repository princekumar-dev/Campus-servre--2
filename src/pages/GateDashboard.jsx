import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { QrCode, Truck, CheckCircle, XCircle, Clock } from 'lucide-react'
import { PageHeader, KpiCard, ActionCard, GlassPanel } from '../components/ui'

export default function GateDashboard() {
  const [stats, setStats] = useState({ expected: 0, arrived: 0, inside: 0, exited: 0, rejected: 0 })
  const [recentEntries, setRecentEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useAlert()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gateRes, deliveriesRes] = await Promise.all([
          apiClient.get('/api/gate?action=today'),
          apiClient.get('/api/deliveries')
        ])
        if (gateRes.success) {
          const entries = gateRes.data
          setStats({
            expected: deliveriesRes.success
              ? deliveriesRes.data.filter(d => ['SCHEDULED', 'PASS_GENERATED', 'AT_GATE'].includes(d.status)).length
              : 0,
            arrived: entries.length,
            inside: entries.filter(e => !e.exitTime && e.decision === 'APPROVED').length,
            exited: entries.filter(e => e.exitTime).length,
            rejected: entries.filter(e => e.decision === 'REJECTED').length,
          })
          setRecentEntries(entries.slice(0, 8))
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
        title="Gate Security Dashboard"
        subtitle="Monitor campus entry and exit activity"
        role="gate"
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Expected Today', value: stats.expected, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Arrived', value: stats.arrived, icon: Truck, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Inside Campus', value: stats.inside, icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Exited', value: stats.exited, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map(({ label, value, icon, color, bg }) => (
          <KpiCard key={label} label={label} value={value} icon={icon} iconBg={bg} iconColor={color} centered />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel>
          <div className="flex justify-between items-center mb-4">
            <h2 className="section-title">Recent Gate Activity</h2>
            <Link to="/gate/history" className="text-xs font-bold text-violet-600 hover:text-violet-700">View All</Link>
          </div>
          <div className="space-y-2">
            {recentEntries.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No entries today</p>
            ) : recentEntries.map((entry, idx) => (
              <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${entry.decision === 'APPROVED' ? 'bg-emerald-50/80 border-emerald-200/60' : 'bg-rose-50/80 border-rose-200/60'}`}>
                <div className="flex items-center space-x-2">
                  {entry.decision === 'APPROVED' ? <CheckCircle size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-rose-600" />}
                  <div>
                    <div className="text-xs font-bold text-slate-800">{entry.poNumber || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{entry.actualDeliveryPersonName} · {entry.actualVehicleNumber}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-400">{new Date(entry.entryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel>
          <h2 className="section-title mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <ActionCard to="/gate" icon={QrCode} title="Scan QR / Manual Entry" desc="Verify delivery pass" />
            <ActionCard to="/gate/history" icon={Clock} iconBg="bg-blue-50" iconColor="text-blue-600" title="Gate History" desc="View past entries" />
            <ActionCard to="/gate/vehicles" icon={Truck} iconBg="bg-amber-50" iconColor="text-amber-600" title="Vehicles Inside" desc="Currently on campus" />
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
