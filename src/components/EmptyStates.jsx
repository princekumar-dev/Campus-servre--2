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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-14" role={illustration === 'error' ? 'alert' : 'status'}>
      <div className="mb-4 opacity-80">
        {Icon ? <Icon className="h-14 w-14 text-slate-400" /> : illustrations[illustration]}
      </div>
      
      <h3 className="mb-2 text-lg font-extrabold text-slate-800 text-center">
        {title}
      </h3>
      
      {description && (
        <p className="mb-6 max-w-md text-center text-sm font-medium text-slate-600">
          {description}
        </p>
      )}
      
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="min-h-11 rounded-xl bg-violet-600 px-6 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function LoadingState({ label = 'Loading records…' }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/70 px-4 py-14" role="status" aria-live="polite">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-100 border-t-violet-600" />
      <p className="mt-4 text-sm font-bold text-slate-600">{label}</p>
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
