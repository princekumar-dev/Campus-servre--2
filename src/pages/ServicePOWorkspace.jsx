import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, FileText, Plus, Upload, Wrench } from 'lucide-react'
import apiClient from '../utils/apiClient'
import { useAlert } from '../components/AlertContext'
import { getAuthOrNull } from '../utils/auth'

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0))
const categoryLabels = { PARTS: 'Parts', LABOUR: 'Labour', TRANSPORT: 'Transport', TAX: 'Tax', OTHER: 'Other' }

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, url: reader.result, mimeType: file.type, size: file.size })
    reader.onerror = () => reject(new Error('Unable to read the selected file'))
    reader.readAsDataURL(file)
  })
}

export default function ServicePOWorkspace() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const qrToken = searchParams.get('token') || ''
  const currentAuth = getAuthOrNull()
  const { showError, showSuccess } = useAlert()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expense, setExpense] = useState({ category: 'PARTS', description: '', amount: '', bill: null })
  const [summary, setSummary] = useState('')
  const auth = getAuthOrNull()

  const load = async () => {
    try {
      const tokenQuery = qrToken ? `&token=${encodeURIComponent(qrToken)}` : ''
      const result = await apiClient.get(`/api/service-orders?id=${id}${tokenQuery}`, { cache: false })
      if (!result.success) throw new Error(result.error)
      setData(result)
      setSummary(result.data.serviceExecution?.serviceSummary || '')
    } catch (error) {
      if (error?.status === 403) {
        const next = `${window.location.pathname}${window.location.search}`
        window.location.replace(`/login?next=${encodeURIComponent(next)}&portal=service&switch=1`)
        return
      }
      showError('Service PO unavailable', error.message)
    }
    finally { setLoading(false) }
  }
  useEffect(() => {
    if (!qrToken && !currentAuth?.isAuthenticated) {
      const next = `${window.location.pathname}${window.location.search}`
      window.location.replace(`/login?next=${encodeURIComponent(next)}&portal=service`)
      return
    }
    load()
  }, [id, qrToken])

  const run = async (action, payload = {}) => {
    setSaving(true)
    try {
      const result = await apiClient.post(`/api/service-orders?id=${id}&action=${action}`, { ...payload, poId: id, qrToken: qrToken || undefined })
      if (!result.success) throw new Error(result.error)
      setData(current => ({ ...current, data: result.data }))
      showSuccess('Service order updated', action === 'submit' ? 'Repair costs and bills were submitted for review.' : 'Your update was saved.')
      return true
    } catch (error) { showError('Update failed', error.message) }
    finally { setSaving(false) }
    return false
  }

  const total = useMemo(() => (data?.data.serviceExecution?.expenses || []).reduce((sum, item) => sum + Number(item.amount || 0), 0), [data])
  if (loading) return <div className="py-20 text-center text-sm text-slate-500">Opening service workspace…</div>
  if (!data) return <div className="py-20 text-center text-sm text-rose-600">This service order could not be opened.</div>

  const po = data.data
  const execution = po.serviceExecution || {}
  const submitted = ['SUBMITTED', 'COMPLETED'].includes(execution.status)
  const approved = execution.status === 'COMPLETED'
  const canApprove = ['manager', 'admin', 'super_admin'].includes(auth?.role)
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <section className="rounded-3xl bg-gradient-to-br from-violet-700 to-indigo-900 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-200">Service provider workspace</p>
            <h1 className="mt-2 text-2xl font-black">{po.poNumber}</h1>
            <p className="mt-1 text-sm text-violet-100">{data.request?.title || po.items?.[0]?.description}</p></div>
          <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold">{execution.status?.replaceAll('_', ' ') || 'NOT STARTED'}</span>
        </div>
        <div className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-3"><span className="text-violet-200">Service provider</span><p className="mt-1 font-bold">{po.vendorName}</p></div>
          <div className="rounded-2xl bg-white/10 p-3"><span className="text-violet-200">Asset / location</span><p className="mt-1 font-bold">{data.request?.assetCode || 'Asset not specified'} · {data.request?.location}</p></div>
          <div className="rounded-2xl bg-white/10 p-3"><span className="text-violet-200">Recorded cost</span><p className="mt-1 text-lg font-black">{money(total)}</p></div>
        </div>
      </section>

      {!submitted && execution.status === 'NOT_STARTED' && <button disabled={saving} onClick={() => run('start')}
        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white"><Wrench size={17}/> Start service work</button>}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-800">Repair costs and scanned bills</h2>
          <p className="mt-1 text-xs text-slate-500">Record every parts, labour, transport, tax, or other charge separately.</p>
          {!submitted && <div className="mt-5 grid gap-3">
            <select value={expense.category} onChange={e => setExpense(current => ({ ...current, category: e.target.value }))} className="rounded-xl border-slate-200 text-sm">
              <option value="PARTS">Parts</option><option value="LABOUR">Labour</option><option value="TRANSPORT">Transport</option><option value="TAX">Tax</option><option value="OTHER">Other</option>
            </select>
            <input value={expense.description} onChange={e => setExpense(current => ({ ...current, description: e.target.value }))} placeholder="Cost description (optional)" className="rounded-xl border-slate-200 text-sm"/>
            <input type="number" min="0.01" step="0.01" value={expense.amount} onChange={e => setExpense(current => ({ ...current, amount: e.target.value }))} placeholder="Amount (₹)" className="rounded-xl border-slate-200 text-sm"/>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50 p-3 text-xs font-bold text-violet-700">
              <Upload size={16}/>{expense.bill?.name || 'Upload scanned bill (image or PDF)'}
              <input className="hidden" type="file" accept="image/*,.pdf" onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const bill = await readFile(file)
                  setExpense(current => ({ ...current, bill }))
                } catch (error) { showError('Bill upload failed', error.message) }
              }}/>
            </label>
            {expense.bill && <p className="text-xs font-semibold text-emerald-700">Bill selected. Tap “Add cost and bill” to save it with the amount.</p>}
            <button type="button" disabled={saving} onClick={async () => {
              const amount = Number(expense.amount)
              if (!Number.isFinite(amount) || amount <= 0) {
                showError('Cost required', 'Enter a cost greater than ₹0.')
                return
              }
              if (!expense.bill?.url) {
                showError('Scanned bill required', 'Choose a bill image or PDF before adding this cost.')
                return
              }
              const payload = {
                ...expense,
                description: expense.description.trim() || categoryLabels[expense.category] || 'Service cost'
              }
              if (await run('expense', payload)) setExpense({ category: 'PARTS', description: '', amount: '', bill: null })
            }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"><Plus size={16}/> Add cost and bill</button>
          </div>}
          <div className="mt-5 space-y-2">
            {(execution.expenses || []).map((item, index) => <div key={item._id || index} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <div><p className="text-sm font-bold text-slate-800">{item.description}</p><p className="text-xs text-slate-500">{item.category} · {item.bill?.name}</p></div>
              <span className="text-sm font-black">{money(item.amount)}</span>
            </div>)}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-800">Work evidence and completion</h2>
          <p className="mt-1 text-xs text-slate-500">Upload repaired-asset photos, job sheets, or service reports.</p>
          {!submitted && <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-5 text-xs font-bold text-slate-600">
            <FileText size={17}/> Upload work evidence
            <input className="hidden" type="file" accept="image/*,.pdf" onChange={async e => {
              if (e.target.files[0]) await run('evidence', { file: await readFile(e.target.files[0]) })
            }}/>
          </label>}
          <p className="mt-3 text-xs font-semibold text-slate-500">{execution.workEvidence?.length || 0} evidence file(s) uploaded</p>
          <textarea disabled={submitted} rows="5" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Describe the fault found, repair completed, and final condition…" className="mt-5 w-full rounded-xl border-slate-200 text-sm"/>
          {!submitted ? <button disabled={saving} onClick={() => run('submit', { serviceSummary: summary })} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"><CheckCircle2 size={17}/> Submit completed service</button>
            : <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{approved ? 'Service approved and the final GRN has been generated.' : 'Service records submitted for campus review.'}</div>
                {canApprove && !approved && <button disabled={saving} onClick={() => run('approve-grn')} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white"><CheckCircle2 size={17}/> Approve service and generate final GRN</button>}
              </div>}
        </section>
      </div>
    </div>
  )
}
