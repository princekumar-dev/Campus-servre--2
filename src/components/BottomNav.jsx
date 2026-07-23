import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, PlusCircle, BarChart3, Users, ShoppingCart, QrCode, ClipboardCheck, Truck, Building2, IndianRupee, FileText } from 'lucide-react'
import { getAuthOrNull } from '../utils/auth'

function BottomNav() {
  const location = useLocation()
  const auth = getAuthOrNull()
  
  if (!auth || !auth.isAuthenticated) return null
  const isAdmin = auth.role === 'admin' || auth.role === 'super_admin'
  const isManagerOrAdmin = ['admin', 'super_admin', 'manager'].includes(auth.role)
  const isGate = auth.role === 'gate'
  const isReceiving = auth.role === 'receiving_officer'
  const isVendor = auth.role === 'vendor'
  const isAccounts = auth.role === 'accounts'

  const NavItem = ({ to, icon: Icon, label, isActive }) => (
    <Link to={to} className="relative flex flex-col items-center gap-0.5 py-1 px-2 transition-all group">
      <div className={`relative p-1.5 rounded-xl transition-all duration-200 ${
        isActive
          ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-110'
          : 'text-slate-400 group-hover:text-violet-400 group-hover:bg-violet-500/10'
      }`}>
        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
        {isActive && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-slate-950" />
        )}
      </div>
      <span className={`text-[10px] font-semibold transition-all ${
        isActive ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'
      }`}>
        {label}
      </span>
      {isActive && (
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-violet-400 rounded-full" />
      )}
    </Link>
  )

  const isActive = (paths) => {
    if (Array.isArray(paths)) {
      return paths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
    }
    return location.pathname === paths || location.pathname.startsWith(paths + '/')
  }

  // Vendor-specific bottom nav
  if (isVendor) {
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-bottom-nav px-1 py-1.5 flex items-center justify-around safe-area-inset-bottom">
        <NavItem to="/vendor/dashboard" icon={LayoutDashboard} label="Home" isActive={location.pathname === '/vendor/dashboard'} />
        <NavItem to="/purchase-orders" icon={ShoppingCart} label="POs" isActive={isActive('/purchase-orders')} />
        <NavItem to="/deliveries" icon={Truck} label="Deliveries" isActive={isActive('/deliveries')} />
        <NavItem to="/vendor/invoices" icon={FileText} label="Invoices" isActive={isActive('/vendor/invoices')} />
        <NavItem to="/vendor/payments" icon={IndianRupee} label="Payments" isActive={isActive('/vendor/payments')} />
      </div>
    )
  }

  // Gate-specific bottom nav
  if (isGate) {
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-bottom-nav px-1 py-1.5 flex items-center justify-around safe-area-inset-bottom">
        <NavItem to="/gate/dashboard" icon={LayoutDashboard} label="Home" isActive={location.pathname === '/gate/dashboard'} />
        <NavItem to="/gate" icon={QrCode} label="Scan" isActive={location.pathname === '/gate'} />
        <NavItem to="/gate/vehicles" icon={Truck} label="Vehicles" isActive={isActive('/gate/vehicles')} />
        <NavItem to="/gate/history" icon={ClipboardList} label="History" isActive={isActive('/gate/history')} />
      </div>
    )
  }

  // Accounts-specific bottom nav
  if (isAccounts) {
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-bottom-nav px-1 py-1.5 flex items-center justify-around safe-area-inset-bottom">
        <NavItem to="/accounts/dashboard" icon={LayoutDashboard} label="Home" isActive={location.pathname === '/accounts/dashboard'} />
        <NavItem to="/accounts/payments" icon={IndianRupee} label="Payments" isActive={isActive('/accounts/payments')} />
        <NavItem to="/grn" icon={ClipboardCheck} label="GRN" isActive={isActive('/grn')} />
        <NavItem to="/reports" icon={BarChart3} label="Reports" isActive={location.pathname === '/reports'} />
      </div>
    )
  }

  // Receiving Officer-specific bottom nav
  if (isReceiving) {
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-bottom-nav px-1 py-1.5 flex items-center justify-around safe-area-inset-bottom">
        <NavItem to="/receiving/dashboard" icon={LayoutDashboard} label="Home" isActive={location.pathname === '/receiving/dashboard'} />
        <NavItem to="/deliveries" icon={Truck} label="Queue" isActive={isActive('/deliveries')} />
        <NavItem to="/grn" icon={ClipboardCheck} label="GRN" isActive={isActive('/grn')} />
        <NavItem to="/receiving/damaged" icon={BarChart3} label="Damaged" isActive={isActive('/receiving/damaged')} />
      </div>
    )
  }

  // Admin-specific bottom nav
  if (auth.role === 'admin') {
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-violet-900/30 px-1 py-1.5 flex items-center justify-around safe-area-inset-bottom">
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Home" isActive={location.pathname === '/dashboard'} />
        <NavItem to="/requests" icon={ClipboardList} label="Triage" isActive={isActive('/requests')} />
      </div>
    )
  }

  // Super Admin - full access
  if (auth.role === 'super_admin') {
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-violet-900/30 px-1 py-1.5 flex items-center justify-around safe-area-inset-bottom">
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Home" isActive={location.pathname === '/dashboard'} />
        <NavItem to="/requests" icon={ClipboardList} label="Requests" isActive={isActive('/requests')} />
        <NavItem to="/purchase-orders" icon={ShoppingCart} label="POs" isActive={isActive('/purchase-orders')} />
        <NavItem to="/gate" icon={QrCode} label="Gate" isActive={isActive('/gate')} />
        <NavItem to="/grn" icon={ClipboardCheck} label="GRN" isActive={isActive('/grn')} />
        <NavItem to="/admin/users" icon={Users} label="Admin" isActive={isActive(['/admin/users', '/admin/audit'])} />
      </div>
    )
  }

  // Manager-specific bottom nav
  if (auth.role === 'manager') {
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-violet-900/30 px-1 py-1.5 flex items-center justify-around safe-area-inset-bottom">
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Home" isActive={location.pathname === '/dashboard'} />
        <NavItem to="/requests" icon={ClipboardList} label="Assigned" isActive={isActive('/requests')} />
        <NavItem to="/vendors" icon={Building2} label="Vendors" isActive={isActive('/vendors')} />
        <NavItem to="/purchase-orders" icon={ShoppingCart} label="POs" isActive={isActive('/purchase-orders')} />
      </div>
    )
  }

  // Requester / HOD / Staff bottom nav
  if (['requester', 'hod', 'staff'].includes(auth.role)) {
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-violet-900/30 px-1 py-1.5 flex items-center justify-around safe-area-inset-bottom">
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Home" isActive={location.pathname === '/dashboard'} />
        <NavItem to="/requests/new" icon={PlusCircle} label="Submit" isActive={location.pathname === '/requests/new'} />
        <NavItem to="/requests" icon={ClipboardList} label="My Requests" isActive={isActive('/requests') && !location.pathname.endsWith('/new')} />
      </div>
    )
  }

  // Default bottom nav (technician, etc.)
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-violet-900/30 px-1 py-1.5 flex items-center justify-around safe-area-inset-bottom">
      <NavItem to="/dashboard" icon={LayoutDashboard} label="Home" isActive={location.pathname === '/dashboard'} />
      <NavItem to="/requests" icon={ClipboardList} label="Work" isActive={isActive('/requests')} />
    </div>
  )
}

export default BottomNav
