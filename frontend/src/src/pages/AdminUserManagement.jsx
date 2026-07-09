import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'

export default function AdminUserManagement() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'event_manager',
    name: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingUser, setEditingUser] = useState(null)

  useEffect(() => {
    // Check if user is admin
    const userData = localStorage.getItem('user')
    if (!userData) {
      navigate('/login')
      return
    }
    const user = JSON.parse(userData)
    if (user.role !== 'admin') {
      navigate('/admin/dashboard')
      return
    }
    
    loadUsers()
  }, [navigate])

  function loadUsers() {
    // Load users from localStorage
    const savedUsers = localStorage.getItem('systemUsers')
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers))
    } else {
      // Initialize with default users
      const defaultUsers = [
        { id: 1, username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator', created_at: new Date().toISOString() },
        { id: 2, username: 'manager', password: 'manager123', role: 'event_manager', name: 'Event Manager', created_at: new Date().toISOString() }
      ]
      setUsers(defaultUsers)
      localStorage.setItem('systemUsers', JSON.stringify(defaultUsers))
    }
  }

  function handleCreateUser(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validate
    if (!newUser.username || !newUser.password || !newUser.name) {
      setError('All fields are required')
      return
    }

    if (newUser.username.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }

    if (newUser.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    // Check if username already exists (case-insensitive)
    const usernameExists = users.some(
      u => u.username.toLowerCase() === newUser.username.toLowerCase() && 
           (!editingUser || u.id !== editingUser.id)
    )
    
    if (usernameExists) {
      setError('Username already exists')
      return
    }

    if (editingUser) {
      // Update existing user
      const updatedUsers = users.map(u => 
        u.id === editingUser.id 
          ? { ...u, ...newUser, username: newUser.username.toLowerCase(), updated_at: new Date().toISOString() }
          : u
      )
      setUsers(updatedUsers)
      localStorage.setItem('systemUsers', JSON.stringify(updatedUsers))
      setSuccess('User updated successfully!')
    } else {
      // Create new user
      const user = {
        id: Date.now(),
        ...newUser,
        username: newUser.username.toLowerCase(),
        created_at: new Date().toISOString()
      }
      const updatedUsers = [...users, user]
      setUsers(updatedUsers)
      localStorage.setItem('systemUsers', JSON.stringify(updatedUsers))
      setSuccess('User created successfully!')
    }

    // Reset form
    setNewUser({ username: '', password: '', role: 'event_manager', name: '' })
    setShowModal(false)
    setEditingUser(null)
    
    setTimeout(() => setSuccess(''), 3000)
  }

  function handleEditUser(user) {
    setEditingUser(user)
    setNewUser({
      username: user.username,
      password: user.password,
      role: user.role,
      name: user.name
    })
    setShowModal(true)
    setError('')
  }

  function handleDeleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return
    
    const updatedUsers = users.filter(u => u.id !== userId)
    setUsers(updatedUsers)
    localStorage.setItem('systemUsers', JSON.stringify(updatedUsers))
    setSuccess('User deleted successfully!')
    setTimeout(() => setSuccess(''), 3000)
  }

  function closeModal() {
    setShowModal(false)
    setEditingUser(null)
    setNewUser({ username: '', password: '', role: 'event_manager', name: '' })
    setError('')
  }

  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    }
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin/dashboard')} className="text-primary">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">User Management</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage admin and manager accounts</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            <span className="material-symbols-outlined">add</span>
            <span className="hidden sm:inline">Add User</span>
          </button>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        {/* Users List */}
        <div className="space-y-3">
          {users.map(user => (
            <div
              key={user.id}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary">
                      {user.role === 'admin' ? 'admin_panel_settings' : 'badge'}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 dark:text-white">{user.name}</h3>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getRoleBadge(user.role)}`}>
                        {user.role === 'admin' ? 'Admin' : 'Event Manager'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">person</span>
                        {user.username}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">calendar_today</span>
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditUser(user)}
                    className="size-9 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="size-9 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-3 text-slate-300 dark:text-slate-700">supervisor_account</span>
              <p className="font-semibold">No users found</p>
              <p className="text-sm mt-1">Click "Add User" to create a new account</p>
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Enter username (case-insensitive)"
                  required
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Minimum 3 characters, case-insensitive
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Enter password"
                  required
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Minimum 6 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Role *
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  required
                >
                  <option value="event_manager">Event Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Admin: Full access | Event Manager: Events & attendance only
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold py-3 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98]"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
