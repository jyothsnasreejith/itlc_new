import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [customLogo, setCustomLogo] = useState('')

  useEffect(() => {
    // Load custom logo from localStorage
    const savedLogo = localStorage.getItem('customLogo')
    if (savedLogo) setCustomLogo(savedLogo)
    
    // Initialize default users if not exists
    const savedUsers = localStorage.getItem('systemUsers')
    if (!savedUsers) {
      const defaultUsers = [
        { id: 1, username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator', created_at: new Date().toISOString() },
        { id: 2, username: 'manager', password: 'manager123', role: 'event_manager', name: 'Event Manager', created_at: new Date().toISOString() }
      ]
      localStorage.setItem('systemUsers', JSON.stringify(defaultUsers))
    }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))

    // Load users from localStorage
    const savedUsers = localStorage.getItem('systemUsers')
    const users = savedUsers ? JSON.parse(savedUsers) : []

    // Case-insensitive username matching
    const user = users.find(
      u => u.username.toLowerCase() === credentials.username.toLowerCase() && u.password === credentials.password
    )

    if (user) {
      // Store user session
      localStorage.setItem('user', JSON.stringify({
        username: user.username,
        role: user.role,
        name: user.name
      }))

      // Redirect based on role
      if (user.role === 'admin') {
        navigate('/admin/dashboard')
      } else if (user.role === 'event_manager') {
        navigate('/manager/dashboard')
      }
    } else {
      setError('Invalid username or password')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/10 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-4 overflow-hidden">
            {customLogo ? (
              <img src={customLogo} alt="ITLC Logo" className="w-full h-full object-contain" />
            ) : (
              <img src="/itlc-logo.svg" alt="ITLC Logo" className="w-full h-full object-contain" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            IT Leaders Community
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Event Management System
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
            Sign In
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Username
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  person
                </span>
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  placeholder="Enter your username"
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  lock
                </span>
                <input
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98] mt-6"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-slate-500 dark:text-slate-400">
          <p>© 2026 IT Leaders Community. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
