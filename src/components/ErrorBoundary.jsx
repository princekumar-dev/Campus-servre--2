import React from 'react'

const RECOVERY_KEY = 'campusserve-deployment-recovery'

async function reloadFresh() {
  try {
    if ('caches' in window) {
      const names = await window.caches.keys()
      await Promise.all(names.map(name => window.caches.delete(name)))
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(registration => registration.update().catch(() => null)))
    }
  } finally {
    const url = new URL(window.location.href)
    url.searchParams.set('_deployment', Date.now().toString())
    window.location.replace(url.toString())
  }
}

function isDeploymentAssetError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return ['chunkloaderror', 'loading chunk', 'dynamically imported module', 'module script', 'failed to fetch'].some(
    text => message.includes(text)
  )
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    this.setState({
      error: error,
      errorInfo: errorInfo
    })

    // An open tab can briefly reference a removed Vercel chunk after a new
    // deployment. Clear only app caches and retry once to prevent a reload loop.
    if (isDeploymentAssetError(error) && sessionStorage.getItem(RECOVERY_KEY) !== '1') {
      sessionStorage.setItem(RECOVERY_KEY, '1')
      reloadFresh()
    } else {
      sessionStorage.removeItem(RECOVERY_KEY)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md mx-auto text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops! Something went wrong</h1>
            <p className="text-gray-600 mb-4">
              We're sorry, but there was an error loading the application.
            </p>
            <button
              onClick={reloadFresh}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Reload Latest Version
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">Error Details</summary>
                <pre className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded overflow-auto">
                  {this.state.error && this.state.error.toString()}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
