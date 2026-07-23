import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { ChevronRight, ArrowLeft, PenTool, Loader2, CheckCircle2, AlertTriangle, ImagePlus, Package, X, FileText, MapPin, Camera, Send } from 'lucide-react'

const categories = [
  { value: 'Classroom Equipment', icon: '🖥️', desc: 'Projectors, screens, speakers' },
  { value: 'Electrical & Lights', icon: '💡', desc: 'Wiring, switches, lighting' },
  { value: 'Plumbing & Water', icon: '🔧', desc: 'Pipes, taps, drainage' },
  { value: 'HVAC & A/C', icon: '❄️', desc: 'Air conditioning, ventilation' },
  { value: 'IT Hardware & Network', icon: '🌐', desc: 'Computers, network, printers' },
  { value: 'Furniture Repair', icon: '🪑', desc: 'Desks, chairs, fixtures' },
  { value: 'Civil & Painting', icon: '🎨', desc: 'Walls, floors, structures' },
]

const priorities = [
  { value: 'LOW', label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-200', activeColor: 'bg-slate-600 text-white', desc: 'General maintenance' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-50 text-blue-600 border-blue-200', activeColor: 'bg-blue-600 text-white', desc: 'Within 48 hours' },
  { value: 'HIGH', label: 'High', color: 'bg-amber-50 text-amber-600 border-amber-200', activeColor: 'bg-amber-600 text-white', desc: 'Impacts operations' },
  { value: 'EMERGENCY', label: 'Emergency', color: 'bg-rose-50 text-rose-600 border-rose-200', activeColor: 'bg-rose-600 text-white', desc: 'Immediate risk' },
]

