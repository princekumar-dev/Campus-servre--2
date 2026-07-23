import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import { AlertProvider } from './components/AlertContext'
import { getAuthOrNull } from './utils/auth'
import GlobalExecutionLoader from './components/GlobalExecutionLoader'

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
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'))
const PurchaseOrderDetails = lazy(() => import('./pages/PurchaseOrderDetails'))
const Deliveries = lazy(() => import('./pages/Deliveries'))
const GateScanner = lazy(() => import('./pages/GateScanner'))
const GateDashboard = lazy(() => import('./pages/GateDashboard'))
const GateHistory = lazy(() => import('./pages/GateHistory'))
const GateVehicles = lazy(() => import('./pages/GateVehicles'))
const GatePOVerification = lazy(() => import('./pages/GatePOVerification'))
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
  return <Navigate to="/dashboard" replace />
}

// Protected route wrapper with optional role checks
const ProtectedRoute = ({ children, allowedRoles }) => {
  const location = useLocation()
  const parsed = getAuthOrNull()
  if (!parsed || !parsed.isAuthenticated) {
    clearStoredAuth()
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  
  if (allowedRoles && !allowedRoles.includes(parsed.role)) {
    return <Navigate to="/dashboard" replace />
  }
  
  return children
}

// Redirect if already logged in
const RedirectIfAuthenticated = ({ children }) => {
  const parsed = getAuthOrNull()
  if (parsed && parsed.isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function AppContent() {
  const location = useLocation()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
  const auth = getAuthOrNull()
  const roleClass = auth?.role ? `role-${auth.role}` : '' || location.pathname === '/forgot-password'

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
          <main className="flex w-full flex-1 justify-center">
            <div className={`layout-content-container flex min-w-0 w-full max-w-[1600px] flex-col px-3 py-4 sm:px-5 sm:py-6 lg:px-6 xl:px-8 page-enter ${!isAuthPage ? 'pb-24 md:pb-8' : ''}`}>
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="bg-white rounded-2xl shadow-lg px-10 py-10 flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-violet-100 border-t-violet-500 rounded-full animate-spin"></div>
                    <p className="text-gray-500 text-sm font-medium">Loading dashboard...</p>
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
                  <Route path="/reports" element={<ProtectedRoute allowedRoles={['super_admin', 'accounts']}><Reports /></ProtectedRoute>} />
                  
                  {/* Admin routes */}
                  <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['super_admin']}><AdminUsers /></ProtectedRoute>} />
                  <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['super_admin']}><AdminSettings /></ProtectedRoute>} />
                  <Route path="/admin/audit" element={<ProtectedRoute allowedRoles={['super_admin']}><AdminAudit /></ProtectedRoute>} />
                  
                  {/* Vendor routes */}
                  <Route path="/vendors" element={<ProtectedRoute allowedRoles={['super_admin', 'manager']}><Vendors /></ProtectedRoute>} />
                  
                  {/* Purchase Orders */}
                  <Route path="/purchase-orders" element={<ProtectedRoute allowedRoles={['super_admin', 'manager', 'vendor']}><PurchaseOrders /></ProtectedRoute>} />
                  <Route path="/purchase-orders/:id" element={<ProtectedRoute allowedRoles={['super_admin', 'manager', 'vendor']}><PurchaseOrderDetails /></ProtectedRoute>} />
                  
                  {/* Delivery routes */}
                  <Route path="/deliveries" element={<ProtectedRoute allowedRoles={['super_admin', 'receiving_officer', 'vendor']}><Deliveries /></ProtectedRoute>} />
                  
                  {/* Gate routes */}
                  <Route path="/gate" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'gate']}><GateScanner /></ProtectedRoute>} />
                  <Route path="/gate/po/:id" element={<ProtectedRoute allowedRoles={['gate', 'super_admin', 'receiving_officer', 'manager']}><GatePOVerification /></ProtectedRoute>} />
                  <Route path="/gate/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'gate']}><GateDashboard /></ProtectedRoute>} />
                  <Route path="/gate/history" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'gate']}><GateHistory /></ProtectedRoute>} />
                  <Route path="/gate/vehicles" element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'gate']}><GateVehicles /></ProtectedRoute>} />
                  
                  {/* GRN routes */}
                  <Route path="/grn" element={<ProtectedRoute allowedRoles={['super_admin', 'receiving_officer', 'accounts', 'manager']}><GRN /></ProtectedRoute>} />
                  
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
