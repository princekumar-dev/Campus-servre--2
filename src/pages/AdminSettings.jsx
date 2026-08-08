import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { Building2, Bell, Save, ShieldCheck, Timer, Paperclip, RotateCcw, AlertTriangle, CheckCircle2, MapPin } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { ErrorState, LoadingState } from '../components/EmptyStates'

const defaults = {
  institutions: [
    { id: 'msec', shortName: 'MSEC', fullName: 'Meenakshi Sundararajan Engineering College', emailDomain: '@msec.edu.in', defaultDepartment: 'MAINTENANCE', affiliation: 'An Autonomous Institution Affiliated to Anna University', documentAddress: '363, Arcot Road, Kodambakkam, Chennai - 600024', contactLine: 'principal@msec.edu.in', website: 'www.msec.edu.in' },
    { id: 'nest', shortName: 'The Nest School', fullName: 'The NEST School', emailDomain: '@thenest.school', defaultDepartment: 'Administration', affiliation: 'IB World School | Cambridge International School', documentAddress: '363, Arcot Road, Kodambakkam, Chennai - 600024', contactLine: 'For enquiries: +91 99401 06358', website: 'www.thenest.school' },
    { id: 'mcw', shortName: 'MCW', fullName: 'Meenakshi College for Women (Autonomous)', emailDomain: '@meenakshicollege.com', defaultDepartment: 'Administration', affiliation: 'Affiliated to the University of Madras', documentAddress: '363, Arcot Road, Kodambakkam, Chennai - 600024', contactLine: 'office@meenakshicollege.com | 044-2472 5466', website: 'www.meenakshicollege.com' },
    { id: 'mssm', shortName: 'MSSM', fullName: 'Meenakshi Sundararajan School of Management', emailDomain: '@mssm.edu.in', defaultDepartment: 'General Management', affiliation: 'Affiliated to the University of Madras & Approved by AICTE | Co-Educational Institution under the aegis of IIET', documentAddress: '363, Arcot Road, Kodambakkam, Chennai - 600024', contactLine: '+91 98407 21869 | +91 98414 37372 | admissions@mssm.edu.in', website: 'www.mssm.edu.in' },
    { id: 'iic', shortName: 'IIC', fullName: "Institution's Innovation Council", emailDomain: '@msec.edu.in', defaultDepartment: 'Innovation Council', affiliation: "Ministry of Education's Innovation Cell | AICTE", documentAddress: 'Meenakshi Sundararajan Engineering College, 363 Arcot Road, Kodambakkam, Chennai - 600024', contactLine: 'Institution Innovation Council', website: 'www.msec.edu.in' }
  ],
  collegeName: 'MSEC', collegeFullName: 'Meenakshi Sundararajan Engineering College',
  emailDomain: '@msec.edu.in', defaultDepartment: 'MAINTENANCE', timezone: 'Asia/Kolkata', currency: 'INR',
  allowPublicSignup: true, enforceEmailDomain: true, enableNotifications: true,
  goodsPoGeofenceEnabled: true, servicePoGeofenceEnabled: true,
  requireIssuePhoto: false, requireCompletionPhotos: true, maxAttachmentSizeMB: 5,
  requestEditWindowHours: 24, slaLowHours: 72, slaMediumHours: 48, slaHighHours: 24, slaEmergencyHours: 4
}

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100'

function Field({ label, hint, children }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>{children}{hint && <span className="mt-1.5 block text-xs leading-5 text-slate-500">{hint}</span>}</label>
}

function Section({ icon: Icon, title, description, tone = 'violet', children }) {
  const tones = { violet: 'bg-violet-100 text-violet-700', blue: 'bg-blue-100 text-blue-700', amber: 'bg-amber-100 text-amber-700', emerald: 'bg-emerald-100 text-emerald-700', slate: 'bg-slate-100 text-slate-700' }
  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={19} /></div>
      <div><h2 className="font-extrabold text-slate-900">{title}</h2><p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p></div>
    </div>
    <div className="p-5 sm:p-6">{children}</div>
  </section>
}

