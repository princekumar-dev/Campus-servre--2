import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Building2, CheckCircle, ClipboardCheck, Package, ShieldCheck } from 'lucide-react'
import apiClient from '../utils/apiClient'
import { useAlert } from '../components/AlertContext'

export default function GatePOVerification() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { showError, showSuccess } = useAlert()
  const [po, setPo] = useState(null)
  const [items, setItems] = useState([])
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [createdGrn, setCreatedGrn] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    apiClient.get(`/api/gate?action=po-details&token=${encodeURIComponent(token)}`, {
      cache: false,
      dedupe: false
    }).then((result) => {
      if (!active) return
      if (!result?.success || String(result.data?._id) !== String(id)) {
        throw new Error('The scanned QR does not match this purchase order')
      }
      setPo(result.data)
      setItems((result.data.items || []).map(item => ({
        poItemId: item.itemId,
        poItemDescription: item.description,
        quantityOrdered: item.quantityOrdered,
        quantityPreviouslyAccepted: item.quantityAccepted || 0,
        quantityRemaining: item.quantityRemaining,
        unit: item.unit,
        quantityDeliveredNow: 0,
        quantityAcceptedNow: 0,
        quantityDamaged: 0,
        quantityRejected: 0
      })))
    }).catch((error) => {
      if (active) showError('QR Verification Failed', error.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [id, token, showError])

  const updateQuantity = (index, field, value) => {
    const quantity = Math.max(0, Number(value || 0))
    setItems(current => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: quantity } : item
    ))
  }

  const validationError = useMemo(() => {
    for (const item of items) {
      if (item.quantityAcceptedNow > item.quantityRemaining) {
        return `${item.poItemDescription}: accepted quantity cannot exceed ${item.quantityRemaining} remaining`
      }
      if (item.quantityAcceptedNow + item.quantityDamaged + item.quantityRejected > item.quantityDeliveredNow) {
        return `${item.poItemDescription}: accepted, damaged and rejected quantities exceed delivered quantity`
      }
    }
    if (!items.some(item => item.quantityDeliveredNow > 0)) return 'Enter at least one delivered quantity'
    return ''
  }, [items])

  const createGrn = async () => {
    if (validationError) return showError('Check Quantities', validationError)
    setSaving(true)
    try {
      const result = await apiClient.post('/api/grn', {
        poId: po._id,
        qrToken: token,
        items,
        remarks: remarks || 'Manually verified at gate from purchase-order QR'
      }, { timeout: 90000 })
      if (!result?.success) throw new Error(result?.error || 'Unable to create GRN')
      setCreatedGrn(result.data)
      showSuccess('GRN Created', `${result.data.grnNumber} is now available in the GRN section`)
    } catch (error) {
      showError('GRN Creation Failed', error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-100 border-t-violet-600" /></div>
  }

  if (!po) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <ShieldCheck className="mx-auto mb-3 text-rose-500" size={36} />
        <h1 className="font-black text-rose-800">Invalid purchase-order QR</h1>
        <p className="mt-2 text-sm text-rose-600">Please scan the QR printed on the current purchase order.</p>
      </div>
    )
  }

  if (createdGrn) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle className="mx-auto mb-4 text-emerald-600" size={48} />
        <h1 className="text-xl font-black text-slate-800">Goods receipt recorded</h1>
        <p className="mt-2 font-mono text-sm font-bold text-violet-700">{createdGrn.grnNumber}</p>
        <p className="mt-2 text-sm text-slate-500">The manager can now review this receipt in the GRN section.</p>
        <button onClick={() => navigate('/gate')} className="mt-6 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700">Return to Gate</button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-700 to-indigo-700 p-5 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0" size={28} />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Secure PO QR verification</p>
            <h1 className="mt-1 text-xl font-black">{po.poNumber}</h1>
            <p className="mt-1 text-sm text-violet-100">Manually verify the delivery and record the actual quantities received.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="premium-card p-5">
          <div className="mb-3 flex items-center gap-2 text-violet-700"><Building2 size={18} /><h2 className="font-black">Vendor details</h2></div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Vendor</dt><dd className="text-right font-bold text-slate-800">{po.vendorName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Email</dt><dd className="text-right font-semibold text-slate-700">{po.vendorEmail || 'Not provided'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">PO status</dt><dd className="font-bold text-emerald-700">{po.status.replace(/_/g, ' ')}</dd></div>
          </dl>
        </div>
        <div className="premium-card p-5">
          <div className="mb-3 flex items-center gap-2 text-violet-700"><Package size={18} /><h2 className="font-black">Delivery details</h2></div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Location</dt><dd className="text-right font-bold text-slate-800">{po.deliveryLocation || po.deliveryAddress}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Expected date</dt><dd className="font-semibold text-slate-700">{po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-IN') : 'Not specified'}</dd></div>
          </dl>
        </div>
      </div>

      <div className="premium-card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="flex items-center gap-2 font-black text-slate-800"><ClipboardCheck size={18} className="text-violet-600" />Manual quantity verification</h2>
          <p className="mt-1 text-xs text-slate-500">Enter the physically delivered, accepted, damaged and rejected quantities.</p>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          {items.map((item, index) => (
            <div key={item.poItemId || index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row">
                <div>
                  <h3 className="font-bold text-slate-800">{item.poItemDescription}</h3>
                  <p className="text-xs text-slate-500">{po.items[index]?.specification || 'No additional specification'}</p>
                </div>
                <div className="text-xs text-slate-500">
                  Ordered <strong>{item.quantityOrdered}</strong> · Previously accepted <strong>{item.quantityPreviouslyAccepted}</strong> · Remaining <strong className="text-amber-700">{item.quantityRemaining} {item.unit}</strong>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['quantityDeliveredNow', 'Delivered', 'text-blue-700'],
                  ['quantityAcceptedNow', 'Accepted', 'text-emerald-700'],
                  ['quantityDamaged', 'Damaged', 'text-amber-700'],
                  ['quantityRejected', 'Rejected', 'text-rose-700']
                ].map(([field, label, color]) => (
                  <label key={field} className={`text-xs font-bold ${color}`}>
                    {label}
                    <input type="number" min="0" step="1" value={item[field]} onChange={event => updateQuantity(index, field, event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-center text-sm font-bold text-slate-800 outline-none focus:border-violet-500" />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="premium-card p-5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Gate verification remarks</label>
        <textarea value={remarks} onChange={event => setRemarks(event.target.value)} rows={3} placeholder="Condition, challan details, shortages, or other verification notes..."
          className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-500" />
        {validationError && <p className="mt-2 text-xs font-semibold text-amber-700">{validationError}</p>}
        <button onClick={createGrn} disabled={saving || Boolean(validationError)}
          className="mt-4 w-full rounded-xl bg-violet-600 py-3 text-sm font-black text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Creating GRN...' : 'Confirm Verification & Create GRN'}
        </button>
      </div>
    </div>
  )
}
