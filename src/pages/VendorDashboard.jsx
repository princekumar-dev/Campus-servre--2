import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { ShoppingCart, Truck, IndianRupee, Clock, ChevronRight } from 'lucide-react'
import { PageHeader, KpiCard, ActionCard, GlassPanel } from '../components/ui'

export default function VendorDashboard() {
  const [stats, setStats] = useState({ activePOs: 0, pendingAcceptance: 0, upcomingDeliveries: 0, fulfilledPOs: 0 })
  const [recentPOs, setRecentPOs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useAlert()
  const auth = getAuthOrNull()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [poRes, delRes] = await Promise.all([
          apiClient.get('/api/purchase-orders'),
          apiClient.get('/api/deliveries')
        ])
        if (poRes.success) {
          const pos = poRes.data
          setStats(s => ({
            ...s,
            activePOs: pos.filter(p => ['ACTIVE', 'SENT_TO_VENDOR', 'VENDOR_ACCEPTED'].includes(p.status)).length,
            pendingAcceptance: pos.filter(p => p.status === 'SENT_TO_VENDOR').length,
            fulfilledPOs: pos.filter(p => ['FULFILLED', 'CLOSED'].includes(p.status)).length,
          }))
          setRecentPOs(pos.slice(0, 5))
        }
        if (delRes.success) {
          setStats(s => ({
            ...s,
            upcomingDeliveries: delRes.data.filter(d => ['SCHEDULED', 'PASS_GENERATED'].includes(d.status)).length,
          }))
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
        title="Vendor Dashboard"
        subtitle={`Welcome back, ${auth?.name || 'Vendor'}`}
        role="vendor"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active POs', value: stats.activePOs, icon: ShoppingCart, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Pending Acceptance', value: stats.pendingAcceptance, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Upcoming Deliveries', value: stats.upcomingDeliveries, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Fulfilled POs', value: stats.fulfilledPOs, icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(({ label, value, icon, color, bg }) => (
          <KpiCard key={label} label={label} value={value} icon={icon} iconBg={bg} iconColor={color} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel>
          <div className="flex justify-between items-center mb-4">
            <h2 className="section-title">Recent Purchase Orders</h2>
            <Link to="/purchase-orders" className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1">View All <ChevronRight size={12} /></Link>
          </div>
          <div className="space-y-3">
            {recentPOs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No purchase orders yet</p>
            ) : recentPOs.map(po => (
              <Link key={po._id} to={`/purchase-orders/${po._id}`} className="premium-list-item">
                <div>
                  <div className="font-mono text-xs text-violet-600 font-bold">{po.poNumber}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{po.vendorName}</div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${po.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {po.status?.replace(/_/g, ' ')}
                </span>
              </Link>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel>
          <h2 className="section-title mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <ActionCard to="/purchase-orders" icon={ShoppingCart} title="View Purchase Orders" desc="Check assigned POs" />
            <ActionCard to="/deliveries" icon={Truck} iconBg="bg-blue-50" iconColor="text-blue-600" title="Manage Deliveries" desc="Schedule and track" />
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
