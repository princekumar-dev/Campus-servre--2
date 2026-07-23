import { useState, useEffect, memo, useMemo } from 'react'
import { X, Trash2, Clock, AlertCircle, CheckCircle2, Calendar } from 'lucide-react'
import SwipeableCard from './SwipeableCard'
import { getNotificationConfig } from '../utils/notificationTypes'

/**
 * Generic Notification Item Component
 * Handles styling, auto-dismiss, and delete for all notification types
 */
export const NotificationItem = memo(({ 
  notification, 
  onDismiss, 
  onMarkRead, 
  showNewBadge = true 
}) => {
  const [shouldDelete, setShouldDelete] = useState(false)
  const config = getNotificationConfig(notification.type)

  const handleDelete = () => {
    setShouldDelete(true)
    onDismiss(notification)
  }

  const handleMarkRead = () => {
    onMarkRead?.(notification._id)
  }

  // Swipe actions for mobile - must be before early return
  const swipeActions = useMemo(() => [
    {
      label: 'Delete',
      icon: <Trash2 className="w-5 h-5" />,
      onClick: handleDelete,
      className: 'bg-red-500 hover:bg-red-600 text-white',
      direction: 'right',
      autoTrigger: true
    }
  ], [handleDelete])

  // Auto-dismiss timer
  useEffect(() => {
    if (config.autoDismiss > 0 && !notification.read) {
      const timer = setTimeout(() => {
        setShouldDelete(true)
        onDismiss(notification)
      }, config.autoDismiss)

      return () => clearTimeout(timer)
    }
  }, [config.autoDismiss, notification, onDismiss])

  if (shouldDelete) return null

  const notificationContent = (
    <div
      className={`border rounded-xl p-4 sm:p-5 transition-all duration-300 relative overflow-hidden ${
        notification.read
          ? `${config.bgColor} ${config.borderColor}`
          : `${config.bgColor} ${config.borderColor} ring-1 ring-offset-1`
      }`}
    >
      {/* Desktop Close Button */}
      <button
        onClick={handleDelete}
        className="hidden sm:flex absolute top-3 right-3 p-2 rounded-lg hover:bg-black/5 transition-colors z-10"
        title="Delete notification"
        aria-label="Delete notification"
      >
        <X className="w-4 h-4 text-gray-500 hover:text-gray-700" />
      </button>

      <div className="flex items-start justify-between gap-3 pr-6 sm:pr-0">
        <div className="flex-1 min-w-0">
          {/* Badge and New indicator */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${config.badgeBg} ${config.badgeText} flex items-center gap-1`}>
              <span>{config.icon}</span>
              <span>{config.badgeLabel}</span>
            </span>
            {!notification.read && showNewBadge && !config.hideNewBadge && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 animate-pulse">
                NEW
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className={`text-sm sm:text-base font-bold break-words ${config.titleClass}`}>
            {notification.title}
          </h3>

          {/* Body */}
          <p className={`text-xs sm:text-sm mt-1 break-words ${config.bodyClass}`}>
            {notification.body}
          </p>

          {/* Timestamp */}
          <p className="text-xs text-gray-500 mt-2">
            {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Just now'}
          </p>
        </div>

        {/* Mobile Delete Button - Visible as fallback (swipe right to reveal fully) */}
        <button
          onClick={handleDelete}
          className="sm:hidden flex-shrink-0 p-2 rounded-lg active:bg-red-100 transition-colors"
          title="Delete notification (or swipe right)"
          aria-label="Delete notification"
        >
          <Trash2 className="w-5 h-5 text-red-500" />
        </button>
      </div>

      {/* Action Buttons for unread notifications */}
      {!notification.read && onMarkRead && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-10 flex justify-end">
          <button
            onClick={handleMarkRead}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              config.category === 'account'
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            Mark as read
          </button>
        </div>
      )}
    </div>
  )

  return (
    <SwipeableCard actions={swipeActions}>
      {notificationContent}
    </SwipeableCard>
  )
})

NotificationItem.displayName = 'NotificationItem'

/**
 * Staff Account Request Item Component
 * For HOD to approve/reject staff account creation requests
 */
export const StaffAccountRequestItem = memo(({ 
  request, 
  onApprove, 
  onReject, 
  processing 
}) => {
  const config = getNotificationConfig(request.type)

  // Swipe actions for mobile
  const swipeActions = useMemo(() => [
    {
      label: 'Reject',
      icon: <X className="w-5 h-5" />,
      onClick: () => onReject(request),
      className: 'bg-red-500 hover:bg-red-600 text-white',
    }
  ], [onReject, request])

  const requestContent = (
    <div className={`border-2 rounded-xl p-4 sm:p-5 transition-all ${config.bgColor} ${config.borderColor} overflow-hidden`}>
      {/* Desktop Close Alternative */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${config.badgeBg} ${config.badgeText} flex items-center gap-1`}>
              <span>{config.icon}</span>
              Staff Account
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">
              PENDING
            </span>
          </div>

          {/* Staff Details */}
          <h3 className={`text-base font-bold break-words ${config.titleClass}`}>
            {request.data?.staffName}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{request.data?.staffEmail}</p>

          {/* Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 py-3 border-t border-b border-current border-opacity-10">
            <div>
              <p className="text-xs text-gray-600 font-semibold">Department</p>
              <p className="text-sm font-bold text-gray-900">{request.data?.department}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">Year</p>
              <p className="text-sm font-bold text-gray-900">{request.data?.year}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">Section</p>
              <p className="text-sm font-bold text-gray-900">{request.data?.section}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">Phone</p>
              <p className="text-sm font-bold text-gray-900">{request.data?.phoneNumber}</p>
            </div>
          </div>

          {/* Timestamp */}
          <p className="text-xs text-gray-500 mt-2">
            Requested: {request.createdAt ? new Date(request.createdAt).toLocaleString() : 'Just now'}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex gap-2 sm:gap-3">
        <button
          onClick={() => onReject(request)}
          disabled={processing === request._id}
          className="flex-1 px-4 py-2 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {processing === request._id ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </>
          ) : (
            '✕ Reject'
          )}
        </button>
        <button
          onClick={() => onApprove(request)}
          disabled={processing === request._id}
          className="flex-1 px-4 py-2 bg-green-100 hover:bg-green-200 disabled:opacity-50 text-green-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {processing === request._id ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </>
          ) : (
            '✓ Approve'
          )}
        </button>
      </div>
    </div>
  )

  return (
    <SwipeableCard actions={swipeActions}>
      {requestContent}
    </SwipeableCard>
  )
})

