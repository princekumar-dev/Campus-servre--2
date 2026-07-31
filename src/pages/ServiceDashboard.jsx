import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, MapPin, Wrench } from 'lucide-react'
import apiClient from '../utils/apiClient'
import { useAlert } from '../components/AlertContext'

export default function ServiceDashboard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const { showError } = useAlert()

  useEffect(() => {
    apiClient.get('/api/service-orders', { cache: false }).then(result => {
      if (!result.success) throw new Error(result.error)
      setOrders(result.data || [])
    }).catch(error => showError('Unable to load Service POs', error.message)).finally(() => setLoading(false))
  }, [showError])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-violet-700 to-indigo-950 p-6 text-white shadow-xl">
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-200">Database Service Login</p>
        <h1 className="mt-2 text-3xl font-black">Service Provider Dashboard</h1>
        <p className="mt-2 text-sm text-violet-100">Open scanned service orders, upload repair bills, record costs, and submit completed work.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="font-black text-slate-800">Service Purchase Orders</h2><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{orders.length} orders</span></div>
        {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading service orders…</p> : orders.length === 0 ?
          <div className="py-12 text-center"><ClipboardList className="mx-auto text-slate-300"/><p className="mt-3 text-sm font-semibold text-slate-500">No Service POs are assigned yet.</p></div> :
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {orders.map(order => <Link key={order._id} to={`/service/po/${order._id}?portal=service`} className="rounded-2xl border border-slate-200 p-4 transition hover:border-violet-300 hover:bg-violet-50/40">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-violet-700">{order.poNumber}</p><h3 className="mt-1 font-black text-slate-800">{order.request?.title || order.items?.[0]?.description}</h3></div><Wrench className="text-violet-500" size={20}/></div>
              <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><MapPin size={13}/>{order.request?.location || order.deliveryLocation || 'MSEC Campus'}</p>
              <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{order.serviceExecution?.status?.replaceAll('_', ' ') || 'NOT STARTED'}</span>
            </Link>)}
          </div>}
      </section>
    </div>
  )
}
