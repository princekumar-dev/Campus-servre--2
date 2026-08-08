import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { getDashboardPath } from '../utils/auth'
import { Lock } from 'lucide-react'
import InstitutionSelector from '../components/InstitutionSelector'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [institution, setInstitution] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showSuccess, showError } = useAlert()
  const isGatePortal = searchParams.get('portal') === 'gate'
  const isServicePortal = searchParams.get('portal') === 'service'
  const isAccountSwitch = isServicePortal && searchParams.get('switch') === '1'

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      showError('Required Fields', 'Please enter your email and password')
      return
    }

    setIsLoading(true)
    try {
      const requestedPath = searchParams.get('next') || ''
      const requestedPortal = isGatePortal ? 'gate' : isServicePortal ? 'service' : ''
      const scanTarget = requestedPortal ? requestedPath.split('?')[0] : ''
      const res = await apiClient.post('/api/auth', { email, password, institution, portal: requestedPortal, scanTarget })
      if (res.success && res.user) {
        if (isGatePortal && res.user.role !== 'gate') {
          showError('Gate Access Required', 'Sign in with a Gate Officer account.')
          return
        }
        if (isServicePortal && res.user.role !== 'service_provider') {
          showError('Service Access Required', 'Sign in with the assigned service-provider account.')
          return
        }
        const authData = {
          isAuthenticated: true,
          token: res.token || '',
          id: res.user.id,
          email: res.user.email,
          name: res.user.name,
          role: res.user.role,
          department: res.user.department,
          institution: res.user.institution,
          phoneNumber: res.user.phoneNumber,
          eSignature: res.user.eSignature,
          // Keep QR login navigation compatible while Vercel and the API host
          // roll out the same release at slightly different times. The server
          // has already authenticated the role above; newer API versions also
          // return these values in the signed JWT.
          scanPortal: res.scanPortal || requestedPortal,
          scanTarget: res.scanTarget || scanTarget
        }
        localStorage.setItem('auth', JSON.stringify(authData))
        localStorage.setItem('isLoggedIn', 'true')
        localStorage.setItem('userRole', res.user.role)
        localStorage.setItem('userId', res.user.id)
        
        window.dispatchEvent(new Event('authStateChanged'))
        showSuccess('Welcome Back!', `Logged in successfully as ${res.user.name}`)
        const safeNextPath = requestedPath.startsWith('/') && !requestedPath.startsWith('//')
          ? requestedPath
          : getDashboardPath(res.user.role)
        navigate(safeNextPath, { replace: true })
      } else {
        showError('Login Failed', res.error || 'Invalid credentials')
      }
    } catch (err) {
      showError('Authentication Error', err.message || 'Server error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-3 py-6 sm:px-4 sm:py-8">
      <div className="relative z-10 mx-auto w-full max-w-xl">
        <div className="rounded-2xl border border-white/55 bg-white/20 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl sm:rounded-3xl sm:p-8">
          <div className="mb-6 text-center sm:mb-8">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 sm:mb-6 sm:h-16 sm:w-16">
              <Lock className="h-7 w-7 text-violet-600 sm:h-8 sm:w-8" />
            </div>
            <h1 className="mb-1.5 text-2xl font-black text-white [text-shadow:0_2px_10px_rgba(15,23,42,0.75)] sm:mb-2 sm:text-4xl">{isGatePortal ? 'Gate Officer Login' : isServicePortal ? 'Service Provider Login' : 'Welcome Back'}</h1>
            <p className="text-sm font-semibold text-white [text-shadow:0_1px_6px_rgba(15,23,42,0.85)] sm:text-lg">{isGatePortal ? 'Sign in with an authorized gate account' : isServicePortal ? (isAccountSwitch ? 'Switch to the service-provider account assigned to this PO' : 'Sign in to upload repair bills and service costs') : 'Sign in to your MSEC CampusServe account'}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
            {!isGatePortal && !isServicePortal && (
              <InstitutionSelector value={institution} onChange={setInstitution} />
            )}
            <div>
              <label className="mb-3 block text-sm font-bold text-white [text-shadow:0_1px_5px_rgba(15,23,42,0.9)]">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="Enter your email address" className="w-full rounded-xl border border-white/70 bg-white/95 px-4 py-3 text-slate-950 shadow-sm outline-none backdrop-blur-sm transition-all duration-200 placeholder:text-slate-500 focus:border-violet-300 focus:ring-2 focus:ring-violet-400 sm:rounded-2xl sm:py-4" required />
            </div>
            <div>
              <label className="mb-3 block text-sm font-bold text-white [text-shadow:0_1px_5px_rgba(15,23,42,0.9)]">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" className="w-full rounded-xl border border-white/70 bg-white/95 px-4 py-3 text-slate-950 shadow-sm outline-none backdrop-blur-sm transition-all duration-200 placeholder:text-slate-500 focus:border-violet-300 focus:ring-2 focus:ring-violet-400 sm:rounded-2xl sm:py-4" required />
              <div className="mt-2 text-right">
                <Link to="/forgot-password" className="text-xs font-bold text-violet-100 [text-shadow:0_1px_5px_rgba(15,23,42,0.9)] hover:text-white hover:underline">Forgot password?</Link>
              </div>
            </div>
            <div className="pt-4">
              <button type="submit" disabled={isLoading} className="w-full rounded-xl border border-white/70 bg-white/85 px-6 py-3.5 text-base font-black text-violet-700 shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-2xl sm:py-4 sm:text-lg">
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm font-semibold text-white [text-shadow:0_1px_6px_rgba(15,23,42,0.9)]">Don't have an account? <Link to="/signup" className="ml-1 font-bold text-violet-100 hover:text-white hover:underline">Sign up</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
