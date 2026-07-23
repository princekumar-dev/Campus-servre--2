import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import ModalShell from '../components/ModalShell'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { Building2, Plus, Phone, Mail, Star, Package, TrendingUp, CheckCircle, XCircle, AlertTriangle, Search, Edit3, Users, Truck } from 'lucide-react'

const statusColors = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 border-slate-200',
  BLACKLISTED: 'bg-rose-50 text-rose-700 border-rose-200'
}

function VendorCard({ vendor, onAction, actionLoading }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-violet-200 transition-all group">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-violet-50 rounded-xl text-violet-600 group-hover:bg-violet-100 transition-colors">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">{vendor.legalName}</h3>
              <span className="text-xs font-mono text-slate-400">{vendor.vendorCode}</span>
            </div>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${statusColors[vendor.status]}`}>
            {vendor.status}
          </span>
        </div>

        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <Users size={12} className="text-slate-400" />
            <span>{vendor.contactPerson}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Mail size={12} className="text-slate-400" />
            <span className="truncate">{vendor.email}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Phone size={12} className="text-slate-400" />
            <span>{vendor.phone}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-lg font-black text-slate-800">{vendor.totalOrders || 0}</div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">Orders</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black text-violet-700">₹{((vendor.totalValue || 0) / 1000).toFixed(0)}K</div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">Total Value</div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {vendor.status !== 'ACTIVE' && (
            <button disabled={actionLoading} onClick={() => onAction(vendor._id, 'activate')} className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs py-2 rounded-lg border border-emerald-200 transition-all flex items-center justify-center space-x-1 disabled:cursor-wait disabled:opacity-60">
              <CheckCircle size={12} /><span>{actionLoading ? 'Updating...' : 'Activate'}</span>
            </button>
          )}
          {vendor.status === 'ACTIVE' && (
            <button disabled={actionLoading} onClick={() => onAction(vendor._id, 'deactivate')} className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs py-2 rounded-lg border border-slate-200 transition-all flex items-center justify-center space-x-1 disabled:cursor-wait disabled:opacity-60">
              <XCircle size={12} /><span>{actionLoading ? 'Updating...' : 'Deactivate'}</span>
            </button>
          )}
          {vendor.status !== 'BLACKLISTED' && (
            <button disabled={actionLoading} onClick={() => onAction(vendor._id, 'blacklist')} className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-2 rounded-lg border border-rose-200 transition-all flex items-center justify-center space-x-1 disabled:cursor-wait disabled:opacity-60">
              <AlertTriangle size={12} /><span>{actionLoading ? 'Updating...' : 'Blacklist'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AddVendorModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ legalName: '', contactPerson: '', email: '', phone: '', taxNumber: '', address: '' })
  const [loading, setLoading] = useState(false)
  const { showSuccess, showError } = useAlert()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.legalName || !form.contactPerson || !form.email || !form.phone) {
      showError('Missing Fields', 'Please fill all required fields')
      return
    }
    setLoading(true)
    try {
      const res = await apiClient.post('/api/vendors', form)
      if (res.success) { showSuccess('Vendor Added', `${form.legalName} registered successfully`); onSaved() }
      else showError('Error', res.error)
    } finally { setLoading(false) }
  }

  return (
    <ModalShell panelClassName="max-w-lg space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">Register New Vendor</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { name: 'legalName', label: 'Legal Business Name *', placeholder: 'e.g. ABC Electronics Pvt Ltd' },
            { name: 'contactPerson', label: 'Contact Person *', placeholder: 'e.g. Rajan Kumar' },
            { name: 'email', label: 'Email Address *', placeholder: 'vendor@company.com' },
            { name: 'phone', label: 'Phone Number *', placeholder: '+91 9876543210' },
            { name: 'taxNumber', label: 'GST / Tax Number', placeholder: 'GSTIN...' },
            { name: 'address', label: 'Registered Address', placeholder: 'Full address...' },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">{f.label}</label>
              <input
                type="text" value={form[f.name]} placeholder={f.placeholder}
                onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 font-semibold text-sm py-2.5 rounded-xl hover:bg-slate-50 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all disabled:opacity-50">
              {loading ? 'Saving...' : 'Register Vendor'}
            </button>
          </div>
        </form>
    </ModalShell>
  )
}

export default function Vendors() {
  const [vendors, setVendors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [updatingVendorId, setUpdatingVendorId] = useState(null)
  const { showSuccess, showError } = useAlert()
  const auth = getAuthOrNull()

  const canManage = auth?.role === 'admin' || auth?.role === 'super_admin' || auth?.role === 'manager'

  const fetchVendors = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/vendors')
      if (res.success) setVendors(res.data)
      else showError('Load Error', res.error)
    } catch (err) { showError('Network Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  const handleAction = async (vendorId, action) => {
    if (updatingVendorId) return
    setUpdatingVendorId(vendorId)
    try {
      const res = await apiClient.post(`/api/vendors?id=${vendorId}&action=${action}`)
      if (res.success) {
        setVendors(current => current.map(vendor => vendor._id === vendorId ? { ...vendor, ...res.data } : vendor))
        const actionLabel = action === 'activate' ? 'activated' : action === 'deactivate' ? 'deactivated' : 'blacklisted'
        showSuccess('Updated', `Vendor ${actionLabel} successfully`)
      }
      else showError('Error', res.error)
    } catch (err) { showError('Error', err.message) }
    finally { setUpdatingVendorId(null) }
  }

  const filtered = vendors.filter(v => {
    const matchSearch = !searchQuery ||
      v.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vendorCode?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === 'ALL' || v.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: vendors.length,
    active: vendors.filter(v => v.status === 'ACTIVE').length,
    inactive: vendors.filter(v => v.status === 'INACTIVE').length,
    blacklisted: vendors.filter(v => v.status === 'BLACKLISTED').length,
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {showAdd && <AddVendorModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); fetchVendors() }} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Vendor Registry</h1>
          <p className="text-xs text-slate-500 mt-1">Manage approved suppliers and their delivery representatives</p>
        </div>
        {canManage && (
          <button onClick={() => setShowAdd(true)} className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center space-x-2 transition-all shadow-sm shadow-violet-600/20 self-start">
            <Plus size={15} /><span>Register Vendor</span>
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Vendors', value: stats.total, icon: Building2, color: 'text-slate-600', bg: 'bg-slate-50' },
          { label: 'Active', value: stats.active, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Inactive', value: stats.inactive, icon: XCircle, color: 'text-slate-400', bg: 'bg-slate-50' },
          { label: 'Blacklisted', value: stats.blacklisted, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
              <div className={`p-1.5 rounded-lg ${bg}`}><Icon size={14} className={color} /></div>
            </div>
            <div className="text-2xl font-black text-slate-800">{value}</div>
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 premium-card">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" placeholder="Search by name, email, code..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-lg py-2 pl-9 pr-4 text-xs focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none transition-all"
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'ACTIVE', 'INACTIVE', 'BLACKLISTED'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Vendor Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                <div className="flex-1 space-y-1.5"><div className="h-3 bg-slate-100 rounded w-3/4" /><div className="h-2 bg-slate-50 rounded w-1/2" /></div>
              </div>
              <div className="space-y-2">{[1, 2, 3].map(j => <div key={j} className="h-2.5 bg-slate-50 rounded" />)}</div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No vendors found</p>
          <p className="text-xs mt-1">{searchQuery ? 'Try a different search' : 'Register your first vendor to get started'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(vendor => (
            <VendorCard key={vendor._id} vendor={vendor} onAction={handleAction} actionLoading={updatingVendorId === vendor._id} />
          ))}
        </div>
      )}
    </div>
  )
}
