import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Suspense, lazy, useEffect, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import { AlertProvider } from './components/AlertContext'
import { getAuthOrNull, getDashboardPath } from './utils/auth'
import GlobalExecutionLoader from './components/GlobalExecutionLoader'
import { getGateLocation, locationQuery } from './utils/gateLocation'

const clearStoredAuth = () => {
  try {
    localStorage.removeItem('auth')
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userId')
    window.dispatchEvent(new Event('authStateChanged'))
  } catch (e) { }
}

// Lazy load components
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CreateRequest = lazy(() => import('./pages/CreateRequest'))
const Requests = lazy(() => import('./pages/Requests'))
const RequestDetails = lazy(() => import('./pages/RequestDetails'))
const Reports = lazy(() => import('./pages/Reports'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
const AdminAudit = lazy(() => import('./pages/AdminAudit'))
const Login = lazy(() => import('./pages/Login'))
const SignUp = lazy(() => import('./pages/SignUp'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Vendors = lazy(() => import('./pages/Vendors'))
const ManagerQuotations = lazy(() => import('./pages/ManagerQuotations'))
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'))
const PurchaseOrderDetails = lazy(() => import('./pages/PurchaseOrderDetails'))
const Deliveries = lazy(() => import('./pages/Deliveries'))
const GateScanner = lazy(() => import('./pages/GateScanner'))
const GateDashboard = lazy(() => import('./pages/GateDashboard'))
const GateHistory = lazy(() => import('./pages/GateHistory'))
const GatePOVerification = lazy(() => import('./pages/GatePOVerification'))
const ServicePOWorkspace = lazy(() => import('./pages/ServicePOWorkspace'))
const ServiceDashboard = lazy(() => import('./pages/ServiceDashboard'))
const GRN = lazy(() => import('./pages/GRN'))
const VendorDashboard = lazy(() => import('./pages/VendorDashboard'))
const VendorInvoices = lazy(() => import('./pages/VendorInvoices'))
const VendorPayments = lazy(() => import('./pages/VendorPayments'))
const ReceivingDashboard = lazy(() => import('./pages/ReceivingDashboard'))
const ReceivingDamaged = lazy(() => import('./pages/ReceivingDamaged'))
const AccountsDashboard = lazy(() => import('./pages/AccountsDashboard'))
const AccountsPayments = lazy(() => import('./pages/AccountsPayments'))
const ManagerDeliveryPersons = lazy(() => import('./pages/ManagerDeliveryPersons'))
const ManagerVehicles = lazy(() => import('./pages/ManagerVehicles'))

// Root route handler
const RootRedirect = () => {
  const parsed = getAuthOrNull()
  if (!parsed || !parsed.isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={getDashboardPath(parsed.role)} replace />
}

// Protected route wrapper with optional role checks
const ProtectedRoute = ({ children, allowedRoles }) => {
  const location = useLocation()
  const parsed = getAuthOrNull()
  const isServicePortal = location.pathname.startsWith('/service/po/')
  const serviceRoles = ['service_provider', 'vendor', 'manager', 'admin', 'super_admin']
  if (!parsed || !parsed.isAuthenticated) {
    clearStoredAuth()
    const next = `${location.pathname}${location.search}`
    const portal = location.pathname.startsWith('/service/po/') ? '&portal=service' : ''
    return <Navigate to={`/login?next=${encodeURIComponent(next)}${portal}`} replace />
  }

  // A Service PO QR is a portal entry, not a generic unauthorized redirect.
  // If another campus user scans it, offer the dedicated service sign-in so
  // the assigned provider can switch accounts on the same device.
  if (isServicePortal && !serviceRoles.includes(parsed.role)) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}&portal=service&switch=1`} replace />
  }
  
  if (allowedRoles && !allowedRoles.includes(parsed.role)) {
    return <Navigate to={getDashboardPath(parsed.role)} replace />
  }
  
  return children
}

const GateQrRoute = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const parsed = getAuthOrNull()
  const [checkingLocation, setCheckingLocation] = useState(false)
  const [locationError, setLocationError] = useState('')
  const gateRoles = ['gate', 'admin', 'super_admin']

  if (parsed?.isAuthenticated) {
    if (!gateRoles.includes(parsed.role)) return <Navigate to={getDashboardPath(parsed.role)} replace />
    return <GatePOVerification />
  }

  const continueToLogin = async () => {
    setCheckingLocation(true)
    setLocationError('')
    try {
      const gateLocation = await getGateLocation()
      const nextSearch = new URLSearchParams(location.search)
      const locationParams = new URLSearchParams(locationQuery(gateLocation))
      locationParams.forEach((value, key) => nextSearch.set(key, value))
      const next = `${location.pathname}?${nextSearch.toString()}`
      navigate(`/login?portal=gate&next=${encodeURIComponent(next)}`, { replace: true })
    } catch (error) {
      setLocationError(error.message || 'Location permission is required before gate login.')
    } finally {
      setCheckingLocation(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-violet-200 bg-white p-7 text-center shadow-lg sm:p-9">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-violet-700">
        <span className="text-3xl font-black">⌖</span>
      </div>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-violet-600">Gate login required</p>
      <h1 className="mt-2 text-2xl font-black text-slate-900">Enable location to continue</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        CampusServe will confirm you are at the campus gate before opening the gate officer login for this PO scanner.
      </p>
      {locationError && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700">{locationError}</p>}
      <button type="button" onClick={continueToLogin} disabled={checkingLocation}
        className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-60">
        {checkingLocation ? 'Checking Location...' : 'Allow Location & Continue to Login'}
      </button>
    </div>
  )
}

// Redirect if already logged in
const RedirectIfAuthenticated = ({ children }) => {
  const location = useLocation()
  const parsed = getAuthOrNull()
  const params = new URLSearchParams(location.search)
  const isServiceAccountSwitch = params.get('portal') === 'service' && params.get('switch') === '1'
  if (isServiceAccountSwitch) return children
  if (parsed && parsed.isAuthenticated) {
    return <Navigate to={getDashboardPath(parsed.role)} replace />
  }
  return children
}

function AppContent() {
  const location = useLocation()
  const isAuthPage = ['/login', '/signup', '/forgot-password'].includes(location.pathname)
  const auth = getAuthOrNull()
  const roleClass = auth?.role ? `role-${auth.role}` : ''

  // A modal or interrupted navigation can leave an inline scroll lock behind.
  // Pages use normal window scrolling, so always release that lock on route changes.
  useEffect(() => {
    document.documentElement.style.removeProperty('overflow')
    document.documentElement.style.removeProperty('overflow-y')
    document.documentElement.style.removeProperty('height')
    document.body.style.removeProperty('overflow')
    document.body.style.removeProperty('overflow-y')
    document.body.style.removeProperty('height')
    document.body.classList.remove('overflow-hidden', 'no-scroll', 'modal-open')
  }, [location.pathname])

  useEffect(() => {
    if (!isAuthPage) return
    const authScroller = document.querySelector('body.auth-page .layout-container')
    if (authScroller) authScroller.scrollTop = 0
  }, [isAuthPage, location.pathname])

  useEffect(() => {
    const handleWheel = (event) => {
      if (!event.deltaY || event.ctrlKey) return

      // Leave independently scrollable panels, tables and modals alone.
      let node = event.target instanceof Element ? event.target : null
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node)
        const canScroll = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight
        if (canScroll) return
        node = node.parentElement
      }

      const before = window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const hasRoom = event.deltaY > 0 ? before < maxScroll : before > 0
      if (!hasRoom) return

      // Edge/trackpad fallback: intervene only if the browser did not perform
      // the native window scroll by the next animation frame.
      requestAnimationFrame(() => {
        if (Math.abs(window.scrollY - before) < 1) {
          window.scrollBy({ top: event.deltaY, left: 0, behavior: 'auto' })
        }
      })
    }

    window.addEventListener('wheel', handleWheel, { passive: true, capture: true })
    return () => window.removeEventListener('wheel', handleWheel, { capture: true })
  }, [])

  useEffect(() => {
    if (!isAuthPage) {
      document.body.style.backgroundImage = 'none'
      document.documentElement.style.backgroundImage = 'none'
      document.body.classList.remove('auth-page')
      document.documentElement.classList.remove('auth-page')
    } else {
      document.body.classList.add('auth-page')
      document.documentElement.classList.add('auth-page')
      document.body.style.background = ''
      document.documentElement.style.background = ''

      let backgroundImage = "url('/images/campus.jpeg')"
      const imageSet = "image-set(url('/images/campus.avif') type('image/avif') 1x, url('/images/campus.webp') type('image/webp') 1x, url('/images/campus.jpeg') 1x)"
      if (typeof CSS !== 'undefined' && CSS.supports?.('background-image', imageSet)) backgroundImage = imageSet
      document.body.style.backgroundImage = backgroundImage
      document.documentElement.style.backgroundImage = backgroundImage
      document.documentElement.style.backgroundSize = 'cover'
      document.documentElement.style.backgroundPosition = 'center'
      document.documentElement.style.backgroundAttachment = 'fixed'
      document.documentElement.style.backgroundRepeat = 'no-repeat'
    }
    return () => {
      document.body.classList.remove('auth-page')
      document.documentElement.classList.remove('auth-page')
      document.body.style.backgroundImage = 'none'
      document.documentElement.style.backgroundImage = 'none'
      document.documentElement.style.backgroundSize = ''
      document.documentElement.style.backgroundPosition = ''
      document.documentElement.style.backgroundAttachment = ''
      document.documentElement.style.backgroundRepeat = ''
    }
  }, [isAuthPage])

  return (
    <>
      <div
        className={`flex w-full flex-col ${isAuthPage ? 'relative auth-wrapper' : ''}`}
        style={{
          minHeight: '100vh'
        }}
      >
        {isAuthPage && <div className="pointer-events-none fixed inset-0 z-0 bg-black/40" />}
        <div className={`layout-container flex min-h-screen flex-col max-w-full ${isAuthPage ? 'relative z-10' : `app-shell text-slate-800 ${roleClass}`}`}>
          <Header />
          <main id="main-content" tabIndex="-1" className="flex w-full flex-1 justify-center outline-none">
            <div className={`layout-content-container flex min-w-0 w-full max-w-[1600px] flex-col px-3 py-4 sm:px-5 sm:py-6 lg:px-6 xl:px-8 page-enter ${!isAuthPage ? 'pb-24 md:pb-8' : ''}`}>
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="bg-white rounded-2xl shadow-lg px-10 py-10 flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-violet-100 border-t-violet-500 rounded-full animate-spin"></div>
                    <p className="text-gray-500 text-sm font-medium">Loading workspace…</p>
                  </div>
                </div>
              }>
                <Routes>
                  <Route path="/" element={<RootRedirect />} />
                  
                  {/* Dashboard - all authenticated users */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  
                  {/* Requester / Shared routes */}
                  <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
                  <Route path="/requests/new" element={<ProtectedRoute allowedRoles={['requester', 'hod', 'staff']}><CreateRequest /></ProtectedRoute>} />
                  <Route path="/requests/:id/edit" element={<ProtectedRoute allowedRoles={['requester', 'hod', 'staff']}><CreateRequest /></ProtectedRoute>} />
                  <Route path="/requests/:id" element={<ProtectedRoute><RequestDetails /></ProtectedRoute>} />
                  
                  {/* Reports */}
                  <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'accounts', 'manager']}><Reports /></ProtectedRoute>} />
                  
                  {/* Admin routes */}
                  <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['super_admin']}><AdminUsers /></ProtectedRoute>} />
                  <Route path="/admin/users/new" element={<ProtectedRoute allowedRoles={['super_admin']}><SignUp adminMode /></ProtectedRoute>} />
                  <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['super_admin']}><AdminSettings /></ProtectedRoute>} />
                  <Route path="/admin/audit" element={<ProtectedRoute allowedRoles={['super_admin']}><AdminAudit /></ProtectedRoute>} />
                  
                  {/* Vendor routes */}
                  <Route path="/vendors" element={<ProtectedRoute allowedRoles={['super_admin', 'manager']}><Vendors /></ProtectedRoute>} />
                  <Route path="/quotations" element={<ProtectedRoute allowedRoles={['super_admin', 'manager']}><ManagerQuotations /></ProtectedRoute>} />
                  
                  {/* Purchase Orders */}
                  <Route path="/purchase-orders" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'manager', 'vendor']}><PurchaseOrders /></ProtectedRoute>} />
                  <Route path="/purchase-orders/:id" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'manager', 'vendor']}><PurchaseOrderDetails /></ProtectedRoute>} />
                  
                  {/* Delivery routes */}
                  <Route path="/deliveries" element={<ProtectedRoute allowedRoles={['super_admin', 'receiving_officer', 'vendor']}><Deliveries /></ProtectedRoute>} />
                  
                  {/* Gate routes */}
                  <Route path="/gate" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'gate']}><GateScanner /></ProtectedRoute>} />
                  <Route path="/gate/po/:id" element={<GateQrRoute />} />
                  <Route path="/gate/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'gate']}><GateDashboard /></ProtectedRoute>} />
                  <Route path="/gate/history" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'gate']}><GateHistory /></ProtectedRoute>} />
                  <Route path="/service/dashboard" element={<ProtectedRoute allowedRoles={['service_provider', 'vendor', 'manager', 'admin', 'super_admin']}><ServiceDashboard /></ProtectedRoute>} />
                  {/* Signed Service PO QR provides access only to its own workspace. */}
                  <Route path="/service/po/:id" element={<ServicePOWorkspace />} />
                  
                  {/* GRN routes */}
                  <Route path="/grn" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'receiving_officer', 'accounts', 'manager']}><GRN /></ProtectedRoute>} />
                  
                  {/* Vendor Portal */}
                  <Route path="/vendor/dashboard" element={<ProtectedRoute allowedRoles={['vendor']}><VendorDashboard /></ProtectedRoute>} />
                  <Route path="/vendor/invoices" element={<ProtectedRoute allowedRoles={['vendor']}><VendorInvoices /></ProtectedRoute>} />
                  <Route path="/vendor/payments" element={<ProtectedRoute allowedRoles={['vendor']}><VendorPayments /></ProtectedRoute>} />
                  
                  {/* Receiving Officer routes */}
                  <Route path="/receiving/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'receiving_officer']}><ReceivingDashboard /></ProtectedRoute>} />
                  <Route path="/receiving/damaged" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'receiving_officer']}><ReceivingDamaged /></ProtectedRoute>} />
                  
                  {/* Accounts routes */}
                  <Route path="/accounts/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'accounts']}><AccountsDashboard /></ProtectedRoute>} />
                  <Route path="/accounts/payments" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'accounts']}><AccountsPayments /></ProtectedRoute>} />
                  
                  {/* Manager routes */}
                  <Route path="/manager/delivery-persons" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'manager']}><ManagerDeliveryPersons /></ProtectedRoute>} />
                  <Route path="/manager/vehicles" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'manager']}><ManagerVehicles /></ProtectedRoute>} />
                  
                  {/* Auth routes */}
                  <Route path="/login" element={<RedirectIfAuthenticated><Login /></RedirectIfAuthenticated>} />
                  <Route path="/signup" element={<RedirectIfAuthenticated><SignUp /></RedirectIfAuthenticated>} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </div>
      </div>
      {!isAuthPage && <BottomNav />}
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AlertProvider>
        <BrowserRouter>
          <GlobalExecutionLoader />
          <AppContent />
        </BrowserRouter>
      </AlertProvider>
    </ErrorBoundary>
  )
}

export default App
