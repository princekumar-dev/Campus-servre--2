import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import ModalShell from '../components/ModalShell'
import ConfirmDialog from '../components/ConfirmDialog'
import apiClient from '../utils/apiClient'
import { getAuthOrNull } from '../utils/auth'
import { Users, Plus, Trash2, Shield, Mail, Phone, Building2, Search } from 'lucide-react'

function AdminUsers() {
  const navigate = useNavigate()
  const { showSuccess, showError } = useAlert()
  const auth = getAuthOrNull()
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'requester', department: '', phoneNumber: '' })
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!auth || !['admin', 'super_admin'].includes(auth.role)) {
      navigate('/dashboard')
      return
    }
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get(`/api/users?action=list&userId=${auth.id}`)
      if (res.success) setUsers(res.users)
    } catch (err) {
      showError('Error', 'Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password || !newUser.department) {
      showError('Required', 'All fields are required')
      return
    }
    setCreating(true)
    try {
      const res = await apiClient.post('/api/users', { ...newUser, creatorUserId: auth.id })
      if (res.success) {
        showSuccess('Created', 'User created successfully')
        setShowCreateModal(false)
        setNewUser({ name: '', email: '', password: '', role: 'requester', department: '', phoneNumber: '' })
        if (res.user) setUsers(current => [...current, res.user])
        else fetchUsers()
      } else {
        showError('Error', res.error || 'Failed to create user')
      }
    } catch (err) {
      showError('Error', err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!pendingDelete) return
    const userId = pendingDelete.id || pendingDelete._id
    setDeleting(true)
    try {
      const res = await apiClient.del(`/api/users?id=${userId}`, { body: { userId: auth.id } })
      if (res.success) {
        showSuccess('Deleted', 'User removed')
        setUsers(current => current.filter(user => user.id !== userId && user._id !== userId))
        setPendingDelete(null)
      } else {
        showError('Unable to delete user', res.error || 'Please try again.')
      }
    } catch (err) {
      showError('Error', 'Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const roleColors = {
    admin: 'bg-red-100 text-red-700',
    manager: 'bg-blue-100 text-blue-700',
    technician: 'bg-amber-100 text-amber-700',
    accounts: 'bg-emerald-100 text-emerald-700',
    requester: 'bg-violet-100 text-violet-700',
    vendor: 'bg-slate-100 text-slate-700',
    super_admin: 'bg-red-100 text-red-700'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-violet-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">{users.length} total users</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-2.5 px-5 rounded-xl transition-all"
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search users by name, email, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Name</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Email</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Role</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Department</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 text-sm">No users found</td>
                </tr>
              ) : filtered.map(user => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">
                        {user.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm text-slate-800">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${roleColors[user.role] || 'bg-slate-100 text-slate-600'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{user.department}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{user.phoneNumber || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {user.id !== auth.id && (
                      <button
                        onClick={() => setPendingDelete(user)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label={`Delete ${user.name || 'user'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <ModalShell panelClassName="max-w-md">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New User</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Full Name" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
              <input type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
              <input type="password" placeholder="Password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
              <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500">
                <option value="requester">Requester</option>
                <option value="manager">Service Manager</option>
                <option value="technician">Technician</option>
                <option value="accounts">Accounts Officer</option>
                <option value="admin">Administrator</option>
                <option value="vendor">Vendor</option>
              </select>
              <input type="text" placeholder="Department" value={newUser.department} onChange={e => setNewUser({...newUser, department: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
              <input type="tel" placeholder="Phone Number" value={newUser.phoneNumber} onChange={e => setNewUser({...newUser, phoneNumber: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold text-sm">Cancel</button>
              <button onClick={handleCreateUser} disabled={creating} className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 font-semibold text-sm">
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
        </ModalShell>
      )}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remove user?"
        description={`${pendingDelete?.name || pendingDelete?.email || 'This user'} will immediately lose access to CampusServe. This action cannot be undone.`}
        confirmLabel="Remove user"
        onConfirm={handleDeleteUser}
        onCancel={() => !deleting && setPendingDelete(null)}
        loading={deleting}
      />
    </div>
  )
}

export default AdminUsers
