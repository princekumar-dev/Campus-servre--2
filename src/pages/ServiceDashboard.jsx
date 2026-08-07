import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, MapPin, Wrench } from 'lucide-react'
import apiClient from '../utils/apiClient'
import { useAlert } from '../components/AlertContext'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyStates'
import PageHeader from '../components/ui/PageHeader'
import RefreshButton from '../components/RefreshButton'

export default function ServiceDashboard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const { showError } = useAlert()

  const fetchOrders = () => {
    setLoading(true)
    setLoadError('')
    apiClient.get('/api/service-orders', { cache: false, dedupe: false }).then(result => {
      if (!result.success) throw new Error(result.error)
      setOrders(Array.isArray(result.data) ? result.data : [])
    }).catch(error => setLoadError(error.message || 'Service purchase orders could not be loaded.')).finally(() => setLoading(false))
  }

  useEffect(() => { fetchOrders() }, [])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader title="Service Provider Dashboard" subtitle="Open service orders, upload repair bills, record costs, and submit completed work." badge="Service Provider" action={<RefreshButton isLoading={loading} onClick={fetchOrders} ariaLabel="Refresh service orders" />} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h2 className="min-w-0 font-black text-slate-800">Service Purchase Orders</h2><span className="shrink-0 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{orders.length} orders</span></div>
        <div className="mt-5">{loading ? <LoadingState label="Loading service purchase orders…" /> : loadError ? <ErrorState message={loadError} onRetry={fetchOrders} /> : orders.length === 0 ?
          <EmptyState icon={ClipboardList} title="No service purchase orders" description="No service work is assigned to this account yet." /> :
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {orders.map(order => <Link key={order._id} to={`/service/po/${order._id}?portal=service`} className="rounded-2xl border border-slate-200 p-4 transition hover:border-violet-300 hover:bg-violet-50/40">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-violet-700">{order.poNumber}</p><h3 className="mt-1 font-black text-slate-800">{order.request?.title || order.items?.[0]?.description}</h3></div><Wrench className="text-violet-500" size={20}/></div>
              <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><MapPin size={13}/>{order.request?.location || order.deliveryLocation || 'MSEC Campus'}</p>
              <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{order.serviceExecution?.status?.replaceAll('_', ' ') || 'NOT STARTED'}</span>
            </Link>)}
          </div>}</div>
      </section>
    </div>
  )
}