function CreateRequest() {
  const [formData, setFormData] = useState({
    title: '', category: 'Classroom Equipment', location: '', assetCode: '',
    priority: 'LOW', emergencyReason: '', requestedItem: '', requestedQuantity: '1', requestedUnit: 'pcs', description: ''
  })
  const [issuePhoto, setIssuePhoto] = useState(null)
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [createdNumber, setCreatedNumber] = useState('')
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const auth = getAuthOrNull()
  const alert = useAlert()

  const descMaxLength = 1000
  const titleMaxLength = 100
  const maxPhotoSize = 2 * 1024 * 1024

  useEffect(() => {
    if (!isEditing) return
    let active = true
    const loadRequest = async () => {
      setIsLoading(true)
      try {
        const res = await apiClient.get(`/api/requests?id=${id}`, { cache: false })
        if (!active || !res?.success) return
        const request = res.data
        if (String(request.requesterId) !== String(auth?.id)) {
          alert.showError('Editing not allowed', 'Only the original requester can edit this request.')
          navigate(`/requests/${id}`, { replace: true })
          return
        }
        const submittedAt = request.submittedAt || request.createdAt
        const canEdit = ['DRAFT', 'CLARIFICATION_REQUIRED'].includes(request.status) ||
          (request.status === 'SUBMITTED' && Date.now() - new Date(submittedAt).getTime() <= 24 * 60 * 60 * 1000)
        if (!canEdit) {
          alert.showError('Editing period ended', 'Submitted requests can only be edited within 24 hours.')
          navigate(`/requests/${id}`, { replace: true })
          return
        }
        setFormData(prev => ({
          ...prev,
          title: request.title || '', category: request.category || 'Classroom Equipment',
          location: request.location || '', assetCode: request.assetCode || '', priority: request.priority || 'LOW',
          emergencyReason: request.emergencyReason || '', requestedItem: request.requestedItem || '',
          requestedQuantity: String(request.requestedQuantity || 1), requestedUnit: request.requestedUnit || 'pcs',
          description: request.description || ''
        }))
        const photo = request.evidence?.find(item => item.kind === 'ISSUE_PHOTO' && item.url?.startsWith('data:image/'))
        if (photo) setIssuePhoto({ name: photo.name, dataUrl: photo.url })
      } catch (err) {
        alert.showError('Load Error', err.message || 'Could not load this request')
        navigate('/requests', { replace: true })
      } finally {
        if (active) setIsLoading(false)
      }
    }
    loadRequest()
    return () => { active = false }
  }, [id, isEditing, navigate])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    if (name === 'description' && value.length > descMaxLength) return
    if (name === 'title' && value.length > titleMaxLength) return
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors(prev => ({ ...prev, issuePhoto: 'Use a JPG, PNG, or WebP image' }))
      return
    }
    if (file.size > maxPhotoSize) {
      setErrors(prev => ({ ...prev, issuePhoto: 'Photo must be 2 MB or smaller' }))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setIssuePhoto({ name: file.name, dataUrl: reader.result })
      setErrors(prev => ({ ...prev, issuePhoto: '' }))
    }
    reader.onerror = () => setErrors(prev => ({ ...prev, issuePhoto: 'Could not read this photo' }))
    reader.readAsDataURL(file)
  }

  const validate = () => {
    const errs = {}
    if (!formData.title.trim()) errs.title = 'Title is required'
    if (!formData.location.trim()) errs.location = 'Location is required'
    if (!formData.requestedItem.trim()) errs.requestedItem = 'Required item or service is required'
    if (!Number.isInteger(Number(formData.requestedQuantity)) || Number(formData.requestedQuantity) < 1) errs.requestedQuantity = 'Enter a quantity of 1 or more'
    if (!formData.description.trim()) errs.description = 'Description is required'
    if (formData.description.trim().length < 10) errs.description = 'Description must be at least 10 characters'
    if (formData.priority === 'EMERGENCY' && !formData.emergencyReason.trim()) errs.emergencyReason = 'Emergency reason is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (submitImmediately) => {
    if (!validate()) return

    setIsLoading(true)
    try {
      const evidence = issuePhoto ? [{
        name: issuePhoto.name,
        url: issuePhoto.dataUrl,
        kind: 'ISSUE_PHOTO',
        note: 'Attached when the request was created'
      }] : []
      const payload = { ...formData, requestedQuantity: Number(formData.requestedQuantity), evidence, submitImmediately }
      const res = isEditing
        ? await apiClient.patch(`/api/requests?id=${id}`, payload)
        : await apiClient.post('/api/requests', payload)
      if (res.success) {
        if (issuePhoto && !res.data.evidence?.some(item => item.kind === 'ISSUE_PHOTO')) {
          alert.showError('Photo was not saved', 'The request was saved, but its photo attachment is missing. Please open the request and attach the photo again.')
          navigate(`/requests/${res.data._id}`, { replace: true })
          return
        }
        setCreatedNumber(res.data.requestNumber)
        setShowSuccess(true)
        setTimeout(() => navigate(isEditing ? `/requests/${id}` : '/requests'), 2000)
      } else {
        alert.showError('Failed', res.error || 'Could not submit request')
      }
    } catch (err) {
      alert.showError('Error', err.message || 'Server error')
    } finally {
      setIsLoading(false)
    }
  }

  if (showSuccess) {
    return (
      <div className="max-w-md mx-auto text-center py-20 animate-scaleIn">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-emerald-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">{isEditing ? 'Request Updated!' : 'Request Created!'}</h2>
        <p className="text-sm text-slate-500 mb-1">{isEditing ? 'Your changes have been saved.' : 'Your service ticket has been submitted.'}</p>
        <p className="text-lg font-mono font-bold text-violet-600">{createdNumber}</p>
        <p className="text-xs text-slate-400 mt-4">Redirecting to requests...</p>
      </div>
    )
  }

  const getSelectedCategory = () => categories.find(c => c.value === formData.category)
  const getSelectedPriority = () => priorities.find(p => p.value === formData.priority)

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 lg:max-w-5xl">
      {/* Back */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 font-semibold transition-all">
          <ArrowLeft size={16} /> Back
        </button>
        <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">{isEditing ? 'Edit Request' : 'New Request'}</span>
      </div>

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:space-y-6 sm:p-8 lg:p-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-violet-50 rounded-xl text-violet-600">
            <PenTool size={20} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-800">{isEditing ? 'Edit Intent Request' : 'Submit an Intent Request'}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{isEditing ? 'Update the request within the 24-hour editing period' : 'Tell us what is needed; the admin will decide whether it needs service, replacement, or a new purchase.'}</p>
          </div>
        </div>

        {!isEditing && (
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-violet-100 bg-violet-50/50 p-3 sm:grid-cols-4 sm:p-4">
            {[
              [FileText, '1. Describe', 'Title and details'],
              [Package, '2. Specify', 'Item and quantity'],
              [Camera, '3. Show', 'Optional issue photo'],
              [Send, '4. Submit', 'Track in My Requests'],
            ].map(([Icon, title, text]) => (
              <div key={title} className="flex items-start gap-2 rounded-xl bg-white p-2.5 shadow-sm">
                <span className="rounded-lg bg-violet-100 p-1.5 text-violet-700"><Icon size={14} /></span>
                <span><span className="block text-[11px] font-extrabold text-slate-800">{title}</span><span className="mt-0.5 block text-[10px] text-slate-400">{text}</span></span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-5 text-left">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3"><FileText size={16} className="text-violet-600" /><h2 className="text-sm font-extrabold text-slate-800">What do you need?</h2></div>
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Title <span className="text-rose-400">*</span>
            </label>
            <input type="text" name="title" placeholder="e.g. Projector not displaying in Room 302" value={formData.title} onChange={handleInputChange}
              className={`w-full bg-slate-50 border rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all ${errors.title ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-200 focus:border-violet-500 focus:bg-white'}`} />
            <div className="flex justify-between mt-1">
              {errors.title && <span className="text-xs text-rose-500 font-semibold flex items-center gap-1"><AlertTriangle size={10} />{errors.title}</span>}
              <span className="text-xs text-slate-400 ml-auto">{formData.title.length}/{titleMaxLength}</span>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Category <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 lg:gap-3">
              {categories.map(cat => (
                <button key={cat.value} type="button" onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                  className={`min-h-[104px] p-3 rounded-xl border text-left transition-all lg:p-4 ${
                    formData.category === cat.value
                      ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}>
                  <span className="text-lg block mb-1">{cat.icon}</span>
                  <span className="text-xs font-bold text-slate-700 block leading-tight">{cat.value}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{cat.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Location + Asset */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 pt-1"><MapPin size={16} className="text-violet-600" /><h2 className="text-sm font-extrabold text-slate-800">Where is it needed?</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Location <span className="text-rose-400">*</span>
              </label>
              <input type="text" name="location" placeholder="e.g. Main Block - Room 302" value={formData.location} onChange={handleInputChange}
                className={`w-full bg-slate-50 border rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all ${errors.location ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-200 focus:border-violet-500 focus:bg-white'}`} />
              {errors.location && <span className="text-xs text-rose-500 font-semibold mt-1 flex items-center gap-1"><AlertTriangle size={10} />{errors.location}</span>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Asset Code</label>
              <input type="text" name="assetCode" placeholder="e.g. PROJ-MB-302" value={formData.assetCode} onChange={handleInputChange}
                className="w-full bg-slate-50 border border-slate-200 focus:border-violet-500 focus:bg-white rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all" />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Priority</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {priorities.map(p => (
                <button key={p.value} type="button" onClick={() => setFormData(prev => ({ ...prev, priority: p.value }))}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    formData.priority === p.value ? p.activeColor + ' border-transparent shadow-md' : p.color + ' hover:shadow-sm'
                  }`}>
                  <span className="text-xs font-bold block">{p.label}</span>
                  <span className={`text-[11px] block mt-0.5 ${formData.priority === p.value ? 'text-white/80' : 'text-slate-400'}`}>{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Requirement details */}
          <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-xl bg-white p-2 text-violet-600 shadow-sm"><Package size={18} /></div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-800">Requirement details</h2>
                <p className="mt-0.5 text-xs text-slate-500">Tell the maintenance team exactly what item or service is needed.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Item / service needed <span className="text-rose-400">*</span></label>
                <input type="text" name="requestedItem" placeholder="e.g. LED tube light, projector repair" value={formData.requestedItem} onChange={handleInputChange}
                  className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-1 ${errors.requestedItem ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500'}`} />
                {errors.requestedItem && <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-rose-500"><AlertTriangle size={10} />{errors.requestedItem}</span>}
              </div>
              <div className="sm:col-span-1">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Quantity <span className="text-rose-400">*</span></label>
                <input type="number" name="requestedQuantity" min="1" step="1" value={formData.requestedQuantity} onChange={handleInputChange}
                  className={`w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:ring-1 ${errors.requestedQuantity ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500'}`} />
                {errors.requestedQuantity && <span className="mt-1 block text-xs font-semibold text-rose-500">{errors.requestedQuantity}</span>}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Unit</label>
                <select name="requestedUnit" value={formData.requestedUnit} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500">
                  <option value="pcs">Pieces</option><option value="sets">Sets</option><option value="units">Units</option><option value="boxes">Boxes</option><option value="meters">Meters</option><option value="service">Service</option>
                </select>
              </div>
            </div>
          </div>

          {/* Emergency Reason */}
          {formData.priority === 'EMERGENCY' && (
            <div className="animate-slideUp">
              <label className="block text-xs font-bold text-rose-500 uppercase tracking-wider mb-2">
                Emergency Reason <span className="text-rose-400">*</span>
              </label>
              <input type="text" name="emergencyReason" placeholder="Why is this an emergency?" value={formData.emergencyReason} onChange={handleInputChange}
                className={`w-full bg-rose-50 border rounded-xl py-3 px-4 text-rose-800 placeholder-rose-400 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all ${errors.emergencyReason ? 'border-rose-400' : 'border-rose-200 focus:border-rose-500'}`} />
              {errors.emergencyReason && <span className="text-xs text-rose-500 font-semibold mt-1 flex items-center gap-1"><AlertTriangle size={10} />{errors.emergencyReason}</span>}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Description <span className="text-rose-400">*</span>
            </label>
            <textarea name="description" rows={5} placeholder="Describe the issue in detail..." value={formData.description} onChange={handleInputChange}
              className={`w-full bg-slate-50 border rounded-xl py-3 px-4 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all resize-none ${errors.description ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-200 focus:border-violet-500 focus:bg-white'}`} />
            <div className="flex justify-between mt-1">
              {errors.description && <span className="text-xs text-rose-500 font-semibold flex items-center gap-1"><AlertTriangle size={10} />{errors.description}</span>}
              <span className={`text-xs ml-auto ${formData.description.length > descMaxLength * 0.9 ? 'text-amber-500' : 'text-slate-400'}`}>
                {formData.description.length}/{descMaxLength}
              </span>
            </div>
          </div>

          {/* Optional issue photo */}
          <div>
            <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3"><Camera size={16} className="text-violet-600" /><h2 className="text-sm font-extrabold text-slate-800">Add visual proof <span className="font-medium text-slate-400">(optional)</span></h2></div>
            {issuePhoto ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <img src={issuePhoto.dataUrl} alt="Selected issue evidence" className="h-16 w-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-700">{issuePhoto.name}</p><p className="mt-0.5 text-xs text-emerald-700">Ready to attach as issue proof</p></div>
                <button type="button" onClick={() => setIssuePhoto(null)} aria-label="Remove selected photo" className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-rose-600"><X size={17} /></button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center transition-all hover:border-violet-300 hover:bg-violet-50/40">
                <ImagePlus size={22} className="text-violet-500" />
                <span className="mt-2 text-sm font-bold text-slate-700">Add a photo of the issue</span>
                <span className="mt-0.5 text-xs text-slate-400">JPG, PNG or WebP · up to 2 MB</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="sr-only" />
              </label>
            )}
            {errors.issuePhoto && <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-rose-500"><AlertTriangle size={10} />{errors.issuePhoto}</span>}
          </div>

          {/* Priority Preview */}
          {formData.priority === 'EMERGENCY' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
              <AlertTriangle size={14} />
              <span className="font-semibold">Emergency requests are escalated immediately and bypass normal queue.</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200">
            {!isEditing && <p className="w-full text-xs leading-relaxed text-slate-500 sm:mr-auto sm:max-w-md">After submission, you can track, delete, or edit this request for 24 hours from <strong>My Requests</strong>.</p>}
            <button type="button" disabled={isLoading} onClick={() => handleSubmit(true)}
              className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-sm shadow-violet-600/10 disabled:opacity-50">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><span>{isEditing ? 'Save Changes' : 'Submit Intent Request'}</span><ChevronRight size={15} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateRequest
