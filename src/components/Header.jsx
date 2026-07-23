import { Link, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, ClipboardList, PlusCircle, ShoppingCart, Building2, Truck, QrCode, ClipboardCheck } from 'lucide-react'
import { getAuthOrNull } from '../utils/auth'
import Settings from './Settings'
import CampusServeNotifications from './CampusServeNotifications'
import apiClient from '../utils/apiClient'

export const isNavPathActive = (currentPath, navPath) => {
  const pathname = currentPath.length > 1 ? currentPath.replace(/\/+$/, '') : currentPath
  if (navPath === '/dashboard' || navPath === '/requests/new') return pathname === navPath
  if (navPath === '/requests') return (pathname === navPath || pathname.startsWith(`${navPath}/`)) && pathname !== '/requests/new'
  return pathname === navPath || pathname.startsWith(`${navPath}/`)
}

function Header() {
  const location = useLocation()
  const isAuthPage = ['/login', '/signup'].includes(location.pathname)
  const [user, setUser] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleAuthChange = () => {
      const auth = getAuthOrNull()
      setUser(auth?.isAuthenticated ? auth : null)
    }
    handleAuthChange()
    window.addEventListener('authStateChanged', handleAuthChange)
    return () => window.removeEventListener('authStateChanged', handleAuthChange)
  }, [])

  // Fetch notification count
  useEffect(() => {
    if (!user || !user.token) return
    const fetchCount = () => {
      apiClient.get('/api/notifications?action=count', { cache: false, dedupe: false }).then(res => {
        if (res.success) setNotifCount(res.unreadCount || 0)
      }).catch(() => {})
    }
    window.refreshNotificationCount = fetchCount
    fetchCount()
    const interval = setInterval(fetchCount, 30000) // poll every 30s
    window.addEventListener('notificationsUpdated', fetchCount)
    window.addEventListener('requestsUpdated', fetchCount)
    return () => {
      clearInterval(interval)
      window.removeEventListener('notificationsUpdated', fetchCount)
      window.removeEventListener('requestsUpdated', fetchCount)
      if (window.refreshNotificationCount === fetchCount) delete window.refreshNotificationCount
    }
  }, [user])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setShowDropdown(false)
    setIsSettingsOpen(false)
    setIsNotificationsOpen(false)
  }, [location.pathname])

  const toggleNotifications = () => {
    setIsSettingsOpen(false)
    setIsNotificationsOpen(value => !value)
  }

  const linkClass = (path) => {
    const active = isNavPathActive(location.pathname, path)
    return active ? 'nav-link-premium active' : 'nav-link-premium'
  }

  const navigation = user && (
    <>
      {/* Dashboard - all roles */}
      <Link className={linkClass('/dashboard')} to="/dashboard">Dashboard</Link>
      
      {/* Requester / HOD / Staff */}
      {['requester', 'hod', 'staff'].includes(user.role) && (
        <>
          <Link className={linkClass('/requests/new')} to="/requests/new">Submit Request</Link>
          <Link className={linkClass('/requests')} to="/requests">My Requests</Link>
        </>
      )}

      {/* Admin - limited to approval/monitoring */}
      {user.role === 'admin' && (
        <>
          <Link className={linkClass('/requests')} to="/requests">Request Triage</Link>
          <Link className={linkClass('/purchase-orders')} to="/purchase-orders">PO Verification</Link>
        </>
      )}

      {/* Super Admin - full access */}
      {user.role === 'super_admin' && (
        <>
          <Link className={linkClass('/requests')} to="/requests">Requests</Link>
          <Link className={linkClass('/vendors')} to="/vendors">Vendors</Link>
          <Link className={linkClass('/purchase-orders')} to="/purchase-orders">POs</Link>
          <Link className={linkClass('/deliveries')} to="/deliveries">Deliveries</Link>
          <Link className={linkClass('/gate')} to="/gate">Gate</Link>
          <Link className={linkClass('/grn')} to="/grn">GRN</Link>
          <Link className={linkClass('/reports')} to="/reports">Reports</Link>
          <Link className={linkClass('/admin/users')} to="/admin/users">Users</Link>
          <Link className={linkClass('/admin/audit')} to="/admin/audit">Audit</Link>
        </>
      )}

      {/* Manager */}
      {user.role === 'manager' && (
        <>
          <Link className={linkClass('/requests')} to="/requests">Assigned Requests</Link>
          <Link className={linkClass('/vendors')} to="/vendors">Vendors</Link>
          <Link className={linkClass('/purchase-orders')} to="/purchase-orders">Purchase Orders</Link>
          <Link className={linkClass('/grn')} to="/grn">GRN</Link>
        </>
      )}

      {/* Gate Security */}
      {user.role === 'gate' && (
        <>
          <Link className={linkClass('/gate')} to="/gate">Scan</Link>
          <Link className={linkClass('/gate/vehicles')} to="/gate/vehicles">Vehicles</Link>
          <Link className={linkClass('/gate/history')} to="/gate/history">History</Link>
        </>
      )}

      {/* Receiving Officer */}
      {user.role === 'receiving_officer' && (
        <>
          <Link className={linkClass('/deliveries')} to="/deliveries">Deliveries</Link>
          <Link className={linkClass('/grn')} to="/grn">GRN</Link>
          <Link className={linkClass('/receiving/damaged')} to="/receiving/damaged">Damaged</Link>
        </>
      )}

      {/* Vendor */}
      {user.role === 'vendor' && (
        <>
          <Link className={linkClass('/purchase-orders')} to="/purchase-orders">My POs</Link>
          <Link className={linkClass('/deliveries')} to="/deliveries">Deliveries</Link>
          <Link className={linkClass('/vendor/invoices')} to="/vendor/invoices">Invoices</Link>
          <Link className={linkClass('/vendor/payments')} to="/vendor/payments">Payments</Link>
        </>
      )}

      {/* Accounts */}
      {user.role === 'accounts' && (
        <>
          <Link className={linkClass('/accounts/payments')} to="/accounts/payments">Payments</Link>
          <Link className={linkClass('/grn')} to="/grn">GRN</Link>
          <Link className={linkClass('/reports')} to="/reports">Reports</Link>
        </>
      )}

      {/* Technician */}
      {user.role === 'technician' && (
        <Link className={linkClass('/requests')} to="/requests">My Work Orders</Link>
      )}
    </>
  )

  return (
    <header
      className="glass-card campusserve-header sticky top-0 z-50 mx-2 mt-2 grid min-h-[64px] grid-cols-[1fr_auto] items-center gap-3 whitespace-nowrap px-3 py-3 sm:mx-3 sm:mt-3 sm:px-4 md:mx-4 md:mt-4 md:px-6 lg:min-h-[72px] lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-6 lg:px-8 xl:gap-10 xl:px-10"
      onMouseEnter={() => document.body.classList.add('header-hover-active')}
      onMouseLeave={() => document.body.classList.remove('header-hover-active')}
    >
      <Link to={user ? '/dashboard' : '/'} className="flex min-w-0 items-center gap-2.5 md:gap-3" aria-label="CampusServe home">
            <span className="size-9 flex-shrink-0 sm:size-10">
              <img src="/images/mseclogo.png" alt="CampusServe Logo" className="h-full w-full object-contain" />
            </span>
            <h2 className="truncate whitespace-nowrap text-base font-bold leading-tight tracking-[-0.015em] sm:text-lg md:text-xl">
              <span className="text-[#111418]">MSEC</span> <span className="wave-text-violet">CampusServe</span>
            </h2>
      </Link>

      <nav className="campusserve-primary-nav hidden min-w-0 items-center justify-start gap-2 overflow-x-auto lg:flex xl:gap-3 2xl:gap-4" aria-label="Primary navigation">
        {navigation}
      </nav>

      <div className={`${isAuthPage ? 'hidden' : 'hidden lg:flex'} items-center justify-end gap-2 border-l border-slate-200/80 pl-4 xl:gap-3 xl:pl-5`}>
          {user ? (
            <>
              <div className="relative flex items-center gap-1.5" ref={dropdownRef}>
                <button onClick={toggleNotifications} className={`relative hidden h-9 w-9 items-center justify-center rounded-lg transition-colors lg:flex lg:h-10 lg:w-10 ${isNotificationsOpen ? 'bg-violet-100 text-violet-700' : 'hover:bg-[#f0f2f5]'}`} aria-label="Notifications" aria-expanded={isNotificationsOpen}>
                  <Bell className="h-5 w-5 text-[#60758a] transition-colors hover:text-violet-600" />
                  {notifCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-4 w-4 flex items-center justify-center rounded-full border border-white bg-violet-600 text-[8px] font-black text-white">
                      {notifCount > 9 ? '9+' : notifCount}
                    </span>
                  )}
                </button>
                <button onClick={() => setIsSettingsOpen((value) => !value)} className="group flex h-10 max-w-[230px] items-center gap-2 rounded-xl px-2.5 transition-colors hover:bg-[#f0f2f5]" title="Account settings" aria-expanded={isSettingsOpen}>
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-xs font-bold text-white lg:h-8 lg:w-8 lg:text-sm">
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[150px] truncate text-xs font-medium text-[#111418] group-hover:text-violet-600 xl:inline 2xl:max-w-[190px]">{user.email}</span>
                  <ChevronDown className={`h-3 w-3 text-[#60758a] transition-transform lg:h-4 lg:w-4 ${isSettingsOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </>
          ) : (
            <Link to="/login" className="btn-premium h-9 min-w-[60px] justify-center px-3 text-xs lg:h-10 lg:min-w-[70px] lg:px-4 lg:text-sm">Login</Link>
          )}
      </div>

      <div className={`${isAuthPage ? 'hidden' : 'flex'} items-center justify-end gap-1 lg:hidden`}>
        {user && <button onClick={toggleNotifications} className={`relative flex flex-shrink-0 items-center justify-center rounded-lg p-1.5 text-[#111418] transition-colors duration-200 sm:p-2 ${isNotificationsOpen ? 'bg-violet-100 text-violet-700' : 'hover:bg-violet-50'}`} aria-label="Notifications" aria-expanded={isNotificationsOpen}><Bell className="h-5 w-5 sm:h-6 sm:w-6" />{notifCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-violet-600 px-0.5 text-[8px] font-black text-white">{notifCount > 9 ? '9+' : notifCount}</span>}</button>}
        {user && (
          <button onClick={() => setIsSettingsOpen(true)} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-violet-100 bg-gradient-to-br from-violet-400 via-violet-500 to-purple-500 text-sm font-black text-white shadow-md shadow-violet-200/80 transition-[filter,box-shadow] active:brightness-95 sm:h-11 sm:w-11 sm:text-base" aria-label="Open account settings">
            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
          </button>
        )}
      </div>

      {user && isSettingsOpen && (
        <Settings
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          userEmail={user.email}
          userRole={user.role}
          isMobile={typeof window !== 'undefined' && window.innerWidth < 1024}
        />
      )}

      {user && isNotificationsOpen && (
        <CampusServeNotifications
          isOpen
          onClose={() => setIsNotificationsOpen(false)}
          setUnreadCount={setNotifCount}
        />
      )}
    </header>
  )
}

export default Header
