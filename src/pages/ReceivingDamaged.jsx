import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { AlertTriangle, Search } from 'lucide-react'

export default function ReceivingDamaged() {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const { showError } = useAlert()

  const fetchDamaged = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/api/grn?grnType=REJECTION')
      if (res.success) {
        const damaged = res.data.flatMap(grn => (grn.items || []).filter(i => i.quantityDamaged > 0).map(item => ({ ...item, grnNumber: grn.grnNumber, poNumber: grn.poNumber })))
        setItems(damaged)
      }
    } catch (err) { showError('Error', err.message) }
    finally { setIsLoading(false) }
  }, [showError])

  useEffect(() => { fetchDamaged() }, [fetchDamaged])

  const filtered = items.filter(i => !searchQuery || i.poItemDescription?.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight text-slate-800">Damaged Goods</h1>
        <p className="text-xs text-slate-500 mt-1">Items reported as damaged during receiving</p>
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs focus:outline-none focus:border-violet-500 transition-all shadow-sm" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <AlertTriangle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No damaged items found</p>
        </div>
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Item</th>
                  <th className="px-5 py-3">GRN</th>
                  <th className="px-5 py-3">PO</th>
                  <th className="px-5 py-3 text-center">Damaged Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 text-xs font-semibold text-slate-800">{item.poItemDescription}</td>
                    <td className="px-5 py-4 font-mono text-xs text-violet-600">{item.grnNumber}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">{item.poNumber}</td>
                    <td className="px-5 py-4 text-center"><span className="text-sm font-bold text-rose-600">{item.quantityDamaged}</span></td>
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
