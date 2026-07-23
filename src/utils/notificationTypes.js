/**
 * Notification Type Constants and Configuration
 * Defines styling, behavior, and categorization for all notification types
 */

export const NOTIFICATION_TYPES = {
  // Account-related (auto-dismiss after 5 seconds)
  ACCOUNT_CREATED: 'account_created',
  ACCOUNT_UPDATED: 'account_updated',
  PASSWORD_UPDATED: 'password_updated',
  ACCOUNT_APPROVED: 'staff_account_approved',
  ACCOUNT_REJECTED: 'staff_account_rejected',
  ACCOUNT_STATUS: 'staff_account_status',

  // Staff account approval requests (for admin)
  STAFF_ACCOUNT_APPROVAL: 'staff_account_approval',

  // Service request notifications
  SERVICE_REQUEST: 'service_request',
  QUOTATION_UPDATE: 'quotation_update',
  WORK_ORDER_UPDATE: 'work_order_update',
  INVOICE_UPDATE: 'invoice_update',

  // System
  SYSTEM: 'system'
}

export const NOTIFICATION_CONFIG = {
  // Account creation/update notifications
  [NOTIFICATION_TYPES.ACCOUNT_CREATED]: {
    category: 'account',
    autoDismiss: 5000, // 5 seconds
    icon: '✨',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    badgeLabel: 'Account Created',
    titleClass: 'text-green-900',
    bodyClass: 'text-green-800',
    dismissable: true,
    hideNewBadge: false
  },
  [NOTIFICATION_TYPES.ACCOUNT_UPDATED]: {
    category: 'account',
    autoDismiss: 5000,
    icon: '⚙️',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    badgeLabel: 'Account Updated',
    titleClass: 'text-blue-900',
    bodyClass: 'text-blue-800',
    dismissable: true,
    hideNewBadge: false
  },
  [NOTIFICATION_TYPES.PASSWORD_UPDATED]: {
    category: 'account',
    autoDismiss: 5000,
    icon: '🔐',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
    badgeLabel: 'Password Updated',
    titleClass: 'text-purple-900',
    bodyClass: 'text-purple-800',
    dismissable: true,
    hideNewBadge: false
  },
  [NOTIFICATION_TYPES.ACCOUNT_APPROVED]: {
    category: 'account',
    autoDismiss: 6000,
    icon: '✅',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    badgeLabel: 'Approved',
    titleClass: 'text-emerald-900',
    bodyClass: 'text-emerald-800',
    dismissable: true,
    hideNewBadge: false
  },
  [NOTIFICATION_TYPES.ACCOUNT_REJECTED]: {
    category: 'account',
    autoDismiss: 8000,
    icon: '❌',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    badgeLabel: 'Rejected',
    titleClass: 'text-red-900',
    bodyClass: 'text-red-800',
    dismissable: true,
    hideNewBadge: false
  },
  [NOTIFICATION_TYPES.ACCOUNT_STATUS]: {
    category: 'account',
    autoDismiss: 0,
    icon: '📋',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    badgeLabel: 'Status',
    titleClass: 'text-amber-900',
    bodyClass: 'text-amber-800',
    dismissable: true,
    hideNewBadge: false
  },

  // Staff account approval request (for admin)
  [NOTIFICATION_TYPES.STAFF_ACCOUNT_APPROVAL]: {
    category: 'staff-request',
    autoDismiss: 0,
    icon: '👤',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-300',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-700',
    badgeLabel: 'Staff Account Request',
    titleClass: 'text-indigo-900',
    bodyClass: 'text-indigo-800',
    dismissable: false,
    hideNewBadge: true,
    requiresAction: true
  },

  // Service request notifications
  [NOTIFICATION_TYPES.SERVICE_REQUEST]: {
    category: 'service',
    autoDismiss: 0,
    icon: '🔧',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-300',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    badgeLabel: 'Service Request',
    titleClass: 'text-violet-900',
    bodyClass: 'text-violet-800',
    dismissable: true,
    hideNewBadge: false
  },

  [NOTIFICATION_TYPES.QUOTATION_UPDATE]: {
    category: 'service',
    autoDismiss: 0,
    icon: '📋',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    badgeLabel: 'Quotation Update',
    titleClass: 'text-blue-900',
    bodyClass: 'text-blue-800',
    dismissable: true,
    hideNewBadge: false
  },

  [NOTIFICATION_TYPES.WORK_ORDER_UPDATE]: {
    category: 'service',
    autoDismiss: 0,
    icon: '🔨',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    badgeLabel: 'Work Order Update',
    titleClass: 'text-amber-900',
    bodyClass: 'text-amber-800',
    dismissable: true,
    hideNewBadge: false
  },

  [NOTIFICATION_TYPES.INVOICE_UPDATE]: {
    category: 'service',
    autoDismiss: 0,
    icon: '💰',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    badgeLabel: 'Invoice Update',
    titleClass: 'text-emerald-900',
    bodyClass: 'text-emerald-800',
    dismissable: true,
    hideNewBadge: false
  },

  // Default/System
  [NOTIFICATION_TYPES.SYSTEM]: {
    category: 'system',
    autoDismiss: 0,
    icon: '📢',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-700',
    badgeLabel: 'System',
    titleClass: 'text-gray-900',
    bodyClass: 'text-gray-800',
    dismissable: true,
    hideNewBadge: false
  }
}

export const getNotificationConfig = (type) => {
  return NOTIFICATION_CONFIG[type] || NOTIFICATION_CONFIG[NOTIFICATION_TYPES.SYSTEM]
}

export const getCategoryLabel = (category) => {
  const labels = {
    'account': 'Account Settings',
    'staff-request': 'Staff Requests',
    'service': 'Service Updates',
    'system': 'System'
  }
  return labels[category] || 'Notifications'
}

export const groupNotificationsByCategory = (notifications) => {
  const grouped = {}

  notifications.forEach(notif => {
    const config = getNotificationConfig(notif.type)
    const category = config.category

    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(notif)
  })

  return grouped
}

export const shouldAutoDismiss = (type) => {
  const config = getNotificationConfig(type)
  return config.autoDismiss > 0
}

export const getAutoDismissDelay = (type) => {
  const config = getNotificationConfig(type)
  return config.autoDismiss
}

export const isAccountNotification = (type) => {
  return getNotificationConfig(type).category === 'account'
}
