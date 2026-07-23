import { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react'
import apiClient from '../utils/apiClient'
import ReactDOM from 'react-dom'
import { X, UserCheck, UserX, Clock, CheckCircle, XCircle, Bell } from 'lucide-react'
import SwipeableCard from './SwipeableCard'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { 
  NOTIFICATION_TYPES, 
  getNotificationConfig, 
  groupNotificationsByCategory, 
  getCategoryLabel, 
  shouldAutoDismiss,
  getAutoDismissDelay,
  isAccountNotification
} from '../utils/notificationTypes'
import {
  NotificationItem,
  StaffAccountRequestItem
} from './NotificationItems'

function getAuthUserId(auth) {
  return (
    auth?.id ||
    auth?.user?.id ||
    auth?._id ||
    auth?.user?._id ||
    auth?.userId ||
    localStorage.getItem('userId')
  )
}

const isLateStaffNotification = (notification) => {
  const type = String(notification?.type || '').toLowerCase()
  if (type.startsWith('late_')) return true
  const title = String(notification?.title || '').toLowerCase()
  return title.includes('late')
}

const StaffNotificationItem = memo(({ notification, onDismiss }) => {
  const actions = useMemo(() => [
    {
      label: 'Dismiss',
      icon: <X className="w-5 h-5" />,
      onClick: () => onDismiss(notification),
      className: 'bg-red-500 hover:bg-red-600 text-white',
      direction: 'right',
      autoTrigger: true
    }
  ], [onDismiss, notification])

  const badgeLabel = notification?.type?.includes('confirmed') ? 'Reached' : 'Late'

  return (
    <SwipeableCard actions={actions}>
      <div className={`p-4 sm:p-5 transition-all ${notification.read ? 'bg-white' : 'bg-amber-50'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                {badgeLabel}
              </span>
              {!notification.read && <span className="text-[11px] font-semibold text-amber-700">NEW</span>}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-gray-900 break-words">{notification.title}</h3>
            <p className="text-xs sm:text-sm text-gray-700 mt-1 break-words">{notification.body}</p>
            <p className="text-[11px] text-gray-500 mt-2">
              {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Just now'}
            </p>
          </div>
          <button
            onClick={() => onDismiss(notification)}
            className="hidden sm:inline-flex text-xs font-semibold text-red-700 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-100"
          >
            Dismiss
          </button>
        </div>
      </div>
    </SwipeableCard>
  )
})

StaffNotificationItem.displayName = 'StaffNotificationItem'

// Backwards compat: HODRequestItem wrapper for old code
const HODRequestItem = memo(({ request, onApprove, onReject, processing }) => {
  if (request.type === 'staff_account_approval') {
    return (
      <StaffAccountRequestItem
        request={request}
        onApprove={onApprove}
        onReject={onReject}
        processing={processing}
      />
    )
  }
  return null
})

HODRequestItem.displayName = 'HODRequestItem'

// Backwards compat: AdminNotificationItem wrapper
const AdminNotificationItem = memo(({ notification, onMarkRead }) => (
  <NotificationItem
    notification={notification}
    onDismiss={() => {}} // Admin doesn't delete, only marks read
    onMarkRead={onMarkRead}
    showNewBadge={true}
  />
))

AdminNotificationItem.displayName = 'AdminNotificationItem'

export default function NotificationRequests({ isOpen, onClose, setUnreadCount }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const [userRole, setUserRole] = useState('')
  const [staffStatus, setStaffStatus] = useState(null)
  const [staffNotifications, setStaffNotifications] = useState([])
  const [rejectDialog, setRejectDialog] = useState({ open: false, request: null, reason: '' })

  useEffect(() => {
    if (isOpen) {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}')
      const userRole = auth?.role || auth.user?.role || ''
      setUserRole(userRole)
      setLoading(true)
      // If we just did an optimistic approve/reject, bypass apiClient GET cache
      // so reopening the modal doesn't show stale pending items.
      const optimisticTs = window.__campusserveOptimisticNotificationsTs
      const force = optimisticTs && Date.now() - optimisticTs < 2500
      scheduleFetch({ force: !!force, immediate: true })
    }
  }, [isOpen])

  // Listen for auth updates (signature saved) so the modal can refresh automatically
  useEffect(() => {
    const onAuthChange = () => {
      if (isOpen) scheduleFetch({ force: true, immediate: true })
    }
    window.addEventListener('authStateChanged', onAuthChange)
    return () => window.removeEventListener('authStateChanged', onAuthChange)
  }, [isOpen])

  // Listen for global notification/request updates so modal stays fresh
  useEffect(() => {
    if (!isOpen) return
    const handler = () => {
      if (lastOptimisticUpdateRef.current && Date.now() - lastOptimisticUpdateRef.current < SKIP_REFETCH_MS) return
      scheduleFetch({ force: true })
    }
    window.addEventListener('notificationsUpdated', handler)
    window.addEventListener('requestsUpdated', handler)
    return () => {
      window.removeEventListener('notificationsUpdated', handler)
      window.removeEventListener('requestsUpdated', handler)
    }
  }, [isOpen])

  // Real-time push notifications - only listen when modal is open
  usePushNotifications(isOpen ? {
    'staff_approval': () => {
      fetchRequests({ force: true })
    },
    'service_request': () => {
      fetchRequests({ force: true })
    }
  } : {})

  // When we optimistically remove an item (approve/reject), skip the next event-driven refetch to avoid double reload
  const lastOptimisticUpdateRef = useRef(0)
  const SKIP_REFETCH_MS = 2000
  const optimisticHiddenIdsRef = useRef(new Map())
  const OPTIMISTIC_HIDE_MS = 15000

  const markOptimisticProcessed = (requestId) => {
    if (!requestId) return
    const now = Date.now()
    lastOptimisticUpdateRef.current = now
    try { window.__campusserveOptimisticNotificationsTs = now } catch (e) { }
    try { optimisticHiddenIdsRef.current.set(String(requestId), now) } catch (e) { }
  }

  const applyOptimisticVisibility = (items = []) => {
    const now = Date.now()
    const hidden = optimisticHiddenIdsRef.current
    if (!hidden || hidden.size === 0) return items

    const visible = items.filter((item) => {
      const id = String(item?._id || item?.data?.requestId || '')
      if (!id) return true
      const hiddenAt = hidden.get(id)
      if (!hiddenAt) return true
      if (now - hiddenAt > OPTIMISTIC_HIDE_MS) {
        hidden.delete(id)
        return true
      }
      return false
    })

    return visible
  }

  const removeRequestOptimistically = (requestId) => {
    setRequests((prev) => {
      const next = prev.filter((r) => r._id !== requestId)
      if (setUnreadCount) setUnreadCount(next.length)
      if (next.length === 0) {
        setTimeout(() => {
          try { onClose() } catch (e) { }
        }, 0)
      }
      return next
    })
  }

  // Debounced fetch helper to avoid multiple rapid refreshes
  const fetchTimerRef = useRef(null)
  const fetchInFlightRef = useRef(false)
  const scheduleFetch = (opts = {}) => {
    const { force = false, immediate = false } = opts
    if (immediate) {
      if (fetchTimerRef.current) { clearTimeout(fetchTimerRef.current); fetchTimerRef.current = null }
      if (fetchInFlightRef.current) {
        return new Promise((resolve) => {
          fetchTimerRef.current = setTimeout(async () => {
            try { await fetchRequests({ force }) } catch (e) { }
            try { window.refreshNotificationCount && window.refreshNotificationCount() } catch (e) { }
            resolve()
          }, 200)
        })
      }
      fetchInFlightRef.current = true
      return fetchRequests({ force }).finally(() => { fetchInFlightRef.current = false }).then((v) => {
        try { window.refreshNotificationCount && window.refreshNotificationCount() } catch (e) { }
        return v
      })
    } else {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
      fetchTimerRef.current = setTimeout(async () => {
        if (fetchInFlightRef.current) return
        fetchInFlightRef.current = true
        try { await fetchRequests({ force }) } catch (e) { }
        try { window.refreshNotificationCount && window.refreshNotificationCount() } catch (e) { }
        fetchInFlightRef.current = false
      }, 150)
      return Promise.resolve()
    }
  }

  const fetchRequests = async (opts = {}) => {
    const { force = false } = opts
    try {
      setLoading(true)
      const auth = JSON.parse(localStorage.getItem('auth') || '{}')
      const userRole = auth?.role || auth.user?.role
      const userId = getAuthUserId(auth)

      if (userRole === 'hod') {
        const hodId = userId
        if (!hodId) {
          setRequests([])
          setLoading(false)
          return
        }

        const staffApiUrl = `/api/staff-approval?action=pending&hodId=${hodId}`

        try {
          const getOpts = force ? { cache: false, dedupe: false } : {}
          const staffData = await apiClient.get(staffApiUrl, getOpts)

          const allRequests = []

          // Process staff requests
          if (staffData.success && staffData.requests) {
            const staffRequests = (staffData.requests || []).map(req => ({
              _id: req.id,
              type: 'staff_account_approval',
              createdAt: req.createdAt,
              data: {
                requestId: req.id,
                staffName: req.name,
                staffEmail: req.email,
                phoneNumber: req.phoneNumber,
                department: req.department,
                year: req.year,
                section: req.section,
                status: 'pending'
              }
            }))
            allRequests.push(...staffRequests)
          }

          const visibleRequests = applyOptimisticVisibility(allRequests)
          setRequests(visibleRequests)
          if (setUnreadCount) setUnreadCount(visibleRequests.length)
        } catch (error) {
          console.error('[NotificationRequests] Error fetching requests:', error)
          setRequests([])
        }
      } else if (userRole === 'staff') {
        // For Staff: Check approval status from notifications + late requests
        const staffEmail = (auth?.email || auth?.user?.email || '').toLowerCase()
        const data = await apiClient.get(`/api/notifications?userEmail=${staffEmail}`, force ? { cache: false, dedupe: false } : {})

        let allRequests = []

        if (data.success) {
          const statusTypes = new Set([
            'staff_account_approval',
            'staff_account_status',
            'staff_account_approved',
            'staff_account_rejected'
          ])

          const latestStaffStatus = [...(data.notifications || [])]
            .filter((n) => {
              if (!n || !statusTypes.has(n.type)) return false
              const notifEmail = String(n.userEmail || '').toLowerCase()
              const dataEmail = String(n.data?.staffEmail || '').toLowerCase()
              return notifEmail === staffEmail || dataEmail === staffEmail
            })
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]

          if (latestStaffStatus) {
            const derivedStatus = latestStaffStatus?.data?.status
              || (latestStaffStatus.type === 'staff_account_approved'
                ? 'approved'
                : latestStaffStatus.type === 'staff_account_rejected'
                  ? 'rejected'
                  : 'pending')

            setStaffStatus({
              status: derivedStatus,
              processedAt: latestStaffStatus.data?.processedAt,
              department: latestStaffStatus.data?.department || auth?.department || auth?.user?.department,
              year: latestStaffStatus.data?.year || auth?.year || auth?.user?.year,
              section: latestStaffStatus.data?.section || auth?.section || auth?.user?.section,
              createdAt: latestStaffStatus.createdAt
            })
          }

          const staffUpdates = (data.notifications || [])
            .filter((n) => n && !statusTypes.has(n.type) && isLateStaffNotification(n))
            .filter((n) => !n.read)
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

          setStaffNotifications(staffUpdates)
        } else {
          setStaffNotifications([])
        }

        // Fetch late arrival requests for staff's year/section
        if (auth?.year && auth?.section && auth?.department) {
          try {
            // Ask backend to filter by year/section too (less payload => faster render).
            const lateData = await apiClient.get(
              `/api/leaves?department=${auth.department}&type=late&status=waiting_for_arrival_confirmation&year=${encodeURIComponent(auth.year)}&section=${encodeURIComponent(auth.section)}`,
              force ? { cache: false, dedupe: false } : {}
            )

            if (lateData.success && lateData.requests) {
              const lateRequests = (lateData.requests || []).map(req => ({
                  _id: req._id,
                  type: 'late_arrival',
                  createdAt: req.createdAt,
                  data: {
                    requestId: req._id,
                    studentName: req.studentDetails?.name,
                    regNumber: req.studentDetails?.regNumber,
                    department: req.studentDetails?.department,
                    year: req.studentDetails?.year,
                    section: req.studentDetails?.section,
                    reason: req.reason,
                    expectedArrivalTime: req.expectedArrivalTime,
                    type: req.type,
                    status: 'pending'
                  }
                }))
              allRequests = [...allRequests, ...lateRequests]
            }
          } catch (error) {
            console.error('[NotificationRequests] Error fetching late requests:', error)
          }
        }

        setRequests(allRequests)
      } else if (userRole === 'admin') {
        // Admin: fetch notifications targeted to the admin account
        const email = auth?.email || auth.user?.email
        if (!email) {
          setRequests([])
        } else {
          const data = await apiClient.get(`/api/notifications?userEmail=${encodeURIComponent(email)}`, force ? { cache: false, dedupe: false } : {})
          if (data.success && Array.isArray(data.notifications)) {
            const normalized = data.notifications.map(n => ({
              _id: n._id,
              type: n.type || 'system',
              title: n.title || 'System notification',
              body: n.body || n.message || 'No details provided',
              createdAt: n.createdAt,
              read: !!n.read,
              data: n.data || {}
            }))
            setRequests(normalized)
            if (setUnreadCount) {
              setUnreadCount(normalized.filter(n => !n.read).length)
            }
          } else {
            setRequests([])
          }
        }
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (request) => {
    // For late arrival: only record (mark as waiting for student confirmation)
    if (request.type === 'late_arrival') {
      setProcessing(request._id)

      markOptimisticProcessed(request._id)
      removeRequestOptimistically(request._id)
      
      // Notify other components immediately
      try { import('../utils/notificationEvents').then(m => m.notifyNotificationsUpdatedImmediate && m.notifyNotificationsUpdatedImmediate()) } catch (e) { }
      try { window.dispatchEvent(new Event('notificationsUpdated')) } catch (e) { }

      // Fire backend update in background (don't wait for it)
      const auth = JSON.parse(localStorage.getItem('auth') || '{}')
      const staffId = getAuthUserId(auth)
      apiClient.patch(`/api/leaves?id=${request.data.requestId}&action=acknowledge`, { staffId }).catch(err => {
        console.error('Error recording late arrival:', err)
      }).finally(() => {
        setProcessing(null)
      })
      return
    }

    // For staff_account_approval requests: proceed normally
    setProcessing(request._id)

    markOptimisticProcessed(request._id)
    removeRequestOptimistically(request._id)
    
    // Notify other components immediately
    try { import('../utils/notificationEvents').then(m => m.notifyNotificationsUpdatedImmediate && m.notifyNotificationsUpdatedImmediate()) } catch (e) { }
    try { if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('notificationsUpdated')) } catch (e) { }

    // Fire backend update in background (don't wait for it)
    const auth = JSON.parse(localStorage.getItem('auth') || '{}')
    const hodId = getAuthUserId(auth)
    
    const requestType = request.type === 'staff_account_approval' ? 'Staff account' : 'Leave request'
    console.log(`✅ ${requestType} approved successfully`)
    
    // Update unread count
    if (setUnreadCount) {
      const unread = requests.filter(r => r._id !== request._id && !r.read)
      setUnreadCount(unread.length)
    }
    
    // Send backend update asynchronously without waiting
    if (request.type === 'staff_account_approval') {
      apiClient.patch('/api/staff-approval', { requestId: request.data.requestId, action: 'approve', hodId }, { timeout: 20000, retry: 1, dispatch: false }).catch(err => {
        console.error('Error approving staff account in background:', err)
      }).finally(() => {
        setProcessing(null)
      })
    }
  }

  const handleReject = async (request) => {
    // Replace old browser prompt with in-app modal
    setRejectDialog({ open: true, request, reason: '' })
  }

  const openReject = (request) => {
    setRejectDialog({ open: true, request, reason: '' })
  }

  const closeReject = () => {
    setRejectDialog({ open: false, request: null, reason: '' })
    setProcessing(null)
  }

  const confirmReject = async () => {
    if (!rejectDialog || !rejectDialog.request) return
    const request = rejectDialog.request
    setProcessing(request._id)

    markOptimisticProcessed(request._id)
    removeRequestOptimistically(request._id)
    
    // Close reject dialog immediately
    closeReject()
    
    // Notify other components immediately
    try { import('../utils/notificationEvents').then(m => m.notifyNotificationsUpdatedImmediate && m.notifyNotificationsUpdatedImmediate()) } catch (e) { }
    try { window.dispatchEvent(new Event('notificationsUpdated')) } catch (e) { }
    
    // Fire backend update in background (don't wait for it)
    const auth = JSON.parse(localStorage.getItem('auth') || '{}')
    const hodId = getAuthUserId(auth)
    const reason = (rejectDialog.reason || '').trim()
    
    const requestType = request.type === 'staff_account_approval' ? 'Staff account' : 'Leave request'
    console.log(`⛔ ${requestType} rejected successfully`)
    
    // Send backend update asynchronously without waiting
    if (request.type === 'staff_account_approval') {
      apiClient.patch('/api/staff-approval', { requestId: request.data.requestId, action: 'reject', hodId, rejectionReason: reason }, { dispatch: false }).catch(err => {
        console.error('Error rejecting staff account in background:', err)
      }).finally(() => {
        setProcessing(null)
      })
    }
  }

  const markNotificationAsRead = useCallback(async (notificationId) => {
    try {
      await apiClient.patch(`/api/notifications/${notificationId}/read`)
      setRequests(prev => {
        const updated = prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
        if (setUnreadCount) {
          const unread = updated.filter(n => !n.read)
          setUnreadCount(unread.length)
        }
        return updated
      })
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [setUnreadCount])

  const dismissNotification = useCallback(async (notification) => {
    if (!notification?._id) return
    
    try {
      // Delete notification permanently from database
      await apiClient.del(`/api/notifications/${notification._id}`)
    } catch (error) {
      console.error('Error dismissing notification:', error)
    }

    setRequests(prev => {
      const next = prev.filter(n => n._id !== notification._id)
      if (setUnreadCount) {
        const unread = next.filter(n => !n.read)
        setUnreadCount(unread.length)
      }
      return next
    })
    
    // Also remove from staff notifications if present
    setStaffNotifications(prev => prev.filter(n => n._id !== notification._id))
  }, [setUnreadCount])

  // Backwards compat alias
  const dismissStaffNotification = dismissNotification

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      const unread = requests.filter(n => !n.read)
      await Promise.all(unread.map(n => apiClient.patch(`/api/notifications/${n._id}/read`)))
      setRequests(prev => prev.map(n => ({ ...n, read: true })))
      if (setUnreadCount) setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }, [requests, setUnreadCount])

  const handleApproveHandler = useCallback(handleApprove, [handleApprove])
  const handleRejectHandler = useCallback(handleReject, [handleReject])
  const confirmRejectHandler = useCallback(confirmReject, [confirmReject])
  const dismissNotificationHandler = useCallback(dismissNotification, [dismissNotification])

  if (!isOpen) return null

  if (userRole === 'admin') {
    const unreadCount = requests.filter(n => !n.read).length
    const modalContent = (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-violet-100/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Notifications</h2>
                <p className="text-xs sm:text-sm text-gray-600">System updates for admin</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllNotificationsAsRead}
                  className="text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600"></div>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">No notifications</p>
                <p className="text-sm text-gray-500 mt-1">Everything is up to date</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((notification) => (
                  <AdminNotificationItem
                    key={notification._id}
                    notification={notification}
                    onMarkRead={markNotificationAsRead}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )

    return ReactDOM.createPortal(modalContent, document.body)
  }

  // Staff View - Show their own registration status + late arrival requests
  if (userRole === 'staff') {
    const modalContent = (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-violet-100/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Notifications</h2>
                <p className="text-xs sm:text-sm text-gray-600">Your account status & late arrivals</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Account Status Section */}
                {staffStatus && (
                  <>
                    <h3 className="text-sm font-bold text-gray-700 mb-3">Account Status</h3>
                    <div className={`rounded-xl p-5 border-2 ${staffStatus.status === 'approved'
                        ? 'bg-green-50 border-green-300'
                        : staffStatus.status === 'rejected'
                          ? 'bg-red-50 border-red-300'
                          : 'bg-blue-50 border-blue-300'
                      }`}>
                      <div className="flex items-center gap-3 mb-3">
                        {staffStatus.status === 'approved' ? (
                          <CheckCircle className="w-8 h-8 text-green-600" />
                        ) : staffStatus.status === 'rejected' ? (
                          <XCircle className="w-8 h-8 text-red-600" />
                        ) : (
                          <Clock className="w-8 h-8 text-blue-600" />
                        )}
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {staffStatus.status === 'approved'
                              ? 'Account Approved'
                              : staffStatus.status === 'rejected'
                                ? 'Account Rejected'
                                : 'Pending Approval'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {staffStatus.status === 'approved'
                              ? 'Your account has been approved by HOD'
                              : staffStatus.status === 'rejected'
                                ? 'Your registration was not approved'
                                : 'Waiting for HOD approval'}
                          </p>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Department</p>
                          <p className="text-sm font-bold text-gray-900">{staffStatus.department}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Year</p>
                          <p className="text-sm font-bold text-gray-900">{staffStatus.year}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Section</p>
                          <p className="text-sm font-bold text-gray-900">{staffStatus.section}</p>
                        </div>
                      </div>

                      {/* Timestamps */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-600">
                          Requested: {new Date(staffStatus.createdAt).toLocaleDateString()} at{' '}
                          {new Date(staffStatus.createdAt).toLocaleTimeString()}
                        </p>
                        {staffStatus.processedAt && (
                          <p className="text-xs text-gray-600 mt-1">
                            {staffStatus.status === 'approved' ? 'Approved' : 'Rejected'}: {new Date(staffStatus.processedAt).toLocaleDateString()} at{' '}
                            {new Date(staffStatus.processedAt).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Info Message */}
                    {staffStatus.status === 'pending' && (
                      <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                          Your registration is under review. You will be notified once the HOD processes your request.
                        </p>
                      </div>
                    )}
                    {staffStatus.status === 'rejected' && (
                      <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                        <p className="text-sm text-red-800">
                          Please contact your HOD or administrator for more information.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Staff Notifications Section */}
                {staffNotifications.length > 0 && (
                  <>
                    <div className={staffStatus ? "mt-6 pt-4 border-t border-gray-200" : ""}>
                      <h3 className="text-sm font-bold text-gray-700 mb-3">Updates ({staffNotifications.length})</h3>
                      <div className="space-y-3">
                        {staffNotifications.map((notification) => (
                          <NotificationItem
                            key={notification._id}
                            notification={notification}
                            onDismiss={dismissNotificationHandler}
                            onMarkRead={null}
                            showNewBadge={true}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {!staffStatus && requests.length === 0 && staffNotifications.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 font-medium">All set!</p>
                    <p className="text-sm text-gray-500 mt-1">No pending notifications</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )

    return ReactDOM.createPortal(modalContent, document.body)
  }

  // HOD View - Show pending requests from staff
  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-violet-100/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Requests</h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Staff signups & leave/late - {requests.length} pending {requests.length === 1 ? 'request' : 'requests'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                <UserCheck className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">No pending requests</p>
              <p className="text-sm text-gray-500 mt-1">All requests have been processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <HODRequestItem
                  key={request._id}
                  request={request}
                  onApprove={handleApproveHandler}
                  onReject={handleRejectHandler}
                  processing={processing}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const rejectModal = rejectDialog && rejectDialog.open ? (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) closeReject() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Enter rejection reason (optional)</h3>
        <p className="text-sm text-gray-600 mb-3">This will be sent to the student/parent as a plain text message.</p>
        <textarea
          value={rejectDialog.reason}
          onChange={(e) => setRejectDialog(d => ({ ...d, reason: e.target.value }))}
          rows={4}
          placeholder="Reason for rejection (optional)"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:outline-none mb-4"
        />
        <div className="flex justify-end gap-3">
          <button onClick={closeReject} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold">Cancel</button>
          <button
            onClick={confirmReject}
            disabled={processing === (rejectDialog.request && rejectDialog.request._id)}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            {processing === (rejectDialog.request && rejectDialog.request._id) ? 'Processing…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return ReactDOM.createPortal(<>{modalContent}{rejectModal}</>, document.body)
}
