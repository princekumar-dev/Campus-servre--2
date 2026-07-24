import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { formatDistanceToNow } from 'date-fns'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import {
  ClipboardList, PlusCircle, AlertCircle, CheckCircle2,
  Wrench, FileCheck, Search, Users, Settings, Building2, ShoppingCart,
  Truck, QrCode, ClipboardCheck, Clock, TrendingUp,
  Eye, ChevronRight, CircleDot
} from 'lucide-react'
import { KpiCard, ActionCard, GlassPanel } from '../components/ui'

const STATUS_COLORS = {
  submitted: '#3b82f6',
  approved: '#10b981',
  assigned_to_manager: '#3b82f6',
  purchase_order_created: '#8b5cf6',
  in_progress: '#8b5cf6',
  quotation_submitted: '#f59e0b',
  work_order_created: '#6366f1',
  technician_completed: '#22c55e',
  payment_pending: '#f97316',
  closed: '#64748b',
}

const ROLE_GREETINGS = {
  requester: { title: 'Your Service Hub', sub: 'Submit and track your maintenance requests' },
  admin: { title: 'Command Center', sub: 'Oversee campus operations and approve workflows' },
  super_admin: { title: 'System Overview', sub: 'Manage users, settings, and platform health' },
  manager: { title: 'Purchase Operations', sub: 'Create purchase orders and upload signed proof' },
  technician: { title: 'Work Orders', sub: 'Accept jobs, log progress, and record materials' },
  accounts: { title: 'Purchase Overview', sub: 'Track purchase orders through completion' },
  gate: { title: 'Gate Control', sub: 'Verify delivery passes and scan QR codes' },
  receiving_officer: { title: 'Receiving Desk', sub: 'Log goods received and inspect deliveries' },
  vendor: { title: 'Vendor Portal', sub: 'Manage assigned orders and deliveries' },
  hod: { title: 'Department Hub', sub: 'Submit and track department requests' },
  staff: { title: 'Staff Portal', sub: 'Submit and track your service requests' },
  delivery_person: { title: 'Delivery Dashboard', sub: 'View your delivery schedule and status' },
}

function SkeletonLoader() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="skeleton h-[380px] rounded-3xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
      <div className="skeleton h-64 rounded-xl" />
    </div>
  )
}