StaffAccountRequestItem.displayName = 'StaffAccountRequestItem'

/**
 * Late Arrival Request Item Component
 * For staff to confirm late arrivals with countdown timer
 */
export const LateArrivalRequestItem = memo(({ 
  request, 
  onApprove, 
  processing 
}) => {
  const config = getNotificationConfig(request.type)
  const [timeLeft, setTimeLeft] = useState('')
  const [isOverdue, setIsOverdue] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const arrival = new Date(request.data?.expectedArrivalTime)
      const diff = arrival - now

      if (diff <= 0) {
        setIsOverdue(true)
        setTimeLeft('Overdue')
      } else {
        setIsOverdue(false)
        const minutes = Math.floor(diff / 60000)
        const seconds = Math.floor((diff % 60000) / 1000)
        setTimeLeft(`${minutes}m ${seconds}s`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [request.data?.expectedArrivalTime])

  const handleConfirm = () => {
    onApprove(request)
    setShowConfirm(false)
  }

  // Swipe action - approve (right swipe)
  const swipeActions = useMemo(() => [
    {
      label: 'Record',
      icon: <CheckCircle2 className="w-5 h-5" />,
      onClick: handleConfirm,
      className: 'bg-green-600 hover:bg-green-700 text-white',
      direction: 'right',
      autoTrigger: false
    }
  ], [request])

  const requestContent = (
    <div className={`border-2 rounded-xl p-4 sm:p-5 transition-all ${config.bgColor} ${config.borderColor} relative overflow-hidden`}>
      {/* Countdown timer bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${isOverdue ? 'bg-red-500' : 'bg-amber-400'} transition-colors`}></div>

      <div className="flex items-start justify-between gap-3">
        {/* Student Avatar */}
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
          {request.data?.studentName?.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          {/* Badge and Status */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${config.badgeBg} ${config.badgeText} flex items-center gap-1`}>
              <span>{config.icon}</span>
              Late Arrival
            </span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
              isOverdue 
                ? 'bg-red-100 text-red-700' 
                : 'bg-amber-100 text-amber-700 animate-pulse'
            }`}>
              <AlertCircle className="w-3 h-3" />
              {isOverdue ? 'OVERDUE' : 'ACTION NEEDED'}
            </span>
          </div>

          {/* Student Name and Reg */}
          <h3 className={`text-base font-bold break-words ${config.titleClass}`}>
            {request.data?.studentName}
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">📋 {request.data?.regNumber}</p>

          {/* Countdown Timer - Prominent */}
          <div className="mt-3 p-2.5 bg-white/50 backdrop-blur rounded-lg border border-amber-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">Expected Arrival:</span>
              <span className={`text-sm font-bold font-mono flex items-center gap-1 ${
                isOverdue ? 'text-red-600' : 'text-amber-600'
              }`}>
                <Clock className="w-4 h-4" />
                {timeLeft}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {new Date(request.data?.expectedArrivalTime).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit'
              })}
            </p>
          </div>

          {/* Reason */}
          <div className="mt-2.5">
            <p className="text-xs text-gray-600 font-semibold mb-1">Reason</p>
            <p className="text-sm text-gray-900 bg-white/40 p-2 rounded border border-gray-200">
              "{request.data?.reason}"
            </p>
          </div>

          {/* Year/Section Info */}
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <div className="text-xs">
              <p className="text-gray-600 font-semibold">Year</p>
              <p className="font-bold text-gray-900">{request.data?.year}</p>
            </div>
            <div className="text-xs">
              <p className="text-gray-600 font-semibold">Section</p>
              <p className="font-bold text-gray-900">{request.data?.section}</p>
            </div>
          </div>

          {/* Info message */}
          <p className="text-xs text-blue-600 mt-2.5 font-medium flex items-center gap-1">
            <span>ℹ️</span> Confirm your arrival when you reach campus
          </p>

          {/* Timestamp */}
          <p className="text-xs text-gray-500 mt-2">
            {request.createdAt ? new Date(request.createdAt).toLocaleString() : 'Just now'}
          </p>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-semibold text-gray-900 mb-3">Confirm arrival recording?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={processing === request._id}
              className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded transition-colors text-sm flex items-center justify-center gap-2"
            >
              {processing === request._id ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                '✓ Confirm'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Action Button */}
      {!showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={processing === request._id}
          className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
        >
          {processing === request._id ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Recording...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              I've Arrived (Record Arrival)
            </>
          )}
        </button>
      )}
    </div>
  )

  return (
    <SwipeableCard actions={swipeActions}>
      {requestContent}
    </SwipeableCard>
  )
})

