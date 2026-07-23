import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { Lock } from 'lucide-react'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { showSuccess, showError } = useAlert()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      showError('Required Fields', 'Please enter your email and password')
      return
    }

    setIsLoading(true)
    try {
      const res = await apiClient.post('/api/auth', { email, password })
      if (res.success && res.user) {
        const authData = {
          isAuthenticated: true,
          token: res.token || '',
          id: res.user.id,
          email: res.user.email,
          name: res.user.name,
          role: res.user.role,
          department: res.user.department,
          phoneNumber: res.user.phoneNumber,
          eSignature: res.user.eSignature
        }
        localStorage.setItem('auth', JSON.stringify(authData))
        localStorage.setItem('isLoggedIn', 'true')
        localStorage.setItem('userRole', res.user.role)
        localStorage.setItem('userId', res.user.id)
        
        window.dispatchEvent(new Event('authStateChanged'))
        showSuccess('Welcome Back!', `Logged in successfully as ${res.user.name}`)
        navigate('/dashboard')
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
      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-white/30 bg-white/20 p-5 shadow-2xl backdrop-blur-md sm:rounded-3xl sm:p-8">
          <div className="mb-6 text-center sm:mb-8">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 sm:mb-6 sm:h-16 sm:w-16">
              <Lock className="h-7 w-7 text-violet-600 sm:h-8 sm:w-8" />
            </div>
            <h1 className="mb-1.5 text-2xl font-black text-white sm:mb-2 sm:text-4xl">Welcome Back</h1>
            <p className="text-sm text-gray-100 sm:text-lg">Sign in to your MSEC CampusServe account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
            <div>
              <label className="mb-3 block text-sm font-bold text-white">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="Enter your email address" className="w-full rounded-xl border border-white/30 bg-white/20 px-4 py-3 text-white outline-none backdrop-blur-sm transition-all duration-200 placeholder:text-gray-200 focus:ring-2 focus:ring-violet-300 sm:rounded-2xl sm:py-4" required />
            </div>
            <div>
              <label className="mb-3 block text-sm font-bold text-white">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" className="w-full rounded-xl border border-white/30 bg-white/20 px-4 py-3 text-white outline-none backdrop-blur-sm transition-all duration-200 placeholder:text-gray-200 focus:ring-2 focus:ring-violet-300 sm:rounded-2xl sm:py-4" required />
              <div className="mt-2 text-right">
                <Link to="/forgot-password" className="text-xs font-semibold text-violet-300 hover:underline">Forgot password?</Link>
              </div>
            </div>
            <div className="pt-4">
              <button type="submit" disabled={isLoading} className="glass-button w-full rounded-xl px-6 py-3.5 text-base font-bold text-violet-600 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-2xl sm:py-4 sm:text-lg">
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-100">Don't have an account? <Link to="/signup" className="ml-1 font-semibold text-violet-300 hover:underline">Sign up</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
