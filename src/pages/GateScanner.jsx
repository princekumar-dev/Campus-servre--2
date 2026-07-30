import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, CheckCircle, History, Keyboard, QrCode, ShieldCheck, XCircle } from 'lucide-react'
import { useAlert } from '../components/AlertContext'
import apiClient from '../utils/apiClient'
import { getGateLocation, locationQuery } from '../utils/gateLocation'

function CameraScanner({ onDetected, ensureLocation }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const frameRef = useRef(null)
  const detectorRef = useRef(null)
  const detectedRef = useRef(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const stopCamera = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }, [])

  useEffect(() => stopCamera, [stopCamera])

  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current || detectedRef.current) return
    try {
      const codes = await detectorRef.current.detect(videoRef.current)
      const value = codes?.[0]?.rawValue
      if (value) {
        detectedRef.current = true
        stopCamera()
        onDetected(value)
        return
      }
    } catch {
      // Camera frames can be temporarily unavailable while the stream starts.
    }
    frameRef.current = requestAnimationFrame(scanFrame)
  }, [onDetected, stopCamera])

  const startCamera = async () => {
    setCameraError('')
    detectedRef.current = false
    if (!navigator.mediaDevices?.getUserMedia) {
      return setCameraError('Camera access is not supported by this browser.')
    }
    if (!('BarcodeDetector' in window)) {
      return setCameraError('Live QR detection is unavailable in this browser. Use Chrome/Edge on mobile or enter the PO number.')
    }
    try {
      await ensureLocation()
      const supported = typeof window.BarcodeDetector.getSupportedFormats === 'function'
        ? await window.BarcodeDetector.getSupportedFormats()
        : ['qr_code']
      if (!supported.includes('qr_code')) throw new Error('QR detection is not supported')
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] })
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraActive(true)
      frameRef.current = requestAnimationFrame(scanFrame)
    } catch (error) {
      stopCamera()
      setCameraError(error.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access or enter the PO number.'
        : (error.message || 'Unable to start the camera.'))
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-violet-50 p-3 text-violet-600"><Camera size={23} /></div>
        <div>
          <h2 className="font-black text-slate-800">Scan Purchase Order QR</h2>
          <p className="text-xs text-slate-500">Uses the rear camera on a mobile device</p>
        </div>
      </div>
      <div className="relative flex aspect-[4/3] max-h-[520px] items-center justify-center overflow-hidden rounded-2xl bg-slate-950">
        <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${cameraActive ? 'block' : 'hidden'}`} />
        {!cameraActive && (
          <div className="px-6 text-center text-white">
            <QrCode size={58} className="mx-auto text-violet-300" />
            <p className="mt-3 text-sm font-bold">Point the camera at the QR printed on the PO</p>
          </div>
        )}
        {cameraActive && <div className="pointer-events-none absolute inset-[16%] rounded-2xl border-2 border-violet-300 shadow-[0_0_0_999px_rgba(2,6,23,0.28)]" />}
      </div>
      {cameraError && <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs font-semibold text-amber-800">{cameraError}</p>}
      <button type="button" onClick={cameraActive ? stopCamera : startCamera}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black text-white ${cameraActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'}`}>
        {cameraActive ? <><XCircle size={17} /> Stop Camera</> : <><Camera size={17} /> Open Mobile Camera</>}
      </button>
    </div>
  )
}

function ManualPOEntry({ onResolved, ensureLocation }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { showError } = useAlert()

  const submit = async event => {
    event.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    try {
      const location = await ensureLocation()
      const result = await apiClient.post('/api/gate?action=resolve-po-code', { code: code.trim(), ...location })
      if (!result?.success) throw new Error(result?.error || 'Unable to find purchase order')
      onResolved(result.data)
    } catch (error) {
      showError('PO Not Found', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><Keyboard size={23} /></div>
        <div>
          <h2 className="font-black text-slate-800">Enter PO Number</h2>
          <p className="text-xs text-slate-500">Use the number printed at the top of the PO</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <input value={code} onChange={event => setCode(event.target.value.toUpperCase())}
          placeholder="PO-2026-123456" autoComplete="off" autoCapitalize="characters"
          className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 p-4 text-center font-mono text-lg font-black uppercase tracking-wider text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
        <button type="submit" disabled={loading || !code.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">
          {loading ? 'Opening PO...' : <><ShieldCheck size={17} /> Verify & Open PO</>}
        </button>
      </form>
    </div>
  )
}

export default function GateScanner() {
  const [mode, setMode] = useState('camera')
  const [todayReceipts, setTodayReceipts] = useState([])
  const navigate = useNavigate()
  const { showError } = useAlert()
  const locationRef = useRef(null)

  const ensureLocation = useCallback(async () => {
    const location = await getGateLocation()
    locationRef.current = location
    return location
  }, [])

  const openPO = useCallback(async ({ poId, token }) => {
    try {
      const location = locationRef.current || await ensureLocation()
      navigate(`/gate/po/${encodeURIComponent(poId)}?token=${encodeURIComponent(token)}&${locationQuery(location)}`)
    } catch (error) {
      showError('Gate Location Required', error.message)
    }
  }, [ensureLocation, navigate, showError])

  const handleDetected = useCallback(async value => {
    try {
      const url = new URL(value, window.location.origin)
      const match = url.pathname.match(/^\/gate\/po\/([^/]+)$/)
      const token = url.searchParams.get('token')
      if (!match || !token) throw new Error('This is not a CampusServe purchase-order QR')
      await openPO({ poId: decodeURIComponent(match[1]), token })
    } catch (error) {
      showError('Invalid PO QR', error.message)
    }
  }, [openPO, showError])

  useEffect(() => {
    apiClient.get('/api/gate?action=today', { cache: false }).then(result => {
      if (result?.success) setTodayReceipts(result.data || [])
    }).catch(() => {})
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fadeIn">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-slate-800">Gate PO Receiving</h1>
          <p className="mt-1 text-xs text-slate-500">Scan the official PO QR or enter its PO number to record received goods</p>
        </div>
        <Link to="/gate/history" className="inline-flex items-center gap-2 text-xs font-bold text-violet-700 hover:text-violet-900"><History size={15} /> Receiving History</Link>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        <button onClick={() => setMode('camera')} className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold ${mode === 'camera' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}><Camera size={16} /> Mobile Camera</button>
        <button onClick={() => setMode('code')} className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold ${mode === 'code' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}><Keyboard size={16} /> PO Number</button>
      </div>

      {mode === 'camera'
        ? <CameraScanner onDetected={handleDetected} ensureLocation={ensureLocation} />
        : <ManualPOEntry onResolved={openPO} ensureLocation={ensureLocation} />}

      <div className="premium-card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Today’s Received POs</h2>
          <span className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700">{todayReceipts.length}</span>
        </div>
        {todayReceipts.length === 0 ? (
          <p className="py-7 text-center text-xs text-slate-400">No PO receipts recorded at the gate today</p>
        ) : (
          <div className="space-y-2">
            {todayReceipts.slice(0, 10).map(receipt => (
              <div key={receipt._id} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-600" />
                  <div><div className="font-bold text-slate-800">{receipt.poNumber}</div><div className="text-slate-500">{receipt.grnNumber} · {receipt.grnType}</div></div>
                </div>
                <div className="text-right text-slate-500"><div>₹{Number(receipt.grandTotal || 0).toFixed(2)}</div><div>{new Date(receipt.receivedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