function Dashboard() {
  const [stats, setStats] = useState({
    totalRequests: 0, pendingAdmin: 0, activeWork: 0, pendingInvoicing: 0,
    pendingPayment: 0, closed: 0, totalExpenses: 0, totalQuotations: 0,
    byStatus: {}, byPriority: {}, recentActivity: []
  })
  const [recentRequests, setRecentRequests] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useAlert()
  const auth = getAuthOrNull()
  const navigate = useNavigate()
  const heroRef = useRef(null)

  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, requestsRes] = await Promise.all([
          apiClient.get('/api/reports'),
          apiClient.get('/api/requests?summary=dashboard')
        ])
        if (statsRes.success) setStats(statsRes.stats)
        if (requestsRes.success) {
          setRecentRequests(requestsRes.data.slice(0, 8))
        }
      } catch (err) {
        showError('Fetch Error', 'Failed to retrieve dashboard data')
      } finally {
        setIsLoading(false)
      }
    }
    fetchDashboardData()
  }, [showError])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible')
      }),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [isLoading])

  const handleSearchSubmit = useCallback((e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/requests?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }, [searchQuery, navigate])

  const getGreeting = () => {
    const hour = currentTime.getHours()
    const period = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    return `${period}, ${auth?.name?.split(' ')[0] || 'there'}`
  }

  const getTimeString = () => {
    return currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const getDateString = () => {
    return currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const pieData = stats.byStatus ? Object.entries(stats.byStatus)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value,
      color: STATUS_COLORS[name] || '#94a3b8'
    })) : []

  const kpiCards = getKPICards()

  function getKPICards() {
    if (auth?.role === 'admin' || auth?.role === 'super_admin') {
      return [
        { label: 'Requests to Classify', value: stats.requestsToClassify, icon: ClipboardCheck, bg: 'bg-rose-50', textColor: 'text-rose-600', sub: 'Awaiting triage' },
        { label: 'Signed POs to Verify', value: stats.signedPOsPending, icon: FileCheck, bg: 'bg-amber-50', textColor: 'text-amber-600', sub: 'Proof awaiting review' },
        { label: 'Active POs', value: stats.activePOs, icon: ShoppingCart, bg: 'bg-blue-50', textColor: 'text-blue-600', sub: 'Gate receiving enabled' },
        { label: 'Closed POs', value: stats.closedPOs, icon: CheckCircle2, bg: 'bg-emerald-50', textColor: 'text-emerald-600', sub: 'Workflow completed' },
      ]
    }
    if (auth?.role === 'manager') {
      return [
        { label: 'Assigned Requests', value: stats.assignedRequests, icon: ClipboardCheck, bg: 'bg-violet-50', textColor: 'text-violet-600', sub: 'Ready for PO creation' },
        { label: 'Draft / Revision POs', value: stats.draftPOs, icon: FileCheck, bg: 'bg-amber-50', textColor: 'text-amber-600', sub: 'Signed proof required' },
        { label: 'Awaiting Admin Verification', value: stats.signedPOsPending, icon: Clock, bg: 'bg-blue-50', textColor: 'text-blue-600', sub: 'Signed proof submitted' },
        { label: 'Completed POs', value: (stats.fulfilledPOs || 0) + (stats.closedPOs || 0), icon: CheckCircle2, bg: 'bg-emerald-50', textColor: 'text-emerald-600', sub: 'Fulfilled or closed' },
      ]
    }
    if (auth?.role === 'gate') {
      return [
        { label: 'Awaiting Gate Scan', value: stats.awaitingGate, icon: QrCode, bg: 'bg-violet-50', textColor: 'text-violet-600', sub: 'Valid delivery passes' },
        { label: 'Approved Today', value: stats.gateApprovedToday, icon: ClipboardCheck, bg: 'bg-blue-50', textColor: 'text-blue-600', sub: 'Successful scans' },
        { label: 'Rejected Today', value: stats.gateRejectedToday, icon: AlertCircle, bg: 'bg-rose-50', textColor: 'text-rose-600', sub: 'Denied entries' },
        { label: 'Closed POs', value: stats.closedPOs, icon: CheckCircle2, bg: 'bg-emerald-50', textColor: 'text-emerald-600', sub: 'Workflow completed' },
      ]
    }
    if (auth?.role === 'receiving_officer') {
      return [
        { label: 'Awaiting Receipt', value: stats.awaitingReceipt, icon: Truck, bg: 'bg-amber-50', textColor: 'text-amber-600', sub: 'Gate approved' },
        { label: 'Partial Receipts', value: stats.partialReceipts, icon: ClipboardCheck, bg: 'bg-blue-50', textColor: 'text-blue-600', sub: 'More goods expected' },
        { label: 'Completed Receipts', value: stats.completedReceipts, icon: FileCheck, bg: 'bg-violet-50', textColor: 'text-violet-600', sub: 'Fully received' },
        { label: 'Finalized GRNs', value: stats.finalizedGrns, icon: CheckCircle2, bg: 'bg-emerald-50', textColor: 'text-emerald-600', sub: 'Receipt records' },
      ]
    }
    if (auth?.role === 'vendor') {
      return [
        { label: 'Total POs', value: stats.totalPOs, icon: ShoppingCart, bg: 'bg-violet-50', textColor: 'text-violet-600', sub: 'Assigned orders' },
        { label: 'Active POs', value: stats.activePOs, icon: Truck, bg: 'bg-blue-50', textColor: 'text-blue-600', sub: 'Ready for delivery' },
        { label: 'Fulfilled POs', value: stats.fulfilledPOs, icon: ClipboardCheck, bg: 'bg-amber-50', textColor: 'text-amber-600', sub: 'Goods received' },
        { label: 'Closed POs', value: stats.closedPOs, icon: CheckCircle2, bg: 'bg-emerald-50', textColor: 'text-emerald-600', sub: 'Workflow completed' },
      ]
    }
    if (auth?.role === 'accounts') {
      return [
        { label: 'Total Requests', value: stats.totalRequests, icon: ClipboardList, bg: 'bg-violet-50', textColor: 'text-violet-600', sub: 'All requests' },
        { label: 'Total POs', value: stats.totalPOs, icon: ShoppingCart, bg: 'bg-blue-50', textColor: 'text-blue-600', sub: 'All purchase orders' },
        { label: 'Fulfilled POs', value: stats.fulfilledPOs, icon: Truck, bg: 'bg-amber-50', textColor: 'text-amber-600', sub: 'Goods received' },
        { label: 'Closed POs', value: stats.closedPOs, icon: CheckCircle2, bg: 'bg-emerald-50', textColor: 'text-emerald-600', sub: 'Workflow completed' },
      ]
    }
    return [
      { label: 'Total Requests', value: stats.totalRequests, icon: ClipboardList, bg: 'bg-violet-50', textColor: 'text-violet-600', sub: 'Requests submitted' },
      { label: 'Awaiting Admin', value: stats.byStatus?.submitted, icon: Clock, bg: 'bg-amber-50', textColor: 'text-amber-600', sub: 'Pending classification' },
      { label: 'Assigned to Manager', value: stats.assignedRequests, icon: Wrench, bg: 'bg-blue-50', textColor: 'text-blue-600', sub: 'PO preparation' },
      { label: 'PO Completed', value: (stats.fulfilledPOs || 0) + (stats.closedPOs || 0), icon: CheckCircle2, bg: 'bg-emerald-50', textColor: 'text-emerald-600', sub: 'Fulfilled or closed' },
    ]
  }

  if (isLoading) return <SkeletonLoader />

  const heroInfo = ROLE_GREETINGS[auth?.role] || ROLE_GREETINGS.requester

  return (
    <div className="space-y-8">

      {/* Hero Banner */}
      <div ref={heroRef} className="dashboard-hero bg-cover bg-center" style={{ backgroundImage: "url('/images/campus.jpeg')" }}>
        <div className="dashboard-hero-content">
          <div className="hero-time-pill">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-white/80 text-xs font-semibold">{getTimeString()}</span>
            <span className="text-white/40">|</span>
            <span className="text-white/80 text-xs font-semibold">{getDateString()}</span>
          </div>

          <h1 className="hero-greeting">{getGreeting()}</h1>
          <p className="hero-subtitle">{heroInfo.sub}</p>

          <form onSubmit={handleSearchSubmit} className="hero-search">
            <Search size={18} className="text-slate-400 ml-4 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search requests by number, asset, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-slate-800 placeholder-slate-500 text-sm px-3 py-2 w-full focus:outline-none"
            />
            <button type="submit" className="btn-premium py-2.5 px-6 rounded-full flex-shrink-0 text-sm">
              Search
            </button>
          </form>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <KpiCard
            key={i}
            label={card.label}
            value={card.value}
            sub={card.sub}
            icon={card.icon}
            iconBg={card.bg}
            iconColor={card.textColor}
            className="scroll-reveal"
          />
        ))}
      </div>

      {/* Operations Center + Status Chart (admin/manager) */}
      <div className={`grid gap-6 ${(auth?.role === 'admin' || auth?.role === 'super_admin' || auth?.role === 'manager') && pieData.length > 0 ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {/* Quick Actions */}
        <div className={`${(auth?.role === 'admin' || auth?.role === 'super_admin' || auth?.role === 'manager') && pieData.length > 0 ? 'lg:col-span-2' : ''}`}>
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4">Operations Center</h2>
          {renderQuickActions()}
        </div>

        {/* Status Distribution Chart */}
        {(auth?.role === 'admin' || auth?.role === 'super_admin' || auth?.role === 'manager') && pieData.length > 0 && (
          <div>
            <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4">Status Distribution</h2>
            <GlassPanel padding="p-4">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
              {pieData.map((entry, idx) => (
                <div key={idx} className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: entry.color }} />
                  <span className="truncate capitalize">{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
            </GlassPanel>
          </div>
        )}
      </div>

      {/* Recent Activity + Requests Table */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Requests Table */}
        <GlassPanel className="lg:col-span-2">
          <div className="flex justify-between items-center mb-5">
            <h2 className="section-title">Recent Requests</h2>
            <Link to="/requests" className="text-sm font-bold text-violet-600 hover:text-violet-700 transition-all flex items-center gap-1">
              View All <ChevronRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto premium-table">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pl-3">Number</th>
                  <th className="pb-3">Subject</th>
                  <th className="pb-3">Priority</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {recentRequests.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400 text-xs">
                      No requests yet. Create your first service request.
                    </td>
                  </tr>
                ) : (
                  recentRequests.map((req) => (
                    <tr key={req._id} className="table-row-hover">
                      <td className="py-3.5 pl-3 font-mono text-xs text-violet-600 font-bold">{req.requestNumber}</td>
                      <td className="py-3.5 font-semibold text-slate-800 text-sm">{req.title}</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          req.priority === 'EMERGENCY' ? 'bg-rose-100 text-rose-700' :
                          req.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                          req.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className={`status-badge status-${req.status.toLowerCase()}`}>
                          {req.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <Link to={`/requests/${req._id}`} className="inline-flex items-center gap-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg shadow-sm transition-all">
                          <Eye size={10} /> View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassPanel>

        {/* Activity Feed */}
        <GlassPanel className="flex h-full min-h-0 flex-col">
          <h3 className="section-title mb-4">Activity Feed</h3>
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-4 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recentRequests.map((req, idx) => (
              <div key={req._id} className="flex items-start gap-3 group">
                <div className="relative flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    req.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-600' :
                    req.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600' :
                    'bg-violet-100 text-violet-600'
                  }`}>
                    {idx === 0 ? <CircleDot size={14} /> : <Clock size={14} />}
                  </div>
                  {idx < recentRequests.length - 1 && <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-4 bg-slate-200" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{req.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {req.status.replace(/_/g, ' ')} · {req.updatedAt ? formatDistanceToNow(new Date(req.updatedAt), { addSuffix: true }) : 'recently'}
                  </p>
                </div>
                <Link to={`/requests/${req._id}`} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={14} className="text-slate-400" />
                </Link>
              </div>
            ))}
            {recentRequests.length === 0 && (
              <div className="text-center py-6 text-slate-400">
                <Clock size={20} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No activity yet</p>
              </div>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>
  )

  function renderQuickActions() {
    const action = (to, Icon, iconBg, iconColor, title, badge, badgeColor) => (
      <ActionCard
        to={to}
        icon={Icon}
        iconBg={iconBg}
        iconColor={iconColor}
        title={title}
        badge={badge}
        badgeColor={badgeColor}
      />
    )

    switch (auth?.role) {
      case 'requester':
      case 'hod':
      case 'staff':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {action('/requests/new', PlusCircle, 'bg-violet-50', 'text-violet-600', 'New Service Request')}
            {action('/requests', ClipboardList, 'bg-blue-50', 'text-blue-600', 'Track Requests', `${stats.totalRequests} total`, 'bg-blue-100 text-blue-700')}
          </div>
        )
      case 'admin':
      case 'super_admin':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {action('/requests?queue=MY_ACTIONS', AlertCircle, 'bg-amber-50', 'text-amber-600', 'My Action Queue', `${stats.pendingAdmin} pending`, 'bg-amber-100 text-amber-700')}
            {action('/admin/users', Users, 'bg-slate-50', 'text-slate-600', 'Manage Users', `${stats.totalUsers || 0} registered`, 'bg-slate-100 text-slate-700')}
            {action('/admin/settings', Settings, 'bg-indigo-50', 'text-indigo-600', 'System Settings')}
            {action('/reports', TrendingUp, 'bg-emerald-50', 'text-emerald-600', 'Reports & Analytics')}
          </div>
        )
      case 'manager':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {action('/requests?queue=MY_ACTIONS', Wrench, 'bg-violet-50', 'text-violet-600', 'My Action Queue', 'Inspections & estimates', 'bg-violet-100 text-violet-700')}
            {action('/vendors', Building2, 'bg-emerald-50', 'text-emerald-600', 'Vendors')}
            {action('/reports', TrendingUp, 'bg-amber-50', 'text-amber-600', 'Reports')}
          </div>
        )
      case 'technician':
        return (
          <div className="grid grid-cols-1 gap-4 max-w-md">
            {action('/requests?queue=MY_ACTIONS', Wrench, 'bg-violet-50', 'text-violet-600', 'My Work Orders', `${stats.activeWork} active`, 'bg-violet-100 text-violet-700')}
          </div>
        )
      case 'accounts':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {action('/purchase-orders', ShoppingCart, 'bg-violet-50', 'text-violet-600', 'Purchase Orders', `${stats.activePOs || 0} active`, 'bg-violet-100 text-violet-700')}
            {action('/grn', ClipboardCheck, 'bg-emerald-50', 'text-emerald-600', 'Goods Receipts')}
          </div>
        )
      case 'gate':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {action('/gate', QrCode, 'bg-violet-50', 'text-violet-600', 'Scan Delivery Pass')}
            {action('/gate/vehicles', Truck, 'bg-amber-50', 'text-amber-600', 'Vehicles Inside')}
            {action('/gate/history', ClipboardList, 'bg-blue-50', 'text-blue-600', 'Gate History')}
          </div>
        )
      case 'receiving_officer':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {action('/deliveries', Truck, 'bg-violet-50', 'text-violet-600', 'Delivery Queue')}
            {action('/grn', ClipboardCheck, 'bg-emerald-50', 'text-emerald-600', 'Record GRN')}
            {action('/receiving/damaged', AlertCircle, 'bg-amber-50', 'text-amber-600', 'Damaged Goods')}
          </div>
        )
      case 'vendor':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {action('/purchase-orders', ShoppingCart, 'bg-violet-50', 'text-violet-600', 'My Purchase Orders')}
            {action('/deliveries', Truck, 'bg-blue-50', 'text-blue-600', 'My Deliveries')}
          </div>
        )
      default:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {action('/requests', ClipboardList, 'bg-violet-50', 'text-violet-600', 'All Requests')}
          </div>
        )
    }
  }
}

export default Dashboard
