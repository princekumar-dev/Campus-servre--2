import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { User, Mail, Lock, Phone, Landmark, Briefcase, ArrowLeft, ShieldCheck } from 'lucide-react'
import InstitutionSelector from '../components/InstitutionSelector'
import { getInstitutionOrganization, isInstitutionUserRole } from '../constants/institutions'

function SignUp({ adminMode = false }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'requester',
    institution: '',
    department: '',
    phoneNumber: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { showSuccess, showError } = useAlert()
  const cardClass = adminMode
    ? 'border-slate-200 bg-white shadow-xl'
    : 'border-white/30 bg-white/20 shadow-2xl backdrop-blur-md'
  const titleClass = adminMode ? 'text-slate-900' : 'text-white'
  const subtitleClass = adminMode ? 'text-slate-500' : 'text-gray-100'
  const labelClass = adminMode ? 'text-slate-600' : 'text-violet-300'
  const fieldClass = adminMode
    ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400'
    : 'border-violet-950/60 bg-slate-950/60 text-slate-100 placeholder-slate-500'
  const selectClass = adminMode
    ? 'border-slate-300 bg-white text-slate-800'
    : 'border-violet-950/60 bg-slate-950/60 text-slate-300'
  const organization = getInstitutionOrganization(formData.institution)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'role' && !isInstitutionUserRole(value) ? { institution: '' } : {})
    }))
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    const { name, email, password, confirmPassword, role, institution, department, phoneNumber } = formData

    if (!name || !email || !password || !confirmPassword || !role || !department) {
      showError('Form Incomplete', 'Please fill in all required fields')
      return
    }

    if (isInstitutionUserRole(role) && !institution) {
      showError('Institution Required', 'Please select the institution for this Faculty, Staff, or HOD account')
      return
    }

    if (password !== confirmPassword) {
      showError('Password Mismatch', 'The passwords you entered do not match')
      return
    }

    if (password.length < 6) {
      showError('Weak Password', 'Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      const res = await apiClient.post('/api/users', {
        name,
        email,
        password,
        role,
        institution,
        department,
        phoneNumber
      })

      if (res.success) {
        showSuccess(adminMode ? 'User Created!' : 'Account Created!', adminMode ? 'The new user can now sign in.' : 'You can now log in with your credentials.')
        navigate(adminMode ? '/admin/users' : '/login')
      } else {
        showError('Registration Failed', res.error || 'Could not register user')
      }
    } catch (err) {
      showError('Sign Up Error', err.message || 'Server error occurred during sign up')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`flex items-center justify-center px-4 smooth-scroll mobile-smoothest-scroll no-mobile-anim ${adminMode ? 'min-h-[calc(100vh-8rem)] py-6' : 'min-h-screen py-8'}`}>
      <div className={`${adminMode ? 'admin-user-form-card' : 'auth-academics-card'} relative z-10 w-full ${adminMode ? 'max-w-3xl' : 'max-w-2xl'} rounded-3xl border p-6 sm:p-8 ${cardClass}`}>
        {adminMode && (
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-violet-700"
          >
            <ArrowLeft size={17} /> Back to users
          </button>
        )}
        <div className="text-center mb-8">
          <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 ring-8 ring-violet-50">
            <Lock className="h-8 w-8 text-violet-600" />
          </div>
          <h1 className={`mb-2 text-3xl font-black sm:text-4xl ${titleClass}`}>{adminMode ? 'Create New User' : 'Faculty / Staff Sign Up'}</h1>
          <p className={`text-sm ${subtitleClass}`}>{adminMode ? 'Create and assign a CampusServe user role' : 'Create your institution CampusServe requester account'}</p>
        </div>

        {adminMode && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-left">
            <ShieldCheck className="mt-0.5 shrink-0 text-violet-600" size={20} />
            <div>
              <p className="text-sm font-bold text-slate-800">Super administrator access</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Create requester, administrator, purchase manager, gate, and service accounts from this protected page.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-4">
          {isInstitutionUserRole(formData.role) && (
            <InstitutionSelector
              value={formData.institution}
              onChange={institution => setFormData(prev => ({ ...prev, institution, department: '' }))}
              tone={adminMode ? 'light' : 'glass'}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${labelClass}`}>
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-violet-400/70">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full border focus:border-violet-500 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all ${fieldClass}`}
                  required
                />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${labelClass}`}>
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-violet-400/70">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full border focus:border-violet-500 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all ${fieldClass}`}
                  required
                />
              </div>
              <p className={`mt-2 text-xs ${subtitleClass}`}>Use your official institution email address</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${labelClass}`}>
                Role
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-violet-400/70">
                  <Briefcase size={16} />
                </span>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className={`w-full border focus:border-violet-500 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all appearance-none ${selectClass}`}
                >
                  <option className="bg-slate-950 text-slate-300" value="requester">{organization.requesterLabel}</option>
                  {adminMode && <>
                    <option className="bg-slate-950 text-slate-300" value="admin">Administrator</option>
                    <option className="bg-slate-950 text-slate-300" value="manager">Purchase Manager</option>
                    <option className="bg-slate-950 text-slate-300" value="gate">Gate Officer</option>
                    <option className="bg-slate-950 text-slate-300" value="service_provider">Service</option>
                  </>}
                </select>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${labelClass}`}>
                {organization.unitLabel}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-violet-400/70">
                  <Landmark size={16} />
                </span>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className={`w-full border focus:border-violet-500 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all appearance-none ${selectClass}`}
                >
                  <option className="bg-gray-800 text-white" value="">Select {organization.unitLabel}</option>
                  {organization.units.map(unit => <option key={unit} className="bg-slate-950 text-slate-300" value={unit}>{unit}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${labelClass}`}>
              Phone Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-violet-400/70">
                <Phone size={16} />
              </span>
              <input
                type="tel"
                name="phoneNumber"
                placeholder="Enter your number"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                className={`w-full border focus:border-violet-500 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all ${fieldClass}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${labelClass}`}>
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-violet-400/70">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  name="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full border focus:border-violet-500 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all ${fieldClass}`}
                  required
                />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${labelClass}`}>
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-violet-400/70">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Repeat password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full border focus:border-violet-500 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all ${fieldClass}`}
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`${adminMode ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 hover:bg-violet-700 hover:-translate-y-0.5' : 'glass-button text-violet-600'} mt-2 flex w-full items-center justify-center rounded-2xl px-6 py-3.5 text-base font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isLoading ? (
              <div className="h-5 w-5 border-t-2 border-r-2 border-white rounded-full animate-spin"></div>
            ) : (
              <span>{adminMode ? 'Create User' : 'Create Account'}</span>
            )}
          </button>
        </form>

        <div className={`mt-6 text-center text-sm ${subtitleClass}`}>
          {adminMode ? 'Finished here?' : 'Already have an account?'}{' '}
          <Link to={adminMode ? '/admin/users' : '/login'} className="ml-1 font-semibold text-violet-300 hover:underline">
            {adminMode ? 'Back to user management' : 'Sign in'}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SignUp
