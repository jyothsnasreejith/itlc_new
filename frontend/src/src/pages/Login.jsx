import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'

export default function Login() {
  const navigate = useNavigate()

  // Login Mode: 'member' | 'staff'
  const [loginMode, setLoginMode] = useState('member')

  // Staff credentials
  const [staffCredentials, setStaffCredentials] = useState({ username: '', password: '' })

  // Member credentials
  const [memberCredentials, setMemberCredentials] = useState({ phone: '', pin: '' })

  // General states
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [customLogo, setCustomLogo] = useState('')

  // PIN Reset Modal / View states
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetStep, setResetStep] = useState('request') // 'request' | 'verify' | 'done'
  const [resetPhone, setResetPhone] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  useEffect(() => {
    // Load custom logo from localStorage if available
    const savedLogo = localStorage.getItem('customLogo')
    if (savedLogo) setCustomLogo(savedLogo)

    // Initialize default system users if missing
    const savedUsers = localStorage.getItem('systemUsers')
    if (!savedUsers) {
      const defaultUsers = [
        { id: 1, username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator', created_at: new Date().toISOString() },
        { id: 2, username: 'manager', password: 'manager123', role: 'event_manager', name: 'Event Manager', created_at: new Date().toISOString() }
      ]
      localStorage.setItem('systemUsers', JSON.stringify(defaultUsers))
    }
  }, [])

  // 1. Staff Login Handler
  async function handleStaffLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 400))
      const savedUsers = localStorage.getItem('systemUsers')
      const users = savedUsers ? JSON.parse(savedUsers) : []

      const user = users.find(
        u => u.username.toLowerCase() === staffCredentials.username.toLowerCase() && u.password === staffCredentials.password
      )

      if (user) {
        localStorage.setItem('user', JSON.stringify({
          username: user.username,
          role: user.role,
          name: user.name
        }))

        if (user.role === 'admin') {
          navigate('/admin/dashboard')
        } else if (user.role === 'event_manager') {
          navigate('/manager/dashboard')
        }
      } else {
        setError('Invalid username or password')
      }
    } catch (err) {
      setError('Staff login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Member Login Handler (Phone + 4-digit PIN)
  async function handleMemberLogin(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const cleanPhone = memberCredentials.phone.trim()
    const pin = memberCredentials.pin.trim()

    if (!cleanPhone) {
      setError('Please enter your registered mobile number')
      return
    }

    if (!pin || pin.length !== 4) {
      setError('PIN must be exactly 4 digits')
      return
    }

    setLoading(true)

    try {
      const result = await authService.memberLogin({
        phoneNumber: cleanPhone,
        pin: pin
      })

      if (result.success && result.member) {
        // Save authenticated member session
        localStorage.setItem('user', JSON.stringify({
          id: result.member.id,
          role: 'member',
          name: result.member.full_name,
          phone: result.member.phone_number,
          email: result.member.email,
          company: result.member.company,
          designation: result.member.designation,
          chapter: result.member.itlc_chapter_name,
          profile_image: result.member.profile_image
        }))

        // Route to digital ID card or public profile update
        navigate('/member/id-card')
      } else if (result.needsPinSetup) {
        setError('No PIN set yet for this member. Please use Forgot PIN to receive a reset code.')
      } else {
        setError(result.message || 'Invalid PIN or credentials.')
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your phone number and PIN.')
    } finally {
      setLoading(false)
    }
  }

  // 3. Request PIN Reset Code (Sent to registered email)
  async function handleRequestResetCode(e) {
    e?.preventDefault()
    setResetError('')
    const phone = (resetPhone || memberCredentials.phone).trim()

    if (!phone) {
      setResetError('Please enter your registered mobile number')
      return
    }

    setResetLoading(true)
    try {
      const res = await authService.forgotPin(phone)
      setResetStep('verify')
      setResetPhone(phone)
      setResetCode('')
      setNewPin('')
      setConfirmPin('')
    } catch (err) {
      setResetError(err.message || 'Failed to send reset code. Please check your phone number.')
    } finally {
      setResetLoading(false)
    }
  }

  // 4. Submit PIN Reset (Using code from email)
  async function handleSubmitNewPin(e) {
    e.preventDefault()
    setResetError('')

    const code = resetCode.trim()
    const p1 = newPin.trim()
    const p2 = confirmPin.trim()

    if (!code || code.length !== 6) {
      setResetError('Reset code must be exactly 6 digits')
      return
    }

    if (!p1 || p1.length !== 4 || !/^\d{4}$/.test(p1)) {
      setResetError('New PIN must be exactly 4 digits (numbers only)')
      return
    }

    if (p1 !== p2) {
      setResetError('New PIN and Confirm PIN do not match')
      return
    }

    setResetLoading(true)
    try {
      await authService.resetPin({
        phoneNumber: resetPhone,
        resetCode: code,
        newPin: p1
      })

      setResetStep('done')
      setMemberCredentials(prev => ({ ...prev, phone: resetPhone, pin: p1 }))
    } catch (err) {
      setResetError(err.message || 'Failed to reset PIN. The code might be invalid or expired.')
    } finally {
      setResetLoading(false)
    }
  }

  const openForgotPinModal = () => {
    setResetError('')
    setResetPhone(memberCredentials.phone || '')
    setResetStep('request')
    setResetModalOpen(true)
  }

  const closeForgotPinModal = () => {
    if (resetLoading) return
    setResetModalOpen(false)
    setResetStep('request')
    setResetError('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Community Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-20 mb-3 overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-md p-2 border border-slate-200/80 dark:border-slate-700">
            {customLogo ? (
              <img src={customLogo} alt="ITLC Logo" className="w-full h-full object-contain" />
            ) : (
              <img src="/itlc-logo.svg" alt="ITLC Logo" className="w-full h-full object-contain" />
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            IT Leaders Community
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Kerala Chapter • Members & Management Portal
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/60 dark:shadow-none border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 overflow-hidden">
          
          {/* Segmented Mode Selector: Member vs Staff */}
          <div className="flex rounded-2xl p-1 bg-slate-100 dark:bg-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setLoginMode('member')
                setError('')
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                loginMode === 'member'
                  ? 'bg-white dark:bg-slate-900 text-primary shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-lg">badge</span>
              <span>Member Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('staff')
                setError('')
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                loginMode === 'staff'
                  ? 'bg-white dark:bg-slate-900 text-primary shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
              <span>Staff / Admin</span>
            </button>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-xs sm:text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-xl text-xs sm:text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg shrink-0">check_circle</span>
              <span>{success}</span>
            </div>
          )}

          {/* FORM 1: MEMBER LOGIN */}
          {loginMode === 'member' && (
            <form onSubmit={handleMemberLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Registered Mobile Number
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    phone
                  </span>
                  <input
                    type="tel"
                    value={memberCredentials.phone}
                    onChange={(e) => setMemberCredentials({ ...memberCredentials, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    4-Digit Security PIN
                  </label>
                  <button
                    type="button"
                    onClick={openForgotPinModal}
                    className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot PIN?
                  </button>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    pin
                  </span>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={memberCredentials.pin}
                    onChange={(e) => setMemberCredentials({ ...memberCredentials, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="••••"
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 tracking-widest text-base font-bold"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-[0.98] mt-6 text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={openForgotPinModal}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm text-indigo-500">lock_reset</span>
                  <span>Need to reset or forgot your PIN? Click here</span>
                </button>
              </div>
            </form>
          )}

          {/* FORM 2: STAFF / ADMIN LOGIN */}
          {loginMode === 'staff' && (
            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Staff Username
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    account_circle
                  </span>
                  <input
                    type="text"
                    value={staffCredentials.username}
                    onChange={(e) => setStaffCredentials({ ...staffCredentials, username: e.target.value })}
                    placeholder="admin or manager"
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    lock
                  </span>
                  <input
                    type="password"
                    value={staffCredentials.password}
                    onChange={(e) => setStaffCredentials({ ...staffCredentials, password: e.target.value })}
                    placeholder="Enter password"
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-slate-900/10 transition-all active:scale-[0.98] mt-6 text-sm flex items-center justify-center gap-2"
              >
                {loading ? 'Authenticating...' : 'Sign In as Staff'}
              </button>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-slate-400 dark:text-slate-500">
          <p>© 2026 IT Leaders Community. Secure Member Authentication.</p>
        </div>
      </div>

      {/* FORGOT / RESET PIN MODAL */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">lock_reset</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Reset Member PIN
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Verification code sent via email
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeForgotPinModal}
                disabled={resetLoading}
                className="size-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6">
              {resetError && (
                <div className="mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base shrink-0">error</span>
                  <span>{resetError}</span>
                </div>
              )}

              {/* STEP 1: REQUEST CODE */}
              {resetStep === 'request' && (
                <form onSubmit={handleRequestResetCode} className="space-y-4">
                  <div className="text-center pb-2">
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Enter your registered phone number. We will immediately dispatch a <strong>6-digit verification code</strong> to your registered email address.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                        phone
                      </span>
                      <input
                        type="tel"
                        value={resetPhone}
                        onChange={(e) => setResetPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={resetLoading || !resetPhone.trim()}
                      className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-primary/20 transition-all text-sm flex items-center justify-center gap-2"
                    >
                      {resetLoading ? (
                        <>
                          <div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          <span>Sending Code...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">mail</span>
                          <span>Send Reset Code to Email</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: VERIFY CODE & ENTER NEW PIN */}
              {resetStep === 'verify' && (
                <form onSubmit={handleSubmitNewPin} className="space-y-4">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/80 dark:border-indigo-800/80 text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-2">
                    <span className="material-symbols-outlined text-lg shrink-0 text-indigo-600">mark_email_read</span>
                    <div>
                      <span>A 6-digit reset code has been sent to your email for phone <strong>{resetPhone}</strong>. It will expire in 15 minutes.</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      6-Digit Email Code *
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full py-2.5 px-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-lg font-bold tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        New 4-Digit PIN
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full py-2.5 px-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-base font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Confirm PIN
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full py-2.5 px-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-base font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setResetStep('request')}
                      disabled={resetLoading}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Resend Code
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading || resetCode.length !== 6 || newPin.length !== 4}
                      className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold rounded-xl shadow-md text-xs sm:text-sm flex items-center justify-center gap-1.5"
                    >
                      {resetLoading ? 'Resetting PIN...' : 'Save New PIN'}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: DONE */}
              {resetStep === 'done' && (
                <div className="text-center py-4 space-y-4">
                  <div className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      PIN Reset Successfully!
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                      Your 4-digit security PIN has been updated. You can now sign in with your new PIN.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      closeForgotPinModal()
                      setLoginMode('member')
                    }}
                    className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 text-sm"
                  >
                    Proceed to Member Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
