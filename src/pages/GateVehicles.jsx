import { useState, useEffect } from 'react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { Truck, Clock, CheckCircle } from 'lucide-react'

export default function GateVehicles() {
  const [vehicles, setVehicles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useAlert()

  useEffect(() => {
    const fetchVehicles = async () => {
      setIsLoading(true)
      try {
        const res = await apiClient.get('/api/gate?action=vehicles-inside')
        if (res.success) setVehicles(res.data)
      } catch (err) { showError('Error', err.message) }
      finally { setIsLoading(false) }
    }
    fetchVehicles()
  }, [showError])

  const getElapsed = (entryTime) => {
    const diff = Date.now() - new Date(entryTime).getTime()
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Vehicles Inside Campus</h1>
        <p className="text-xs text-slate-500 mt-1">Currently inside vehicles and elapsed time</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No vehicles currently inside</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v, idx) => (
            <div key={idx} className="premium-card p-5 hover:border-amber-200 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-amber-50 rounded-lg"><Truck size={16} className="text-amber-600" /></div>
                  <div>
                    <div className="font-mono text-sm font-bold text-slate-800">{v.actualVehicleNumber || 'Unknown'}</div>
                    <div className="text-xs text-slate-400">{v.poNumber}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 text-amber-600">
                  <Clock size={12} />
                  <span className="text-xs font-bold">{getElapsed(v.entryTime)}</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <div>Person: <strong className="text-slate-700">{v.actualDeliveryPersonName || '—'}</strong></div>
                <div>Entry: {new Date(v.entryTime).toLocaleTimeString('en-IN')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
