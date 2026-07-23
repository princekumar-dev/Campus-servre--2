import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] text-center px-4 relative">
      <div className="absolute top-1/4 left-1/4 h-72 w-72 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="glass-card-purple z-10 w-full max-w-md rounded-2xl border border-violet-500/20 p-5 sm:p-8">
        <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-500 mb-2">
          404
        </h1>
        <h2 className="text-xl font-bold text-white mb-2">Page Not Found</h2>
        <p className="text-sm text-slate-400 mb-6">
          The requested page does not exist or was moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            to="/dashboard"
            className="purple-glow-btn w-full py-2.5 px-4 text-sm font-semibold flex items-center justify-center"
          >
            Go to Dashboard
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="w-full py-2.5 px-4 rounded-xl border border-violet-900/30 text-slate-300 hover:bg-violet-950/20 text-sm font-semibold transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotFound
