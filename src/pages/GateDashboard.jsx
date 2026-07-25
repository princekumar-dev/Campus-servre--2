import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { QrCode, Package, CheckCircle, ClipboardCheck, Clock } from 'lucide-react'
import { PageHeader, KpiCard, ActionCard, GlassPanel } from '../components/ui'

export default function GateDashboard() {
  const [stats, setStats] = useState({ readyToReceive: 0, receivedToday: 0, partialToday: 0, closedToday: 0 })
  const [recentEntries, setRecentEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useAlert()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const gateRes = await apiClient.get('/api/gate?action=summary', { cache: false })
        if (gateRes.success) {
          setStats({
            readyToReceive: gateRes.data.readyToReceive || 0,
            receivedToday: gateRes.data.receivedToday || 0,
            partialToday: gateRes.data.partialToday || 0,
            closedToday: gateRes.data.closedToday || 0,
          })
          setRecentEntries(gateRes.data.recent || [])
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
        subtitle="Verify purchase orders and monitor goods receiving"
        role="gate"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ready to Receive', value: stats.readyToReceive, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Received Today', value: stats.receivedToday, icon: ClipboardCheck, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Partial Today', value: stats.partialToday, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'POs Closed Today', value: stats.closedToday, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
              <div key={entry._id || idx} className="flex items-center justify-between rounded-lg border border-emerald-200/60 bg-emerald-50/80 p-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle size={14} className="text-emerald-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">{entry.poNumber || 'Unknown PO'}</div>
                    <div className="text-xs text-slate-500">{entry.grnNumber} · {entry.grnType}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-400">{new Date(entry.receivedAt || entry.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel>
          <h2 className="section-title mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <ActionCard to="/gate" icon={QrCode} title="Scan PO QR / Enter PO Number" desc="Verify and record received goods" />
            <ActionCard to="/gate/history" icon={Clock} iconBg="bg-blue-50" iconColor="text-blue-600" title="Receiving History" desc="View past PO and GRN receipts" />
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
