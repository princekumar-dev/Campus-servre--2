import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { Users, Plus, Phone, Shield, CheckCircle, XCircle } from 'lucide-react'

export default function ManagerDeliveryPersons() {
  const [persons, setPersons] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useAlert()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/vendors?subResource=delivery-persons')
      if (res.success) setPersons(res.data)
    } catch (err) { showError('Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Delivery Persons</h1>
          <p className="text-xs text-slate-500 mt-1">Manage delivery representatives</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : persons.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No delivery persons registered</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {persons.map(p => (
            <div key={p._id} className="premium-card p-5 hover:border-violet-200 transition-all">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-violet-50 rounded-xl"><Users size={18} className="text-violet-600" /></div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                  <div className="flex items-center space-x-1 text-xs text-slate-500">
                    <Phone size={10} /><span>{p.phone}</span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <div className="flex items-center space-x-1"><Shield size={10} /><span>{p.idType}: {p.idNumber ? `****${p.idNumber.slice(-4)}` : '—'}</span></div>
                <div className="flex items-center space-x-1"><span className={`font-bold ${p.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'}`}>{p.status}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
