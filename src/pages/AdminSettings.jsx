import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { Settings, Save, Shield, Building2, Bell } from 'lucide-react'

function AdminSettings() {
  const navigate = useNavigate()
  const { showSuccess, showError } = useAlert()
  const auth = getAuthOrNull()
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState({
    collegeName: 'MSEC',
    collegeFullName: 'Meenakshi Sundararajan Engineering College',
    department: 'MAINTENANCE',
    emailDomain: '@msec.edu.in',
    enableNotifications: true,
    enableEmailAlerts: true,
    slaWarningHours: 48,
    slaCriticalHours: 24,
    maxAttachmentSizeMB: 10,
    autoAssignManager: false,
    requireCompletionPhotos: true,
    enableVendorBidding: false
  })

  useEffect(() => {
    if (!auth || (auth.role !== 'admin' && auth.role !== 'super_admin')) {
      navigate('/dashboard')
      return
    }
    setIsLoading(false)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save to localStorage for now (can be extended to API)
      localStorage.setItem('campusserve_settings', JSON.stringify(settings))
      showSuccess('Saved', 'Settings saved successfully')
    } catch (err) {
      showError('Error', 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-violet-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-slate-800">System Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure CampusServe system parameters</p>
      </div>

      {/* Institution Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={18} className="text-violet-600" />
          <h2 className="text-base font-bold text-slate-800">Institution</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Short Name</label>
            <input type="text" value={settings.collegeName} onChange={e => setSettings({...settings, collegeName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
            <input type="text" value={settings.collegeFullName} onChange={e => setSettings({...settings, collegeFullName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Email Domain</label>
            <input type="text" value={settings.emailDomain} onChange={e => setSettings({...settings, emailDomain: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Default Department</label>
            <input type="text" value={settings.department} onChange={e => setSettings({...settings, department: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>
      </div>

      {/* SLA Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">SLA Thresholds</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Warning After (hours)</label>
            <input type="number" value={settings.slaWarningHours} onChange={e => setSettings({...settings, slaWarningHours: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Critical After (hours)</label>
            <input type="number" value={settings.slaCriticalHours} onChange={e => setSettings({...settings, slaCriticalHours: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={18} className="text-blue-600" />
          <h2 className="text-base font-bold text-slate-800">Notifications</h2>
        </div>
        <div className="space-y-3">
          {[
            { key: 'enableNotifications', label: 'Enable Push Notifications' },
            { key: 'enableEmailAlerts', label: 'Enable Email Alerts' },
            { key: 'autoAssignManager', label: 'Auto-Assign Manager on Submission' },
            { key: 'requireCompletionPhotos', label: 'Require Before/After Photos on Completion' },
            { key: 'enableVendorBidding', label: 'Enable Vendor Bidding' }
          ].map(item => (
            <label key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 cursor-pointer">
              <span className="text-sm font-medium text-slate-700">{item.label}</span>
              <button
                type="button"
                onClick={() => setSettings({...settings, [item.key]: !settings[item.key]})}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings[item.key] ? 'bg-violet-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings[item.key] ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </label>
          ))}
        </div>
      </div>

      {/* Attachment Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={18} className="text-slate-600" />
          <h2 className="text-base font-bold text-slate-800">Attachments</h2>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Max Attachment Size (MB)</label>
          <input type="number" value={settings.maxAttachmentSizeMB} onChange={e => setSettings({...settings, maxAttachmentSizeMB: parseInt(e.target.value) || 5})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm py-2.5 px-6 rounded-xl transition-all"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

export default AdminSettings
