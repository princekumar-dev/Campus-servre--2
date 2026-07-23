import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { showSuccess, showError } = useAlert()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) return showError('Email Required', 'Enter your registered email')
    setLoading(true)
    try {
      const res = await apiClient.post('/api/auth?action=forgot-password', { email })
      if (res.success) setSent(true)
      else showError('Error', res.error || 'Email not found')
    } catch { setSent(true) }
    finally { setLoading(false) }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl bg-white/95 p-5 text-center shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="p-4 bg-emerald-50 rounded-full inline-flex mx-auto"><CheckCircle size={32} className="text-emerald-600" /></div>
          <h1 className="font-display font-black text-xl text-slate-800">Check Your Email</h1>
          <p className="text-sm text-slate-500">If an account exists with <strong>{email}</strong>, we've sent password reset instructions.</p>
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-violet-600 hover:text-violet-700"><ArrowLeft size={14} />Back to Login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white/95 p-5 shadow-2xl backdrop-blur-sm sm:p-8">
        <div className="text-center">
          <div className="p-4 bg-violet-50 rounded-full inline-flex mx-auto mb-4"><Mail size={28} className="text-violet-600" /></div>
          <h1 className="font-display font-black text-xl text-slate-800">Forgot Password</h1>
          <p className="text-xs text-slate-500 mt-1">Enter your registered email to receive reset instructions</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all" autoFocus />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <div className="h-4 w-4 border-t-2 border-white rounded-full animate-spin" /> : <><Mail size={14} /><span>Send Reset Link</span></>}
          </button>
        </form>
        <div className="text-center">
          <Link to="/login" className="text-xs font-bold text-violet-600 hover:text-violet-700 inline-flex items-center gap-1"><ArrowLeft size={12} />Back to Login</Link>
        </div>
      </div>
    </div>
  )
}
