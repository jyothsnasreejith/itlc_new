import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DEFAULT_EVENT_IMAGE = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80'
const DEFAULT_PAGE_TITLE = 'IT Leaders Community (ITLC)'

export default function EventRegistrationConfirmation() {
  const { eventId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const memberId = searchParams.get('member')
  const token = searchParams.get('token')
  const autoAction = searchParams.get('action') // 'accept' or 'decline'

  const [event, setEvent] = useState(null)
  const [member, setMember] = useState(null)
  const [registration, setRegistration] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [autoActionProcessed, setAutoActionProcessed] = useState(false)
  const [showFullModal, setShowFullModal] = useState(false)
  const [step, setStep] = useState('verify-phone') // 'verify-phone', 'confirm', or 'register'
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)
  const [registrationStats, setRegistrationStats] = useState({
    approved: 0,
    rejected: 0,
    total: 0,
  })
  const [customLogo, setCustomLogo] = useState('')
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' })
  const [pin, setPin] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editedMember, setEditedMember] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  useEffect(() => {
    loadLogo()
  }, [])

  useEffect(() => {
    if (!event?.title) {
      document.title = DEFAULT_PAGE_TITLE
      return
    }

    const pageTitle = `${event.title} | Event Registration`
    document.title = pageTitle

    const setMetaByName = (name, content) => {
      const el = document.querySelector(`meta[name="${name}"]`)
      if (el) el.setAttribute('content', content)
    }

    const setMetaByProperty = (property, content) => {
      const el = document.querySelector(`meta[property="${property}"]`)
      if (el) el.setAttribute('content', content)
    }

    setMetaByName('title', pageTitle)
    setMetaByProperty('og:title', pageTitle)
    setMetaByName('twitter:title', pageTitle)

    if (event.image) {
      setMetaByProperty('og:image', event.image)
      setMetaByName('twitter:image', event.image)
    }
  }, [event])

  async function loadLogo() {
    try {
      const savedLogo = localStorage.getItem('customLogo')
      if (savedLogo) {
        setCustomLogo(savedLogo)
        return
      }

      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'custom_logo')
        .maybeSingle()

      if (data?.setting_value) {
        setCustomLogo(data.setting_value)
      }
    } catch (logoError) {
      console.error('Error loading logo:', logoError)
    }
  }

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'error' })
    }, 2800)
  }

  // Fetch event on mount
  useEffect(() => {
    fetchEvent()
  }, [eventId])

  // If member ID provided in URL, fetch all data
  useEffect(() => {
    if (eventId && memberId) {
      fetchData()
    } else if (eventId && !memberId) {
      // No member ID, start with phone verification
      setStep('verify-phone')
      setLoading(false)
    }
  }, [eventId, memberId])

  async function fetchEvent() {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (eventError) throw eventError
      setEvent(eventData)
      fetchRegistrationStats(eventId)
    } catch (error) {
      console.error('Error fetching event:', error)
      setError('Unable to load event details')
    }
  }

  async function fetchRegistrationStats(currentEventId) {
    try {
      setLoadingStats(true)
      const { count: totalCount, error: totalError } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', currentEventId)

      const { count: approvedCount, error: approvedError } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', currentEventId)
        .eq('status', 'approved')

      const { count: rejectedCount, error: rejectedError } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', currentEventId)
        .eq('status', 'rejected')

      if (totalError || approvedError || rejectedError) {
        throw totalError || approvedError || rejectedError
      }

      setRegistrationStats({
        approved: approvedCount || 0,
        rejected: rejectedCount || 0,
        total: totalCount || 0,
      })
    } catch (statsError) {
      console.error('Error fetching registration stats:', statsError)
      setRegistrationStats({ approved: 0, rejected: 0, total: 0 })
    } finally {
      setLoadingStats(false)
    }
  }

  async function handleVerifyPhone(e) {
    e.preventDefault()
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      showToast('Enter Valid Phone Number')
      return
    }
    setPhoneLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('members')
        .select('*')
        .or(`phone_number.eq.${phoneNumber},phone_number.eq.${cleanPhone},phone_number.eq.+91${cleanPhone}`)
        .limit(1)
        .maybeSingle()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      if (data) {
        // Member found
        setMember(data)
        
        // Check if member has a PIN set
        if (data.login_pin) {
          // PIN required - move to PIN verification step
          setPin('')
          setStep('verify-pin')
        } else {
          // No PIN - proceed to confirmation
          const { data: regData, error: regError } = await supabase
            .from('event_registrations')
            .select('*')
            .eq('event_id', eventId)
            .eq('member_id', data.id)
            .maybeSingle()

          if (regError && regError.code !== 'PGRST116') throw regError
          setRegistration(regData)
          setStep('confirm')
        }
      } else {
        // Member not found - redirect to unified registration choice page with phone prefilled
        navigate(`/unified-event-registration/${eventId}?phone=${encodeURIComponent(phoneNumber)}`)
      }
    } catch (err) {
      console.error('Error verifying phone:', err)
      setError('Unable to verify phone number. Please try again.')
      showToast('Unable to verify phone number. Please try again.')
    } finally {
      setPhoneLoading(false)
    }
  }

  async function handleVerifyPin(e) {
    e.preventDefault()
    
    if (!pin || pin.length !== 4) {
      setError('PIN must be exactly 4 digits')
      return
    }

    setPinLoading(true)
    setError(null)

    try {
      if (member.login_pin === pin) {
        // PIN is correct - proceed to confirmation
        const { data: regData, error: regError } = await supabase
          .from('event_registrations')
          .select('*')
          .eq('event_id', eventId)
          .eq('member_id', member.id)
          .maybeSingle()

        if (regError && regError.code !== 'PGRST116') throw regError
        setRegistration(regData)
        setStep('confirm')
      } else {
        setError('Invalid PIN. Please try again.')
        setPin('')
        showToast('Invalid PIN. Please try again.')
      }
    } catch (err) {
      console.error('Error verifying PIN:', err)
      setError('Error verifying PIN. Please try again.')
      showToast('Error verifying PIN. Please try again.')
    } finally {
      setPinLoading(false)
    }
  }

  // Auto-process action from email link
  useEffect(() => {
    if (!loading && !autoActionProcessed && autoAction && event && member) {
      setAutoActionProcessed(true)
      if (autoAction === 'accept') {
        handleResponse('accept', true)
      } else if (autoAction === 'decline') {
        handleResponse('reject', true)
      }
    }
  }, [loading, autoAction, event, member, autoActionProcessed])

  async function fetchData(overrideMemberId = null) {
    try {
      setLoading(true)
      const resolvedMemberId = overrideMemberId || memberId || member?.id

      if (!eventId || !resolvedMemberId) {
        throw new Error('Missing event or member details')
      }

      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (eventError) throw eventError

      // Fetch member details
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('id', resolvedMemberId)
        .single()

      if (memberError) throw memberError

      // Check if registration exists
      const { data: regData, error: regError } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', eventId)
        .eq('member_id', resolvedMemberId)
        .maybeSingle()

      if (regError && regError.code !== 'PGRST116') throw regError

      setEvent(eventData)
      setMember(memberData)
      setRegistration(regData)
      fetchRegistrationStats(eventId)
      setStep('confirm')
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Unable to load registration details')
    } finally {
      setLoading(false)
    }
  }

  async function openRazorpayCheckout({ amount, name, email, contact, description }) {
    // Dynamic script loading
    const loadScript = () => {
      return new Promise((resolve) => {
        if (window.Razorpay) {
          resolve(true)
          return
        }
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
      })
    }

    const scriptLoaded = await loadScript()
    if (!scriptLoaded) {
      throw new Error('Failed to load Razorpay payment gateway script. Please check your internet connection.')
    }

    return new Promise((resolve, reject) => {
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
        amount: Math.round(amount * 100),
        currency: 'INR',
        name: 'IT Leaders Community',
        description: description || 'Event Registration Fee',
        prefill: { name, email, contact },
        theme: { color: '#4F46E5' },
        handler: (response) => resolve(response),
        modal: {
          ondismiss: () => reject(new Error('Payment cancelled'))
        }
      }
      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (response) => reject(new Error(response.error.description)))
      rzp.open()
    })
  }

  async function handleResponse(action, isAutoAction = false) {
    if (!isAutoAction && !confirm(`Are you sure you want to ${action} this event invitation?`)) {
      return
    }

    setProcessing(true)
    try {
      // Check if accepting and event has max registrations limit
      if (action === 'accept' && event.max_registrations) {
        const { data: approvedRegs, error: countError } = await supabase
          .from('event_registrations')
          .select('id')
          .eq('event_id', eventId)
          .eq('status', 'approved')

        if (countError) throw countError

        const isAlreadyApproved = registration && registration.status === 'approved'
        const currentApprovedCount = isAlreadyApproved
          ? approvedRegs.length - 1
          : approvedRegs.length

        if (currentApprovedCount >= event.max_registrations) {
          setError('Event is at maximum capacity')
          setShowFullModal(true)
          setProcessing(false)
          return
        }
      }

      // Handle Razorpay payment when accepting a paid event
      let paymentId = null
      let paymentAmount = null
      let paymentStatus = 'not_required'

      if (action === 'accept' && event?.fee && event.fee > 0) {
        // Skip payment if already paid
        const alreadyPaid = registration?.payment_status === 'paid'
        if (!alreadyPaid) {
          setProcessing(false)
          try {
            const paymentResponse = await openRazorpayCheckout({
              amount: event.fee,
              name: member?.full_name || '',
              email: member?.email || '',
              contact: member?.phone_number || '',
              description: `Registration fee for ${event.title}`
            })
            paymentId = paymentResponse.razorpay_payment_id
            paymentAmount = event.fee
            paymentStatus = 'paid'
          } catch (payErr) {
            showToast(payErr.message === 'Payment cancelled'
              ? 'Payment cancelled. Registration not updated.'
              : `Payment failed: ${payErr.message}`)
            return
          }
          setProcessing(true)
        } else {
          paymentStatus = 'paid'
          paymentId = registration.payment_id
          paymentAmount = registration.payment_amount
        }
      }

      if (registration) {
        const { error } = await supabase
          .from('event_registrations')
          .update({
            status: action === 'accept' ? 'approved' : 'rejected',
            ...(paymentId && { payment_id: paymentId }),
            ...(paymentAmount && { payment_amount: paymentAmount }),
            ...(action === 'accept' && { payment_status: paymentStatus }),
            updated_at: new Date().toISOString()
          })
          .eq('id', registration.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('event_registrations')
          .insert({
            event_id: eventId,
            member_id: member?.id || memberId,
            status: action === 'accept' ? 'approved' : 'rejected',
            payment_status: action === 'accept' ? paymentStatus : 'not_required',
            payment_id: paymentId,
            payment_amount: paymentAmount
          })

        if (error) throw error
      }

      await fetchData(member?.id || memberId)

      if (!isAutoAction) {
        navigate(`/thanks?type=event&action=${action}&source=public`)
      }
    } catch (error) {
      console.error('Error updating registration:', error)
      if (!isAutoAction) {
        showToast('Error processing your response. Please try again.')
      }
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  function handleEditProfile() {
    setEditedMember({ ...member })
    setPhotoPreview(member.profile_image)
    setIsEditingProfile(true)
  }

  function handlePhotoSelect(e) {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB')
        return
      }
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
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

  async function handleSaveProfile() {
    if (!editedMember.full_name || !editedMember.email) {
      showToast('Full Name and Email are required')
      return
    }

    setSavingProfile(true)
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
          photoUrl = photoPreview
        } else {
          const { data: urlData } = supabase.storage
            .from('member-photos')
            .getPublicUrl(filePath)
          photoUrl = urlData.publicUrl
        }
      }

      // Update member profile
      const { error: updateError } = await supabase
        .from('members')
        .update({
          full_name: editedMember.full_name,
          email: editedMember.email,
          designation: editedMember.designation,
          company: editedMember.company,
          location: editedMember.location,
          area_of_expertise: editedMember.area_of_expertise,
          profile_image: photoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', member.id)

      if (updateError) throw updateError

      setMember({ ...editedMember, profile_image: photoUrl })
      setIsEditingProfile(false)
      setSelectedPhoto(null)
      showToast('Profile updated successfully!', 'success')
    } catch (error) {
      console.error('Error updating profile:', error)
      showToast('Failed to update profile. Please try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  function handleCancelEdit() {
    setEditedMember(null)
    setIsEditingProfile(false)
    setSelectedPhoto(null)
    setPhotoPreview(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Invalid Link</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/events')}
            className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  // Phone verification step
  if (step === 'verify-phone') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-8 px-4 flex items-center justify-center">
        {toast.show && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold ${
            toast.type === 'success' 
              ? 'bg-green-600 text-white' 
              : 'bg-red-600 text-white'
          }`}>
            {toast.message}
          </div>
        )}
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 mb-4 overflow-hidden">
                <img src={customLogo || '/itlc-logo.svg'} alt="ITLC Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Event Registration
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {event?.title || 'Join Event'}
              </p>
            </div>

            {/* Phone Verification Form */}
            <form onSubmit={handleVerifyPhone} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter your phone number"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={phoneLoading || !phoneNumber.trim()}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {phoneLoading ? 'Verifying...' : 'Continue'}
              </button>
            </form>

            {/* Info Text */}
            <p className="text-center text-slate-600 dark:text-slate-400 text-sm mt-6">
              Existing ITLC members can join directly. New members will be asked to register.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // PIN verification step
  if (step === 'verify-pin' && member) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 mb-4 overflow-hidden">
                <img src={customLogo || '/itlc-logo.svg'} alt="ITLC Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Verify PIN
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {member.full_name}
              </p>
            </div>

            {/* PIN Verification Form */}
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">
                  PIN <span className="text-red-500">*</span>
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
                    placeholder="Enter your 4 digit PIN"
                    maxLength="4"
                    className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none tracking-widest text-center"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={pinLoading || !pin.trim()}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {pinLoading ? 'Verifying...' : 'Verify PIN'}
              </button>
            </form>

            {/* Back Button */}
            <button
              onClick={() => {
                setStep('verify-phone')
                setPhoneNumber('')
                setPin('')
                setError(null)
              }}
              className="w-full text-center text-slate-600 dark:text-slate-400 text-sm mt-6 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error && step !== 'verify-phone') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Error</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/events')}
            className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  // Confirmation step - member found
  if (step === 'confirm' && member && event) {
    const currentStatus = registration?.status || 'pending'
    const statusText = currentStatus === 'approved' ? 'Accepted' : currentStatus === 'rejected' ? 'Declined' : 'Pending Response'

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-8 px-4">
        {toast.show && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold ${
            toast.type === 'success' 
              ? 'bg-green-600 text-white' 
              : 'bg-red-600 text-white'
          }`}>
            {toast.message}
          </div>
        )}
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-4 overflow-hidden">
              <img src={customLogo || '/itlc-logo.svg'} alt="ITLC Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Event Registration</h1>
            <p className="text-slate-600 dark:text-slate-400">You have been invited to join</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 mb-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">Member</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{member.full_name}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{member.email || member.phone_number}</p>
            <div className="flex gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                <span className="material-symbols-outlined text-slate-700 dark:text-slate-200">info</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{statusText}</span>
              </div>
              <button
                onClick={() => setShowProfileModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary dark:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">person</span>
                <span className="font-semibold text-sm">View Profile</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 mb-6">
            <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <img
                src={event.image || DEFAULT_EVENT_IMAGE}
                alt={event.title}
                className="w-full h-56 object-contain"
              />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">{event.title}</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">{event.description}</p>
            <p className="text-slate-700 dark:text-slate-300"><strong>Date:</strong> {formatDate(event.date)}</p>
            {event.time && <p className="text-slate-700 dark:text-slate-300"><strong>Time:</strong> {event.time}</p>}
            {event.location && <p className="text-slate-700 dark:text-slate-300"><strong>Location:</strong> {event.location}</p>}
            {event.fee > 0 && (
              <div className="mt-4 flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">payments</span>
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wide">Registration Fee</p>
                  <p className="text-xl font-bold text-amber-800 dark:text-amber-200">₹{Number(event.fee).toLocaleString('en-IN')}</p>
                </div>
                {registration?.payment_status === 'paid' && (
                  <span className="ml-auto text-xs font-bold px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">PAID</span>
                )}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Registration Overview</h3>
              {event.max_registrations && (
                <span className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                  {registrationStats.total} / {event.max_registrations} Applications
                </span>
              )}
            </div>

            {loadingStats ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Successful</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{registrationStats.approved}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Rejected</p>
                  <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{registrationStats.rejected}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Total</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{registrationStats.total}</p>
                </div>
              </div>
            )}
          </div>

          {currentStatus === 'pending' ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
              <p className="text-center text-slate-600 dark:text-slate-400 mb-6">Will you be attending this event?</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleResponse('accept')}
                  disabled={processing}
                  className="bg-primary hover:bg-primary/90 text-white font-semibold py-4 px-6 rounded-xl transition-colors disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Accept'}
                </button>
                <button
                  onClick={() => handleResponse('reject')}
                  disabled={processing}
                  className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold py-4 px-6 rounded-xl transition-colors disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Decline'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 text-center">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                You have {currentStatus === 'approved' ? 'accepted' : 'declined'} this invitation.
              </p>
              <div className="flex gap-4 justify-center">
                {currentStatus !== 'approved' && (
                  <button
                    onClick={() => handleResponse('accept')}
                    disabled={processing}
                    className="bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Accept Instead
                  </button>
                )}
                {currentStatus !== 'rejected' && (
                  <button
                    onClick={() => handleResponse('reject')}
                    disabled={processing}
                    className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Decline Instead
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Profile Modal */}
        {showProfileModal && member && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl my-8">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isEditingProfile ? 'Edit Profile' : 'Your Profile'}
                </h2>
                <button
                  onClick={() => {
                    setShowProfileModal(false)
                    handleCancelEdit()
                  }}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Profile Photo */}
                {isEditingProfile ? (
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
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Click camera icon to change photo</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 ring-4 ring-primary/20 mb-4 mx-auto">
                      {member.profile_image ? (
                        <img src={member.profile_image} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-6xl text-slate-400">person</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isEditingProfile ? (
                  // Edit Form
                  <div className="space-y-4">
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
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={editedMember.email || ''}
                        onChange={(e) => setEditedMember({ ...editedMember, email: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                      />
                    </div>

                    {/* Designation */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Designation
                      </label>
                      <input
                        type="text"
                        value={editedMember.designation || ''}
                        onChange={(e) => setEditedMember({ ...editedMember, designation: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                      />
                    </div>

                    {/* Company */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Company/Organization
                      </label>
                      <input
                        type="text"
                        value={editedMember.company || ''}
                        onChange={(e) => setEditedMember({ ...editedMember, company: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
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
                        placeholder="e.g., Cloud Architecture, Cybersecurity"
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
                        rows="2"
                        placeholder="City, State"
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Full Name</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{member.full_name}</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</p>
                      <p className="text-slate-700 dark:text-slate-300">{member.email || 'Not provided'}</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Phone</p>
                      <p className="text-slate-700 dark:text-slate-300">{member.phone_number}</p>
                    </div>

                    {member.designation && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Designation</p>
                        <p className="text-slate-700 dark:text-slate-300">{member.designation}</p>
                      </div>
                    )}

                    {member.company && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Company</p>
                        <p className="text-slate-700 dark:text-slate-300">{member.company}</p>
                      </div>
                    )}

                    {member.area_of_expertise && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Expertise</p>
                        <p className="text-slate-700 dark:text-slate-300">{member.area_of_expertise}</p>
                      </div>
                    )}

                    {member.location && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Location</p>
                        <p className="text-slate-700 dark:text-slate-300">{member.location}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 dark:bg-slate-900 p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                {isEditingProfile ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      disabled={savingProfile}
                      className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 font-bold py-3 rounded-lg transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50"
                    >
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowProfileModal(false)}
                      className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 font-bold py-3 rounded-lg transition-all"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleEditProfile}
                      className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                      Edit Profile
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {showFullModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
              <span className="material-symbols-outlined text-6xl text-amber-500">event_busy</span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-4 mb-4">Registration Full</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                This event has reached maximum capacity. Thank you for your interest.
              </p>
              <button
                onClick={() => navigate('/events')}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Go to Events List
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
