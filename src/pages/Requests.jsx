import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { formatDistanceToNow } from 'date-fns'
import { Search, PlusCircle, ChevronRight, X, ChevronLeft, Filter, ClipboardList, ArrowRight, Sparkles, TimerReset, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/ui'
import ConfirmDialog from '../components/ConfirmDialog'
import { getRoleActionStatuses, getWorkflowGuidance, getWorkflowPhase } from '../utils/workflowGuidance'

const TRACKING_FILTERS = {
  requester: [
    { label: 'All', value: 'ALL' }, { label: 'Draft', value: 'DRAFT' },
    { label: 'Admin Review', value: 'SUBMITTED' }, { label: 'Assigned to PM', value: 'ASSIGNED_TO_MANAGER' },
    { label: 'Order Created', value: 'PURCHASE_ORDER_CREATED' }, { label: 'Closed', value: 'CLOSED' },
  ],
  admin: [
    { label: 'All', value: 'ALL' }, { label: 'Needs Triage', value: 'SUBMITTED' },
    { label: 'Assigned to PM', value: 'ASSIGNED_TO_MANAGER' }, { label: 'Order Created', value: 'PURCHASE_ORDER_CREATED' },
    { label: 'Closed', value: 'CLOSED' },
  ],
  manager: [
    { label: 'All', value: 'ALL' }, { label: 'Ready for PO', value: 'ASSIGNED_TO_MANAGER' },
    { label: 'Order Created', value: 'PURCHASE_ORDER_CREATED' }, { label: 'Closed', value: 'CLOSED' },
  ],
}

const STATUS_PRESENTATION = {
  DRAFT: { label: 'Draft', helper: 'Not submitted yet', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  SUBMITTED: { label: 'Admin Review', helper: 'Waiting for classification', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ASSIGNED_TO_MANAGER: { label: 'Assigned to PM', helper: 'Ready for order creation', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  PURCHASE_ORDER_CREATED: { label: 'Order Created', helper: 'Purchase order generated', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  CLOSED: { label: 'Closed', helper: 'Workflow completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rejected', helper: 'Request was not approved', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Cancelled', helper: 'Request was cancelled', color: 'bg-slate-100 text-slate-600 border-slate-200' },
}

const normalizeRole = role => ['hod', 'staff'].includes(role) ? 'requester' : role
const getStatusPresentation = status => STATUS_PRESENTATION[status] || { label: status?.replace(/_/g, ' ') || 'Unknown', helper: 'Legacy workflow record', color: 'bg-slate-100 text-slate-600 border-slate-200' }

const ITEMS_PER_PAGE = 15

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

function Requests() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [requests, setRequests] = useState([])
  const [statusCounts, setStatusCounts] = useState({})
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'ALL')
  const [selectedPriority, setSelectedPriority] = useState('ALL')
  const [queueMode, setQueueMode] = useState(searchParams.get('queue') || 'ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showError, showSuccess } = useAlert()
  const auth = getAuthOrNull()
  const searchRef = useRef(null)
  const roleKey = normalizeRole(auth?.role)
  const quickFilters = TRACKING_FILTERS[roleKey] || TRACKING_FILTERS.requester

  const debouncedSearch = useCallback(
    debounce((val) => {
      setSearchQuery(val)
      setCurrentPage(1)
    }, 300),
    []
  )

  useEffect(() => {
    const fetchRequests = async () => {
      setIsLoading(true)
      try {
        const res = await apiClient.get('/api/requests')
        if (res.success) {
          setRequests(res.data)
          const counts = {}
          res.data.forEach(r => {
            counts[r.status] = (counts[r.status] || 0) + 1
          })
          counts['ALL'] = res.data.length
          setStatusCounts(counts)
        } else {
          showError('Load Error', res.error || 'Failed to fetch requests')
        }
      } catch (err) {
        showError('Network Error', err.message || 'Server error')
      } finally {
        setIsLoading(false)
      }
    }
    fetchRequests()
  }, [showError])

  const filteredRequests = useMemo(() => {
    const myActionStatuses = getRoleActionStatuses(auth?.role)
    return requests.filter(req => {
      if (selectedStatus !== 'ALL' && req.status !== selectedStatus) return false
      if (selectedPriority !== 'ALL' && req.priority !== selectedPriority) return false
      if (queueMode === 'MY_ACTIONS' && !myActionStatuses.includes(req.status)) return false
      const q = searchQuery.toLowerCase()
      if (!q) return true
      return (
        req.title?.toLowerCase().includes(q) ||
        req.requestNumber?.toLowerCase().includes(q) ||
        req.requesterName?.toLowerCase().includes(q) ||
        req.location?.toLowerCase().includes(q) ||
        req.category?.toLowerCase().includes(q)
      )
    })
  }, [requests, searchQuery, selectedStatus, selectedPriority, queueMode, auth?.role])

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE)
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  useEffect(() => { setCurrentPage(1) }, [searchQuery, selectedStatus, selectedPriority])

  const myActionStatuses = getRoleActionStatuses(auth?.role)
  const myActionCount = requests.filter(req => myActionStatuses.includes(req.status)).length
  const handleQueueMode = mode => {
    setQueueMode(mode)
    setCurrentPage(1)
    const next = new URLSearchParams(searchParams)
    if (mode === 'MY_ACTIONS') next.set('queue', 'MY_ACTIONS')
    else next.delete('queue')
    setSearchParams(next)
  }

  const handleStatusFilter = (status) => {
    setSelectedStatus(status)
    if (status === 'ALL') {
      searchParams.delete('status')
    } else {
      searchParams.set('status', status)
    }
    setSearchParams(searchParams)
  }

  useEffect(() => {
    if (!quickFilters.some(filter => filter.value === selectedStatus)) handleStatusFilter('ALL')
  }, [roleKey])

  const getPriorityBorder = (priority) => {
    switch (priority) {
      case 'EMERGENCY': return 'border-l-rose-500'
      case 'HIGH': return 'border-l-amber-500'
      case 'MEDIUM': return 'border-l-blue-500'
      default: return 'border-l-slate-300'
    }
  }

  const canManageRequest = (request) => String(request.requesterId) === String(auth?.id)

  const canEditRequest = (request) => {
    if (!canManageRequest(request)) return false
    if (['DRAFT', 'CLARIFICATION_REQUIRED'].includes(request.status)) return true
    const submittedAt = request.submittedAt || request.createdAt
    return request.status === 'SUBMITTED' && Date.now() - new Date(submittedAt).getTime() <= 24 * 60 * 60 * 1000
  }

  const deleteRequest = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await apiClient.del(`/api/requests?id=${deleteTarget._id}`)
      if (res?.success) {
        setRequests(current => current.filter(item => item._id !== deleteTarget._id))
        setStatusCounts(current => ({
          ...current,
          ALL: Math.max(0, (current.ALL || 1) - 1),
          [deleteTarget.status]: Math.max(0, (current[deleteTarget.status] || 1) - 1)
        }))
        showSuccess('Request deleted', `${deleteTarget.requestNumber} was permanently removed.`)
        setDeleteTarget(null)
      }
    } catch (err) {
      showError('Delete failed', err.message || 'Could not delete this request')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 page-enter">
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this request?"
        description={deleteTarget ? `${deleteTarget.requestNumber} will be permanently deleted along with its request history. This action cannot be undone.` : ''}
        confirmLabel="Delete request"
        cancelLabel="Keep request"
        loading={isDeleting}
        variant="danger"
        onCancel={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={deleteRequest}
      />

      <PageHeader
        title={roleKey === 'requester' ? 'My Requests' : roleKey === 'admin' ? 'Request Triage' : roleKey === 'manager' ? 'Assigned Requests' : 'Requests'}
        subtitle={roleKey === 'requester' ? 'Track each request from submission to order creation.' : roleKey === 'admin' ? 'Classify new requests and assign them to a purchase manager.' : roleKey === 'manager' ? 'Create purchase orders only for requests assigned to you.' : 'Track request progress.'}
        role={auth?.role}
        action={['requester', 'hod', 'staff'].includes(auth?.role) ? (
          <Link to="/requests/new" className="btn-premium">
            <PlusCircle size={15} />
            <span>Create Request</span>
          </Link>
        ) : null}
      />

      {/* Personal work queue */}
      {myActionStatuses.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-600 p-2.5 text-white"><Sparkles size={17} /></div>
            <div>
              <p className="text-sm font-extrabold text-slate-900">My action queue</p>
              <p className="text-xs text-slate-600">{myActionCount ? `${myActionCount} request${myActionCount === 1 ? '' : 's'} currently need your role.` : 'Nothing needs your role right now.'}</p>
            </div>
          </div>
          <div className="flex rounded-xl border border-violet-200 bg-white p-1">
            <button onClick={() => handleQueueMode('MY_ACTIONS')} className={`rounded-lg px-3 py-2 text-xs font-bold ${queueMode === 'MY_ACTIONS' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Needs my action ({myActionCount})</button>
            <button onClick={() => handleQueueMode('ALL')} className={`rounded-lg px-3 py-2 text-xs font-bold ${queueMode === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>All records</button>
          </div>
        </div>
      )}

      {/* Quick Filter Chips */}
      <div className="rounded-2xl border border-violet-100 bg-white p-3 shadow-sm sm:p-4">
        <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Track by workflow stage</p>
        <div className="mobile-edge-scroll flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {quickFilters.map(f => {
            const active = selectedStatus === f.value
            return (
              <button key={f.value} onClick={() => handleStatusFilter(f.value)} aria-pressed={active}
                className={`group flex h-10 flex-shrink-0 items-center gap-2 rounded-full border px-3.5 text-[11px] font-extrabold transition-all ${active ? 'border-violet-600 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-200/70' : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700'}`}>
                <span>{f.label}</span>
                <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-violet-100 group-hover:text-violet-700'}`}>{statusCounts[f.value] || 0}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Search & Advanced Filters */}
      <div className="premium-card">
        <div className="flex min-w-0 items-center gap-2 p-3 sm:gap-3 sm:p-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by number, title, location, requester..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                debouncedSearch(e.target.value)
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-9 text-slate-800 placeholder-slate-400 text-xs focus:bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput('')
                  setSearchQuery('')
                  searchRef.current?.focus()
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
              showFilters || selectedPriority !== 'ALL'
                ? 'bg-violet-50 border-violet-200 text-violet-700'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Filter size={14} />
            <span className="hidden sm:inline">Filters</span>
            {selectedPriority !== 'ALL' && (
              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full" />
            )}
          </button>
        </div>

        {showFilters && (
          <div className="px-4 pb-4 pt-0 border-t border-slate-100">
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Priority</span>
              <div className="flex gap-1.5">
                {['ALL', 'EMERGENCY', 'HIGH', 'MEDIUM', 'LOW'].map(p => (
                  <button
                    key={p}
                    onClick={() => { setSelectedPriority(p); setCurrentPage(1) }}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                      selectedPriority === p
                        ? p === 'EMERGENCY' ? 'bg-rose-500 text-white' :
                          p === 'HIGH' ? 'bg-amber-500 text-white' :
                          p === 'MEDIUM' ? 'bg-blue-500 text-white' :
                          p === 'LOW' ? 'bg-slate-500 text-white' :
                          'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {p === 'ALL' ? 'All' : p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="premium-card overflow-hidden">
        {isLoading ? (
          <div className="py-16">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-slate-50">
                <div className="skeleton h-4 w-20 rounded" />
                <div className="skeleton h-4 w-40 rounded" />
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton h-4 w-20 rounded" />
                <div className="skeleton h-5 w-16 rounded-full" />
                <div className="skeleton h-5 w-24 rounded-full" />
              </div>
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="px-4 py-10 text-center sm:px-6 sm:py-16">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 sm:h-16 sm:w-16">
              <ClipboardList size={28} className="text-slate-300" />
            </div>
            <h3 className="text-sm font-bold text-slate-600 mb-1">
              {searchQuery ? 'No matching requests' : 'No requests yet'}
            </h3>
            <p className="text-xs text-slate-400 mb-6 max-w-sm mx-auto">
              {searchQuery
                ? `No requests match "${searchQuery}". Try adjusting your search or filters.`
                : 'Create your first service request to get started.'
              }
            </p>
            {auth?.role === 'requester' && !searchQuery && (
              <Link to="/requests/new" className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg transition-all">
                <PlusCircle size={14} /> Create Request
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 sm:hidden">
              {paginatedRequests.map((req) => (
                (() => {
                  const guidance = getWorkflowGuidance(req.status, auth?.role)
                  const phase = getWorkflowPhase(req.status)
                  return (
                <Link
                  key={req._id}
                  to={`/requests/${req._id}`}
                  className={`block min-w-0 rounded-xl border border-slate-100 border-l-4 bg-white p-4 shadow-sm ${getPriorityBorder(req.priority)}`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs font-bold text-violet-600">{req.requestNumber}</p>
                      <h3 className="mt-1 break-words text-sm font-bold leading-snug text-slate-800">{req.title}</h3>
                    </div>
                    <ChevronRight size={18} className="mt-1 flex-shrink-0 text-slate-400" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                      req.priority === 'EMERGENCY' ? 'bg-rose-100 text-rose-700' :
                      req.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                      req.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{req.priority}</span>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-extrabold ${getStatusPresentation(req.status).color}`} title={getStatusPresentation(req.status).helper}>
                      {getStatusPresentation(req.status).label}
                    </span>
                    {req.isEscalated && <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700"><TimerReset size={10} /> Overdue</span>}
                    <span className="ml-auto text-[10px] text-slate-400">
                      {req.updatedAt ? formatDistanceToNow(new Date(req.updatedAt), { addSuffix: true }) : ''}
                    </span>
                  </div>
                  <div className={`mt-3 rounded-lg px-3 py-2 text-[11px] ${guidance.isMyTurn ? 'bg-violet-50 font-semibold text-violet-700' : 'bg-slate-50 text-slate-500'}`}>
                    <span className="font-bold">{guidance.isMyTurn ? 'Next: ' : phase ? `${phase.short}: ` : ''}</span>{guidance.title}
                  </div>
                </Link>
                  )
                })()
              ))}
            </div>

            <div className="requests-table-scroll hidden overflow-x-auto sm:block lg:overflow-x-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3 px-6">Number</th>
                    <th className="py-3 px-2">Subject</th>
                    <th className="py-3 px-2 hidden lg:table-cell">Location</th>
                    <th className="py-3 px-2 hidden sm:table-cell">Requester</th>
                    <th className="py-3 px-2">Priority</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 hidden md:table-cell">Updated</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedRequests.map((req) => (
                    <tr key={req._id} className={`table-row-hover border-l-3 ${getPriorityBorder(req.priority)} ${getWorkflowGuidance(req.status, auth?.role).isMyTurn ? 'bg-violet-50/30' : ''}`}>
                      <td className="py-4 px-6">
                        <span className="font-mono text-xs text-violet-600 font-bold">{req.requestNumber}</span>
                      </td>
                      <td className="py-4 px-2">
                        <div className="font-semibold text-slate-800 text-xs">{req.title}</div>
                        <span className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded mt-1 inline-block capitalize border border-slate-100">{req.category}</span>
                      </td>
                      <td className="py-4 px-2 hidden lg:table-cell text-slate-500 text-xs">{req.location}</td>
                      <td className="py-4 px-2 hidden sm:table-cell">
                        <div className="text-xs font-semibold text-slate-700">{req.requesterName}</div>
                      </td>
                      <td className="py-4 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          req.priority === 'EMERGENCY' ? 'bg-rose-100 text-rose-700' :
                          req.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                          req.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="py-4 px-2">
                        <div>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${getStatusPresentation(req.status).color}`}>
                            {getStatusPresentation(req.status).label}
                          </span>
                          <p className="mt-1 max-w-[150px] text-[10px] leading-tight text-slate-400">{getStatusPresentation(req.status).helper}</p>
                        </div>
                        {req.isEscalated && <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700"><TimerReset size={10} /> Overdue</span>}
                      </td>
                      <td className="py-4 px-2 hidden md:table-cell text-xs text-slate-400">
                        {req.updatedAt ? formatDistanceToNow(new Date(req.updatedAt), { addSuffix: true }) : '—'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {canEditRequest(req) && (
                            <Link to={`/requests/${req._id}/edit`} title="Edit request" className="rounded-lg border border-violet-200 bg-violet-50 p-2 text-violet-700 hover:bg-violet-100">
                              <Pencil size={13} />
                            </Link>
                          )}
                          {canManageRequest(req) && (
                            <button type="button" onClick={() => setDeleteTarget(req)} title="Delete request" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100">
                              <Trash2 size={13} />
                            </button>
                          )}
                          <Link
                            to={`/requests/${req._id}`}
                            className="inline-flex items-center gap-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg shadow-sm transition-all group"
                          >
                            {getWorkflowGuidance(req.status, auth?.role).isMyTurn ? 'Take action' : 'View'} <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-slate-100 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <span className="text-xs text-slate-400 font-semibold">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page
                    if (totalPages <= 5) page = i + 1
                    else if (currentPage <= 3) page = i + 1
                    else if (currentPage >= totalPages - 2) page = totalPages - 4 + i
                    else page = currentPage - 2 + i
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                          currentPage === page
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Requests
