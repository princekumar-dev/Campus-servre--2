import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { FileText, PlusCircle, ArrowRight, Clock } from 'lucide-react'

const statusColors = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-50 text-blue-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  REVISION_REQUIRED: 'bg-amber-50 text-amber-700',
}

const requestStatusColors = {
  QUOTATION_IN_PROGRESS: 'bg-amber-50 text-amber-700',
  QUOTATION_REVISION_REQUIRED: 'bg-rose-50 text-rose-700',
  QUOTATION_SUBMITTED: 'bg-blue-50 text-blue-700',
  QUOTATION_APPROVED: 'bg-emerald-50 text-emerald-700',
}

const quotationPath = (requestId) => `/requests/${requestId}?tab=Quotation`

export default function ManagerQuotations() {
  const [quotations, setQuotations] = useState([])
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const { showError } = useAlert()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [quotationRes, requestRes] = await Promise.all([
        apiClient.get('/api/quotations'),
        apiClient.get('/api/requests'),
      ])
      if (quotationRes.success) setQuotations(quotationRes.data || [])
      if (requestRes.success) setRequests(requestRes.data || [])
    } catch (err) {
      showError('Error', err.message)
    } finally {
      setIsLoading(false)
    }
  }, [showError])

  useEffect(() => { fetchData() }, [fetchData])

  const actionableRequests = requests.filter(request =>
    ['QUOTATION_IN_PROGRESS', 'QUOTATION_REVISION_REQUIRED', 'QUOTATION_SUBMITTED', 'QUOTATION_APPROVED'].includes(request.status)
  )

  const filtered = quotations.filter(q => filter === 'ALL' || q.status === filter)

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Quotations</h1>
        <p className="text-xs text-slate-500 mt-1">Create, revise, submit, and track quotations for your assigned requests</p>
      </div>

      <div className="premium-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Quotation Workflow</h2>
            <p className="mt-1 text-xs text-slate-500">Open the request, add the quotation, then submit it for admin approval.</p>
          </div>
          <Link to="/requests" className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 transition-all">
            <PlusCircle size={14} /> Assigned Requests
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-violet-600" />
          <h2 className="text-sm font-bold text-slate-800">Requests Requiring Quotation Action</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 premium-card"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
        ) : actionableRequests.length === 0 ? (
          <div className="premium-card p-6 text-center text-slate-400">
            <p className="text-sm font-medium">No requests currently need quotation work</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {actionableRequests.map(request => {
              const actionLabel =
                request.status === 'QUOTATION_IN_PROGRESS' ? 'Add Quotation' :
                request.status === 'QUOTATION_REVISION_REQUIRED' ? 'Revise Quotation' :
                request.status === 'QUOTATION_SUBMITTED' ? 'View Submitted Quote' :
                'View Approved Quote'

              return (
                <div key={request._id} className="premium-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-violet-600 font-bold">{request.requestNumber}</div>
                      <div className="mt-1 text-sm font-bold text-slate-800">{request.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{request.requestedItem || 'Service request'}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${requestStatusColors[request.status] || 'bg-slate-100 text-slate-600'}`}>
                      {request.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      {request.quotation?.quotationNumber ? `Quote: ${request.quotation.quotationNumber}` : 'Quotation not created yet'}
                    </div>
                    <Link
                      to={quotationPath(request._id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 transition-all"
                    >
                      {actionLabel} <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 p-4 premium-card">
        {['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === s ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {s === 'ALL' ? 'All Quotations' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 premium-card">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No quotations found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => (
            <div key={q._id} className="premium-card p-5 hover:border-violet-200 transition-all">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-2.5 bg-violet-50 rounded-xl text-violet-600"><FileText size={18} /></div>
                  <div>
                    <div className="font-mono text-xs text-violet-600 font-bold">{q.quotationNumber || q._id?.slice(-6)}</div>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">{q.requestTitle || q.vendorName || 'Request quotation'}</div>
                    <div className="text-xs text-slate-500">Request: {q.requestNumber} · Version {q.version || 1}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:text-right">
                  <div>
                    <div className="text-lg font-black text-slate-800">₹{(q.grandTotal || 0).toLocaleString('en-IN')}</div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[q.status] || 'bg-slate-100 text-slate-600'}`}>
                      {q.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <Link
                    to={quotationPath(q.requestId || q._id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 transition-all"
                  >
                    Open <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
