import React from 'react'

// Shared Refresh button used across pages to keep label, spinner, spacing and disabled behavior consistent
export default function RefreshButton({ isLoading = false, onClick = () => {}, className = '', label = 'Refresh', ariaLabel = 'Refresh page content' }) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      aria-label={ariaLabel}
      title={isLoading ? 'Refreshing content…' : ariaLabel}
      className={`group inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:cursor-wait disabled:opacity-60 active:scale-95 sm:px-3.5 ${className}`}
    >
      <svg 
        className={`h-4 w-4 transition-transform duration-500 ${isLoading ? 'animate-spin' : 'group-hover:rotate-180'}`}
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span className="hidden sm:inline">{isLoading ? 'Refreshing…' : label}</span>
    </button>
  )
}
