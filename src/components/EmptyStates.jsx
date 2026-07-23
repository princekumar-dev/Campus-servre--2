import React from 'react'
import { FileX, Search, AlertCircle, Inbox, CheckCircle } from 'lucide-react'

export function EmptyState({ 
  icon: Icon = Inbox, 
  title, 
  description, 
  actionLabel, 
  onAction,
  illustration = 'inbox'
}) {
  const illustrations = {
    inbox: <Inbox className="w-24 h-24 text-gray-300" />,
    search: <Search className="w-24 h-24 text-gray-300" />,
    error: <AlertCircle className="w-24 h-24 text-gray-300" />,
    success: <CheckCircle className="w-24 h-24 text-green-300" />,
    empty: <FileX className="w-24 h-24 text-gray-300" />
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="mb-6 opacity-50">
        {Icon ? <Icon className="w-24 h-24 text-gray-300" /> : illustrations[illustration]}
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
        {title}
      </h3>
      
      {description && (
        <p className="text-gray-600 text-center max-w-md mb-6">
          {description}
        </p>
      )}
      
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 active:bg-yellow-700 font-semibold transition-colors shadow-md hover:shadow-lg"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function NoRequests({ onCreate }) {
  return (
    <EmptyState
      illustration="empty"
      title="No Service Requests"
      description="No service requests found. Create a new request to get started."
      actionLabel="New Request"
      onAction={onCreate}
    />
  )
}

export function NoSearchResults({ query, onClear }) {
  return (
    <EmptyState
      illustration="search"
      title="No Results Found"
      description={`No results for "${query}". Try different search terms.`}
      actionLabel="Clear Search"
      onAction={onClear}
    />
  )
}

export function NoPendingApprovals() {
  return (
    <EmptyState
      illustration="success"
      title="All Caught Up!"
      description="No pending approvals at the moment."
    />
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <EmptyState
      illustration="error"
      title="Something Went Wrong"
      description={message || "An error occurred. Please try again."}
      actionLabel="Retry"
      onAction={onRetry}
    />
  )
}
