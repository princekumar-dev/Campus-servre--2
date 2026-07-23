import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { Truck, CheckCircle, XCircle } from 'lucide-react'

export default function ManagerVehicles() {
  const [vehicles, setVehicles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useAlert()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/vendors?subResource=vehicles')
      if (res.success) setVehicles(res.data)
    } catch (err) { showError('Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Vehicles</h1>
        <p className="text-xs text-slate-500 mt-1">Manage registered delivery vehicles</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No vehicles registered</p>
        </div>
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Vehicle Number</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles.map(v => (
                  <tr key={v._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-violet-600">{v.vehicleNumber}</td>
                    <td className="px-5 py-4 text-xs text-slate-600">{v.vehicleType}</td>
                    <td className="px-5 py-4">
                      <span className={`flex items-center gap-1 text-xs font-bold ${v.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {v.status === 'ACTIVE' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
