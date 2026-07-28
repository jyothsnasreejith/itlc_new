import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PublicProfileUpdate() {
  const [step, setStep] = useState('verify') // 'verify', 'verify-pin', 'forgot-pin', 'reset-pin', or 'edit'
  const [phoneNumber, setPhoneNumber] = useState('')
  const [member, setMember] = useState(null)
  const [editedMember, setEditedMember] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPinSection, setShowPinSection] = useState(false)
  const [verifyPin, setVerifyPin] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [resetCode, setResetCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  async function handleVerifyPhone(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '')
      
      const { data, error: fetchError } = await supabase
        .from('members')
        .select('*')
        .or(`phone_number.eq.${phoneNumber},phone_number.eq.${cleanPhone},phone_number.eq.+91${cleanPhone}`)
        .limit(1)
        .single()

      if (fetchError || !data) {
        setError('Phone number not found in our database. Please contact admin.')
        setLoading(false)
        return
      }

      setMember(data)
      
      // Check if member has a PIN set
      if (data.login_pin) {
        // PIN required - move to PIN verification step
        setVerifyPin('')
        setStep('verify-pin')
      } else {
        // No PIN - proceed to edit
        setEditedMember({ ...data })
        setPhotoPreview(data.profile_image)
        setStep('edit')
      }
    } catch (err) {
      console.error('Error verifying phone:', err)
      setError('Phone number not found. Please check and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyPin(e) {
    e.preventDefault()
    
    if (!verifyPin || verifyPin.length !== 4) {
      setError('PIN must be exactly 4 digits')
      return
    }

    setPinLoading(true)
    setError(null)

    try {
      if (member.login_pin === verifyPin) {
        // PIN is correct - proceed to edit
        setEditedMember({ ...member })
        setPhotoPreview(member.profile_image)
        setStep('edit')
      } else {
        setError('Invalid PIN. Please try again.')
        setVerifyPin('')
      }
    } catch (err) {
      console.error('Error verifying PIN:', err)
      setError('Error verifying PIN. Please try again.')
    } finally {
      setPinLoading(false)
    }
  }

  async function handleForgotPin() {
    setError('')
    setPinLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('forgot-pin', {
        body: { phoneNumber: member.phone_number }
      })

      if (error) throw error

      if (data.success) {
        setSuccess('Reset code sent to your email. Check your inbox.')
        setStep('reset-pin')
        setResetCode('')
        setNewPin('')
        setConfirmNewPin('')
      } else {
        setError(data.message || 'Failed to send reset code')
      }
    } catch (err) {
      console.error('Error sending forgot PIN email:', err)
      setError('Failed to send reset code. Please try again.')
    } finally {
      setPinLoading(false)
    }
  }

  async function handleResetPin(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!resetCode || resetCode.length !== 6) {
      setError('Reset code must be 6 digits')
      return
    }

    if (!newPin || newPin.length !== 4) {
      setError('New PIN must be exactly 4 digits')
      return
    }

    if (newPin !== confirmNewPin) {
      setError('New PIN and confirmation do not match')
      return
    }

    if (!/^\d+$/.test(newPin)) {
      setError('New PIN must contain only numbers')
      return
    }

    setResetLoading(true)

    try {
      // Verify reset code and update PIN
      const { data, error } = await supabase
        .from('members')
        .select('reset_pin, reset_pin_expires_at')
        .eq('id', member.id)
        .single()

      if (error) throw error

      if (!data.reset_pin || data.reset_pin !== resetCode) {
        setError('Invalid reset code')
        return
      }

      if (new Date() > new Date(data.reset_pin_expires_at)) {
        setError('Reset code has expired. Please request a new one.')
        return
      }

      // Update the PIN and clear reset data
      const { error: updateError } = await supabase
        .from('members')
        .update({
          login_pin: newPin,
          reset_pin: null,
          reset_pin_expires_at: null
        })
        .eq('id', member.id)

      if (updateError) throw updateError

      setSuccess('PIN reset successfully! You can now use your new PIN.')
      setMember({ ...member, login_pin: newPin })
      setStep('edit')
      setEditedMember({ ...member, login_pin: newPin })
      setPhotoPreview(member.profile_image)

    } catch (err) {
      console.error('Error resetting PIN:', err)
      setError('Failed to reset PIN. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  function handlePhotoSelect(e) {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Photo size should be less than 5MB')
        return
      }
      setSelectedPhoto(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      let photoUrl = editedMember.profile_image

      // Upload new photo if selected
      if (selectedPhoto) {
        const fileExt = selectedPhoto.name.split('.').pop()
        const fileName = `${member.id}-${Date.now()}.${fileExt}`
        const filePath = `profile-photos/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('member-photos')
          .upload(filePath, selectedPhoto)

        if (uploadError) {
          console.log('Upload error, using base64:', uploadError)
          // Use base64 as fallback
          photoUrl = photoPreview
        } else {
          const { data: urlData } = supabase.storage
            .from('member-photos')
            .getPublicUrl(filePath)
          photoUrl = urlData.publicUrl
        }
      }

      // Validate PIN if creating one
      if (showPinSection && !validatePin()) {
        setSaving(false)
        return
      }

      // Update member profile
      const proEmail = editedMember.professional_email || editedMember.email
      const proPhone = editedMember.professional_phone || editedMember.phone_number
      const updateData = {
        full_name: editedMember.full_name,
        email: proEmail,
        professional_email: proEmail,
        personal_email: editedMember.personal_email || null,
        phone_number: proPhone,
        professional_phone: proPhone,
        personal_phone: editedMember.personal_phone || null,
        designation: editedMember.designation,
        company: editedMember.company,
        location: editedMember.location,
        area_of_expertise: editedMember.area_of_expertise,
        profile_image: photoUrl,
        updated_at: new Date().toISOString()
      }

      // Add PIN if user is creating one
      if (showPinSection && pin) {
        updateData.login_pin = pin
      }

      const { error: updateError } = await supabase
        .from('members')
        .update(updateData)
        .eq('id', member.id)

      if (updateError) throw updateError

      let successMsg = '✅ Profile updated successfully!'
      if (showPinSection && pin) {
        successMsg = '✅ Profile updated! Your PIN has been set for future logins.'
      }
      setSuccess(successMsg)
      setMember({ ...editedMember, profile_image: photoUrl })
      setSelectedPhoto(null)
      setPin('')
      setConfirmPin('')
      setShowPinSection(false)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError('Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function validatePin() {
    if (!pin) {
      setError('PIN is required for login security')
      return false
    }
    if (pin.length !== 4) {
      setError('PIN must be exactly 4 digits')
      return false
    }
    if (!/^\d+$/.test(pin)) {
      setError('PIN must contain only numbers')
      return false
    }
    if (pin !== confirmPin) {
      setError('PIN and Confirm PIN do not match')
      return false
    }
    return true
  }

  function resetForm() {
    setStep('verify')
    setPhoneNumber('')
    setMember(null)
    setEditedMember(null)
    setSelectedPhoto(null)
    setPhotoPreview(null)
    setPin('')
    setConfirmPin('')
    setShowPinSection(false)
    setVerifyPin('')
    setResetCode('')
    setNewPin('')
    setConfirmNewPin('')
    setError('')
    setSuccess('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/10 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <span className="material-symbols-outlined text-5xl text-primary">person</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Update Your Profile
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            IT Leaders Community - Kerala
          </p>
        </div>

        {/* Verify Phone Step */}
        {step === 'verify' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
              Verify Your Phone Number
            </h2>
            
            <form onSubmit={handleVerifyPhone} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    phone
                  </span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter your registered phone number"
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    required
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Enter the phone number you registered with ITLC
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98]"
              >
                {loading ? 'Verifying...' : 'Continue'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Phone number not registered?{' '}
                <a href="/membership-registration" className="text-primary hover:underline font-semibold">
                  Register Now
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Verify PIN Step */}
        {step === 'verify-pin' && member && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
              Enter Your PIN
            </h2>
            
            <form onSubmit={handleVerifyPin} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  PIN Code
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    lock
                  </span>
                  <input
                    type="password"
                    value={verifyPin}
                    onChange={(e) => setVerifyPin(e.target.value)}
                    placeholder="Enter your 4-digit PIN"
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    maxLength="4"
                    required
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Enter the PIN you created for secure access
                </p>
              </div>

              <button
                type="submit"
                disabled={pinLoading}
                className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98]"
              >
                {pinLoading ? 'Verifying...' : 'Verify PIN'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-center space-y-2">
              <button
                onClick={handleForgotPin}
                disabled={pinLoading}
                className="text-sm text-primary hover:text-primary/80 font-semibold disabled:opacity-50"
              >
                Forgot PIN?
              </button>
              <br />
              <button
                onClick={resetForm}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Back to Phone Verification
              </button>
            </div>
          </div>
        )}

        {/* Reset PIN Step */}
        {step === 'reset-pin' && member && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
              Reset Your PIN
            </h2>

            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm mb-4">
                {success}
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleResetPin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Reset Code
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    vpn_key
                  </span>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => {
                      const val = e.target.value
                      if (/^\d*$/.test(val)) setResetCode(val)
                    }}
                    placeholder="Enter 6-digit reset code"
                    maxLength="6"
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    required
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Enter the 6-digit code sent to your email
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  New PIN (4 digits)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    lock
                  </span>
                  <input
                    type="password"
                    value={newPin}
                    onChange={(e) => {
                      const val = e.target.value
                      if (/^\d*$/.test(val)) setNewPin(val)
                    }}
                    placeholder="Enter new 4-digit PIN"
                    maxLength="4"
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Confirm New PIN
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    lock_check
                  </span>
                  <input
                    type="password"
                    value={confirmNewPin}
                    onChange={(e) => {
                      const val = e.target.value
                      if (/^\d*$/.test(val)) setConfirmNewPin(val)
                    }}
                    placeholder="Re-enter new PIN"
                    maxLength="4"
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98]"
              >
                {resetLoading ? 'Resetting PIN...' : 'Reset PIN'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-center space-y-2">
              <button
                onClick={() => setStep('verify-pin')}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Back to PIN Verification
              </button>
              <br />
              <button
                onClick={resetForm}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Back to Phone Verification
              </button>
            </div>
          </div>
        )}

        {/* Edit Profile Step */}
        {step === 'edit' && member && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Edit Your Profile
              </h2>
              <button
                onClick={resetForm}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                Exit
              </button>
            </div>

            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm mb-4">
                {success}
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Profile Photo */}
              <div className="text-center">
                <div className="relative inline-block">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 ring-4 ring-primary/20 mb-4">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-6xl text-slate-400">person</span>
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-4 right-0 bg-primary hover:bg-primary/90 text-white p-2 rounded-full cursor-pointer shadow-lg">
                    <span className="material-symbols-outlined text-lg">photo_camera</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click camera icon to change photo
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={editedMember.full_name || ''}
                  onChange={(e) => setEditedMember({ ...editedMember, full_name: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  required
                />
              </div>

              {/* Professional Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Professional/Work Email *
                </label>
                <input
                  type="email"
                  value={editedMember.professional_email || editedMember.email || ''}
                  onChange={(e) => setEditedMember({ ...editedMember, professional_email: e.target.value, email: e.target.value })}
                  placeholder="work@company.com"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  required
                />
              </div>

              {/* Personal Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Personal Email
                </label>
                <input
                  type="email"
                  value={editedMember.personal_email || ''}
                  onChange={(e) => setEditedMember({ ...editedMember, personal_email: e.target.value })}
                  placeholder="personal@example.com"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>

              {/* Professional Phone Number (Primary - Read-only) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Professional/Work Phone Number
                </label>
                <input
                  type="tel"
                  value={editedMember.professional_phone || member.phone_number || ''}
                  disabled
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Primary professional phone number cannot be changed
                </p>
              </div>

              {/* Personal Phone Number */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Personal Phone Number
                </label>
                <input
                  type="tel"
                  value={editedMember.personal_phone || ''}
                  onChange={(e) => setEditedMember({ ...editedMember, personal_phone: e.target.value })}
                  placeholder="e.g. +919876543210"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>

              {/* Designation */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Designation *
                </label>
                <input
                  type="text"
                  value={editedMember.designation || ''}
                  onChange={(e) => setEditedMember({ ...editedMember, designation: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  required
                />
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Company/Organization *
                </label>
                <input
                  type="text"
                  value={editedMember.company || ''}
                  onChange={(e) => setEditedMember({ ...editedMember, company: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  required
                />
              </div>

              {/* Area of Expertise */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Area of Expertise
                </label>
                <input
                  type="text"
                  value={editedMember.area_of_expertise || ''}
                  onChange={(e) => setEditedMember({ ...editedMember, area_of_expertise: e.target.value })}
                  placeholder="e.g., Cloud Architecture, Cybersecurity, AI/ML"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Location
                </label>
                <textarea
                  value={editedMember.location || ''}
                  onChange={(e) => setEditedMember({ ...editedMember, location: e.target.value })}
                  rows="3"
                  placeholder="City, State"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
                />
              </div>

              {/* PIN Section Toggle */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <button
                  type="button"
                  onClick={() => setShowPinSection(!showPinSection)}
                  className="flex items-center gap-2 text-primary hover:text-primary/80 font-semibold text-sm"
                >
                  <span className="material-symbols-outlined text-lg">{showPinSection ? 'expand_less' : 'expand_more'}</span>
                  {showPinSection ? 'Hide' : 'Create'} PIN for Portal Login
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Create a 4 digit PIN to secure your account login
                </p>
              </div>

              {/* PIN Creation Fields */}
              {showPinSection && (
                <div className="space-y-4 bg-primary/5 dark:bg-primary/10 p-4 rounded-lg border border-primary/20">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Create PIN (4 digits) *
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        lock
                      </span>
                      <input
                        type="password"
                        value={pin}
                        onChange={(e) => {
                          const val = e.target.value
                          if (/^\d*$/.test(val)) setPin(val)
                        }}
                        placeholder="Enter 4 digit PIN"
                        maxLength="4"
                        className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary tracking-widest"
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      PIN should be 4 digits (numbers only)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Confirm PIN *
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        lock_check
                      </span>
                      <input
                        type="password"
                        value={confirmPin}
                        onChange={(e) => {
                          const val = e.target.value
                          if (/^\d*$/.test(val)) setConfirmPin(val)
                        }}
                        placeholder="Re-enter PIN"
                        maxLength="4"
                        className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary tracking-widest"
                      />
                    </div>
                    {pin && confirmPin && pin === confirmPin && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        PINs match
                      </p>
                    )}
                    {pin && confirmPin && pin !== confirmPin && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">error</span>
                        PINs do not match
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold py-3 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98]"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                <span className="material-symbols-outlined text-lg">info</span>
                <p>
                  Your profile information is used for event registrations and member directory. 
                  Keep it updated to stay connected with the ITLC community.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-slate-500 dark:text-slate-400">
          <p>© 2026 IT Leaders Community Kerala. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