function Toggle({ checked, onChange, label, description, disabled = false }) {
  return <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-left transition hover:border-violet-200 hover:bg-violet-50/40 disabled:cursor-not-allowed disabled:opacity-50">
    <span><span className="block text-sm font-bold text-slate-800">{label}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span></span>
    <span className="flex shrink-0 items-center gap-2">
      <span className={`text-xs font-extrabold ${checked ? 'text-violet-700' : 'text-slate-500'}`}>{checked ? 'On' : 'Off'}</span>
      <span className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-200 ${checked ? 'bg-violet-600' : 'bg-slate-300'}`}>
        <span
          className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </span>
    </span>
  </button>
}

export default function AdminSettings() {
  const navigate = useNavigate()
  const { showSuccess, showError } = useAlert()
  const auth = getAuthOrNull()
  const [settings, setSettings] = useState(defaults)
  const [saved, setSaved] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [settings, saved])
  const update = (key, value) => setSettings(current => ({ ...current, [key]: value }))
  const updateInstitution = (id, key, value) => setSettings(current => ({
    ...current,
    institutions: current.institutions.map(institution => institution.id === id ? { ...institution, [key]: value } : institution)
  }))

  const loadSettings = async () => {
    setLoading(true); setError('')
    try {
      const response = await apiClient.get('/api/settings')
      if (!response.success) throw new Error(response.error || 'Unable to load settings')
      const next = { ...defaults, ...response.settings }
      setSettings(next); setSaved(next)
    } catch (err) { setError(err.message || 'Unable to load settings') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!auth || auth.role !== 'super_admin') { navigate('/dashboard'); return }
    loadSettings()
  }, [])

  useEffect(() => {
    const warn = event => { if (!dirty) return; event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const saveSettings = async () => {
    const invalidInstitution = settings.institutions.some(institution => !institution.shortName.trim() || !institution.fullName.trim() || !institution.defaultDepartment.trim() || !institution.affiliation.trim() || !institution.documentAddress.trim() || !institution.contactLine.trim() || !institution.website.trim() || !/^@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(institution.emailDomain.trim()))
    if (settings.institutions.length !== 5 || new Set(settings.institutions.map(institution => institution.id)).size !== 5 || invalidInstitution) {
      showError('Invalid institution settings', 'Complete all fields and enter a valid official email domain for all five institutions.'); return
    }
    setSaving(true)
    try {
      const response = await apiClient.put('/api/settings', settings)
      if (!response.success) throw new Error(response.error || 'Unable to save settings')
      const next = { ...defaults, ...response.settings }
      setSettings(next); setSaved(next)
      showSuccess('System settings saved', 'The new policy is now active across CampusServe.')
    } catch (err) { showError('Settings not saved', err.message || 'Please try again.') }
    finally { setSaving(false) }
  }

  if (loading) return <LoadingState label="Loading system settings…" />
  if (error) return <ErrorState message={error} onRetry={loadSettings} />

  return <div className="mx-auto max-w-6xl space-y-6 pb-28">
    <PageHeader title="System Settings" subtitle="Configure institution-wide policies and workflow defaults" role={auth?.role} />

    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${dirty ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
      {dirty ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
      <p className="text-sm font-semibold">{dirty ? 'You have unsaved changes. Save them to apply the policy across the app.' : 'All settings are saved and active.'}</p>
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="xl:col-span-2">
      <Section icon={Building2} title="Institutions" description="Identity and registration policy for each CampusServe institution.">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {settings.institutions.map(institution => <div key={institution.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-extrabold text-slate-900">{institution.shortName || institution.id.toUpperCase()}</h3><span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-violet-700">{institution.id}</span></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Display name"><input className={fieldClass} value={institution.shortName} onChange={e => updateInstitution(institution.id, 'shortName', e.target.value)} /></Field>
              <Field label="Full institution name"><input className={fieldClass} value={institution.fullName} onChange={e => updateInstitution(institution.id, 'fullName', e.target.value)} /></Field>
              <Field label="Official email domain" hint="Include @, for example @msec.edu.in."><input className={fieldClass} value={institution.emailDomain} onChange={e => updateInstitution(institution.id, 'emailDomain', e.target.value.toLowerCase())} /></Field>
              <Field label="Default department"><input className={fieldClass} value={institution.defaultDepartment} onChange={e => updateInstitution(institution.id, 'defaultDepartment', e.target.value.toUpperCase())} /></Field>
              <Field label="PDF affiliation / accreditation"><input className={fieldClass} value={institution.affiliation} onChange={e => updateInstitution(institution.id, 'affiliation', e.target.value)} /></Field>
              <Field label="PDF address"><input className={fieldClass} value={institution.documentAddress} onChange={e => updateInstitution(institution.id, 'documentAddress', e.target.value)} /></Field>
              <Field label="PDF contact"><input className={fieldClass} value={institution.contactLine} onChange={e => updateInstitution(institution.id, 'contactLine', e.target.value)} /></Field>
              <Field label="Website"><input className={fieldClass} value={institution.website} onChange={e => updateInstitution(institution.id, 'website', e.target.value)} /></Field>
            </div>
          </div>)}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Timezone"><select className={fieldClass} value={settings.timezone} onChange={e => update('timezone', e.target.value)}><option value="Asia/Kolkata">Asia/Kolkata (IST)</option><option value="UTC">UTC</option><option value="Asia/Singapore">Asia/Singapore</option></select></Field>
            <Field label="Currency"><select className={fieldClass} value={settings.currency} onChange={e => update('currency', e.target.value)}><option value="INR">INR — Indian Rupee</option><option value="USD">USD — US Dollar</option><option value="EUR">EUR — Euro</option></select></Field>
          </div>
        </div>
      </Section>
      </div>

      <Section icon={ShieldCheck} title="Access & registration" description="Control who may create an account and which identities are accepted." tone="emerald">
        <div className="space-y-3">
          <Toggle checked={settings.allowPublicSignup} onChange={value => update('allowPublicSignup', value)} label="Allow requester self-registration" description="Faculty, teachers, coordinators, and HOD requesters can register against one of the five configured institutions." />
          <Toggle checked={settings.enforceEmailDomain} disabled={!settings.allowPublicSignup} onChange={value => update('enforceEmailDomain', value)} label="Require selected institution email" description="Validate each public registration against the official email domain configured for its selected institution." />
        </div>
      </Section>

      <Section icon={Timer} title="Workflow & SLA policy" description="Deadlines are recalculated whenever a request changes workflow state." tone="amber">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[['slaEmergencyHours', 'Emergency'], ['slaHighHours', 'High'], ['slaMediumHours', 'Medium'], ['slaLowHours', 'Low']].map(([key, label]) => <Field key={key} label={`${label} (hours)`}><input type="number" min="1" max="720" className={fieldClass} value={settings[key]} onChange={e => update(key, Number(e.target.value))} /></Field>)}
        </div>
        <div className="mt-4"><Field label="Submitted request editing" hint="Drafts and clarification requests remain editable regardless of this policy."><select className={fieldClass} value={settings.requestEditWindowHours} onChange={e => update('requestEditWindowHours', Number(e.target.value))}><option value={0}>No editing after submission</option><option value={1}>Allow editing for 1 hour</option><option value={6}>Allow editing for 6 hours</option><option value={12}>Allow editing for 12 hours</option><option value={24}>Allow editing for 24 hours</option><option value={48}>Allow editing for 48 hours</option><option value={72}>Allow editing for 3 days</option><option value={168}>Allow editing for 7 days</option></select></Field></div>
      </Section>

      <Section icon={Bell} title="Notifications" description="Choose which system-generated alerts are created for workflow owners." tone="blue">
        <div className="space-y-3">
          <Toggle checked={settings.enableNotifications} onChange={value => update('enableNotifications', value)} label="In-app workflow notifications" description="Create alerts when responsibility moves to another user." />
        </div>
      </Section>

      <Section icon={MapPin} title="PO geofence testing" description="Temporarily control campus-location enforcement while testing QR workflows." tone="amber">
        <div className="space-y-3">
          <Toggle checked={settings.goodsPoGeofenceEnabled} onChange={value => update('goodsPoGeofenceEnabled', value)} label="Goods PO geofence" description="When off, gate officers can open, verify, and receive Goods POs without sharing a campus GPS location." />
          <Toggle checked={settings.servicePoGeofenceEnabled} onChange={value => update('servicePoGeofenceEnabled', value)} label="Service PO geofence" description="When off, service providers can open scanned Service POs without sharing a campus GPS location." />
          {(!settings.goodsPoGeofenceEnabled || !settings.servicePoGeofenceEnabled) && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800"><AlertTriangle className="mt-0.5 shrink-0" size={16} /> Testing bypass is active. Re-enable geofencing before production use.</div>}
        </div>
      </Section>

      <div className="xl:col-span-2">
        <Section icon={Paperclip} title="Evidence & attachments" description="Apply consistent evidence rules and payload limits across service requests." tone="slate">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Toggle checked={settings.requireIssuePhoto} onChange={value => update('requireIssuePhoto', value)} label="Require issue photo" description="A requester must attach a valid image before creating a service request." />
            <Toggle checked={settings.requireCompletionPhotos} onChange={value => update('requireCompletionPhotos', value)} label="Require completion evidence" description="Marks before/after evidence as institution policy for completed work." />
            <Field label="Maximum attachment size (MB)" hint="Allowed range: 1–25 MB."><input type="number" min="1" max="25" className={fieldClass} value={settings.maxAttachmentSizeMB} onChange={e => update('maxAttachmentSizeMB', Number(e.target.value))} /></Field>
          </div>
        </Section>
      </div>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur md:left-auto md:right-6 md:bottom-5 md:w-auto md:rounded-2xl md:border">
      <div className="mx-auto flex max-w-6xl items-center justify-end gap-3">
        <button type="button" disabled={!dirty || saving} onClick={() => setSettings(saved)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><RotateCcw size={16} /> Discard</button>
        <button type="button" disabled={!dirty || saving} onClick={saveSettings} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"><Save size={16} /> {saving ? 'Saving…' : 'Save settings'}</button>
      </div>
    </div>
  </div>
}