LateArrivalRequestItem.displayName = 'LateArrivalRequestItem'

/**
 * Leave Request Item Component
 * For HOD to approve/reject leave requests
 */
export const LeaveRequestItem = memo(({ 
  request, 
  onApprove, 
  onReject, 
  processing 
}) => {
  const config = getNotificationConfig(request.type)
  const [showRejectReason, setShowRejectReason] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // Calculate leave duration
  const startDate = new Date(request.data?.startDate)
  const endDate = new Date(request.data?.endDate)
  const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
  const isLongLeave = duration >= 5

  // Get leave type color
  const getLeaveTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'medical':
        return 'from-red-500 to-red-600'
      case 'casual':
        return 'from-blue-500 to-blue-600'
      case 'emergency':
        return 'from-orange-500 to-orange-600'
      default:
        return 'from-purple-500 to-purple-600'
    }
  }

  const handleRejectWithReason = () => {
    // Pass reason with rejection if available
    onReject({ ...request, rejectReason })
    setShowRejectReason(false)
    setRejectReason('')
  }

  // Swipe actions for mobile
  const swipeActions = useMemo(() => [
    {
      label: 'Reject',
      icon: <X className="w-5 h-5" />,
      onClick: () => onReject(request),
      className: 'bg-red-500 hover:bg-red-600 text-white',
    }
  ], [onReject, request])

  const requestContent = (
    <div className={`border-2 rounded-xl p-4 sm:p-5 transition-all ${config.bgColor} ${config.borderColor} relative overflow-hidden`}>
      {/* Leave type gradient accent */}
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${getLeaveTypeColor(request.data?.type)} opacity-5 rounded-full -mr-12 -mt-12`}></div>

      <div className="flex items-start justify-between gap-3 relative z-10">
        {/* Student Avatar */}
        <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
          {request.data?.studentName?.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          {/* Badge and Flags */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${config.badgeBg} ${config.badgeText} flex items-center gap-1`}>
              <span>{config.icon}</span>
              Leave Request
            </span>
            {isLongLeave && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Long Leave ({duration} days)
              </span>
            )}
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">
              PENDING APPROVAL
            </span>
          </div>

          {/* Student Details */}
          <h3 className={`text-base font-bold break-words ${config.titleClass}`}>
            {request.data?.studentName}
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            📋 {request.data?.regNumber} • {request.data?.year} - {request.data?.section}
          </p>

          {/* Leave Type Badge */}
          <div className="mt-2.5 flex items-center gap-2">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${getLeaveTypeColor(request.data?.type)} shadow-md`}>
              {request.data?.type?.replace('_', ' ').toUpperCase()}
            </span>
            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
              📅 {duration} day{duration > 1 ? 's' : ''}
            </span>
          </div>

          {/* Date Range */}
          <div className="mt-3 p-2.5 bg-white/60 backdrop-blur rounded-lg border border-blue-100">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-600 font-semibold mb-0.5">From</p>
                <p className="text-sm font-bold text-gray-900">
                  {startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-semibold mb-0.5">To</p>
                <p className="text-sm font-bold text-gray-900">
                  {endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Reason - Expandable */}
          <div className="mt-2.5">
            <p className="text-xs text-gray-600 font-semibold mb-1.5">Reason</p>
            <p className="text-sm text-gray-900 bg-white/50 p-2.5 rounded-lg border border-gray-200 italic">
              "{request.data?.reason}"
            </p>
          </div>

          {/* Timestamp */}
          <p className="text-xs text-gray-500 mt-2">
            Requested: {request.createdAt ? new Date(request.createdAt).toLocaleString() : 'Just now'}
          </p>
        </div>
      </div>

      {/* Reject Reason Dialog */}
      {showRejectReason && (
        <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-lg relative z-20">
          <p className="text-sm font-semibold text-gray-900 mb-2.5">Why are you rejecting this leave?</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason for rejection (optional)"
            className="w-full text-sm p-2.5 border border-red-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            rows="2"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowRejectReason(false)}
              className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectWithReason}
              disabled={processing === request._id}
              className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded transition-colors text-sm flex items-center justify-center gap-1"
            >
              {processing === request._id ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </>
              ) : (
                '✕ Reject'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!showRejectReason && (
        <div className="mt-4 flex gap-2 sm:gap-3 relative z-10">
          <button
            onClick={() => setShowRejectReason(true)}
            disabled={processing === request._id}
            className="flex-1 px-4 py-3 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 border border-red-300"
          >
            {processing === request._id ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <>
                <X className="w-4 h-4" />
                Reject
              </>
            )}
          </button>
          <button
            onClick={() => onApprove(request)}
            disabled={processing === request._id}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            {processing === request._id ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )

  return (
    <SwipeableCard actions={swipeActions}>
      {requestContent}
    </SwipeableCard>
  )
})

LeaveRequestItem.displayName = 'LeaveRequestItem'
