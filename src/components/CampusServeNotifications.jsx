import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'
import { Bell, CheckCheck, ChevronRight, Inbox, LoaderCircle, Trash2, X } from 'lucide-react'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'

const formatTime = (value) => {
  if (!value) return 'Just now'
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
}

export default function CampusServeNotifications({ isOpen, onClose, setUnreadCount }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const auth = getAuthOrNull()

  const unreadCount = useMemo(() => items.filter(item => !item.read).length, [items])

  const loadNotifications = useCallback(async () => {
    if (!auth?.email) return
    setLoading(true)
    setError('')
    try {
      const result = await apiClient.get(`/api/notifications?userEmail=${encodeURIComponent(auth.email)}&limit=75&t=${Date.now()}`, { cache: false, dedupe: false })
      const notifications = result?.success && Array.isArray(result.notifications) ? result.notifications : []
      setItems(notifications)
      setUnreadCount?.(notifications.filter(item => !item.read).length)
    } catch (err) {
      setError(err.message || 'Notifications could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [auth?.email, setUnreadCount])

  useEffect(() => {
    if (!isOpen) return
    loadNotifications()
    const refresh = () => loadNotifications()
    window.addEventListener('notificationsUpdated', refresh)
    window.addEventListener('requestsUpdated', refresh)
    return () => {
      window.removeEventListener('notificationsUpdated', refresh)
      window.removeEventListener('requestsUpdated', refresh)
    }
  }, [isOpen, loadNotifications])

  useEffect(() => {
    setUnreadCount?.(unreadCount)
  }, [unreadCount, setUnreadCount])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = event => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [isOpen, onClose])

  const markRead = async (id) => {
    setItems(current => current.map(item => item._id === id ? { ...item, read: true } : item))
    try { await apiClient.patch(`/api/notifications/${id}/read`) } catch { loadNotifications() }
  }

  const markAllRead = async () => {
    const unread = items.filter(item => !item.read)
    setItems(current => current.map(item => ({ ...item, read: true })))
    await Promise.allSettled(unread.map(item => apiClient.patch(`/api/notifications/${item._id}/read`)))
  }

  const remove = async (event, id) => {
    event.stopPropagation()
    setItems(current => current.filter(item => item._id !== id))
    try { await apiClient.del(`/api/notifications/${id}`) } catch { loadNotifications() }
  }

  const openItem = async (item) => {
    if (!item.read) await markRead(item._id)
    onClose()
    const target = item.url || item.data?.url
    if (target && target.startsWith('/')) window.location.assign(target)
  }

  if (!isOpen) return null

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[3px] sm:p-6" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="flex max-h-[min(720px,88vh)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]" role="dialog" aria-modal="true" aria-labelledby="notification-title">
        <header className="flex items-center gap-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-violet-100/80 px-5 py-5 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-200">
            <Bell size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 id="notification-title" className="text-lg font-black text-slate-900 sm:text-xl">Notifications</h2>
              {unreadCount > 0 && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-black text-white">{unreadCount} new</span>}
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">Updates and actions for {auth?.name || auth?.email || 'your account'}</p>
          </div>
          {unreadCount > 0 && <button type="button" onClick={markAllRead} className="hidden items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 sm:inline-flex"><CheckCheck size={15} /> Mark all read</button>}
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close notifications"><X size={19} /></button>
        </header>

        <div className="min-h-[300px] flex-1 overflow-y-auto bg-slate-50/60 p-3 sm:p-4">
          {loading && items.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-slate-500"><LoaderCircle className="animate-spin text-violet-600" size={30} /><span className="text-sm font-semibold">Loading notifications…</span></div>
          ) : error ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center text-center"><div className="mb-3 rounded-2xl bg-rose-50 p-4 text-rose-500"><Bell size={28} /></div><p className="font-bold text-slate-800">Unable to load notifications</p><p className="mt-1 max-w-sm text-sm text-slate-500">{error}</p><button onClick={loadNotifications} className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white">Try again</button></div>
          ) : items.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center text-center"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-100"><Inbox size={30} /></div><p className="font-bold text-slate-800">You’re all caught up</p><p className="mt-1 text-sm text-slate-500">Workflow updates and actions will appear here.</p></div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <article key={item._id} onClick={() => openItem(item)} className={`group flex cursor-pointer gap-3 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${item.read ? 'border-slate-100 bg-white' : 'border-violet-200 bg-violet-50/70 shadow-sm'}`}>
                  <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.read ? 'bg-slate-200' : 'bg-violet-600 ring-4 ring-violet-100'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3"><h3 className={`text-sm ${item.read ? 'font-semibold text-slate-700' : 'font-black text-slate-900'}`}>{item.title || 'CampusServe update'}</h3><time className="shrink-0 text-[10px] font-semibold text-slate-400">{formatTime(item.createdAt)}</time></div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.body || item.message || 'There is an update waiting for you.'}</p>
                  </div>
                  <button type="button" onClick={event => remove(event, item._id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100" aria-label="Delete notification"><Trash2 size={14} /></button>
                  {(item.url || item.data?.url) && <ChevronRight className="mt-1 shrink-0 text-slate-300" size={17} />}
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-3 text-[11px] text-slate-400 sm:px-6">
          <span>{items.length} notification{items.length === 1 ? '' : 's'}</span>
          {unreadCount > 0 && <button type="button" onClick={markAllRead} className="font-bold text-violet-700 sm:hidden">Mark all as read</button>}
          <span className="hidden sm:inline">Updates refresh automatically</span>
        </footer>
      </section>
    </div>,
    document.body
  )
}
