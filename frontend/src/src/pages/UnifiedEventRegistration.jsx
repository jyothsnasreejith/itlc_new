import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatErrorMessage } from '../utils/errorHandler'
import BottomNav from '../components/BottomNav'

export default function UnifiedEventRegistration() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // State for step tracking
  const [step, setStep] = useState('choice') // 'choice', 'member-form', 'guest-form'
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' })

  // Member registration form state
  const [memberFormData, setMemberFormData] = useState({
    salutation: '',
    fullName: '',
    countryCode: '+91',
    phoneNumber: '',
    email: '',
    currentDesignation: '',
    currentCompany: '',
    industrySector: '',
    industryType: '',
    industryCategory: '',
    industrySubCategory: '',
    countryOfWork: '',
    currentWorkLocation: '',
    itlcChapterName: '',
    yearsOfExperience: '',
    dateOfBirth: '',
    areaOfExpertise: '',
    profileImage: null
  })
  const [imagePreview, setImagePreview] = useState(null)

  // Non-member registration form state
  const [guestFormData, setGuestFormData] = useState({
    salutation: '',
    fullName: '',
    countryCode: '+91',
    phoneNumber: '',
    email: '',
    designation: '',
    company: '',
    industrySector: '',
    industryType: '',
    industryCategory: '',
    industrySubCategory: '',
    countryOfWork: '',
    location: '',
    yearsOfExperience: '',
    dateOfBirth: '',
    areaOfExpertise: '',
    profileImage: null
  })
  const [guestImagePreview, setGuestImagePreview] = useState(null)

  useEffect(() => {
    const phone = searchParams.get('phone') || ''
    const digits = phone.replace(/\D/g, '')
    const cleanedPhone = digits.length > 10 ? digits.slice(-10) : digits

    if (cleanedPhone) {
      setGuestFormData(prev => ({ ...prev, phoneNumber: cleanedPhone }))
      setMemberFormData(prev => ({ ...prev, phoneNumber: cleanedPhone }))
    }
  }, [searchParams])

  useEffect(() => {
    fetchEvent()
  }, [eventId])

  async function fetchEvent() {
    setLoading(true)
    try {
      const { data: eventData, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (error) throw error
      setEvent(eventData)
    } catch (error) {
      console.error('Error fetching event:', error)
      showToast('Unable to load event details')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'error' })
    }, 6000)
  }

  // Member form handlers
  const handleMemberChange = (e) => {
    const { name, value } = e.target
    setMemberFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleMemberImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Please upload a valid image file.')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
        setMemberFormData(prev => ({ ...prev, profileImage: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const removeMemberImage = () => {
    setImagePreview(null)
    setMemberFormData(prev => ({ ...prev, profileImage: null }))
  }

  // Non-member form handlers
  const handleGuestChange = (e) => {
    const { name, value } = e.target
    setGuestFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleGuestImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Please upload a valid image file.')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setGuestImagePreview(reader.result)
        setGuestFormData(prev => ({ ...prev, profileImage: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const removeGuestImage = () => {
    setGuestImagePreview(null)
    setGuestFormData(prev => ({ ...prev, profileImage: null }))
  }

  // Open Razorpay checkout and return payment result
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
        amount: Math.round(amount * 100), // paise
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

  // Submit handlers
  async function handleMemberSubmit(e) {
    e.preventDefault()

    const cleanPhone = String(memberFormData.phoneNumber || '').replace(/\D/g, '')
    if (!memberFormData.profileImage) {
      showToast('Upload Profile Photo')
      return
    }
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      showToast('Enter Valid Phone Number')
      return
    }

    setSubmitting(true)

    try {
      // Handle Razorpay payment if event has a fee
      let paymentId = null
      let paymentAmount = null
      let paymentStatus = 'not_required'

      if (event?.fee && event.fee > 0) {
        try {
          const paymentResponse = await openRazorpayCheckout({
            amount: event.fee,
            name: memberFormData.fullName,
            email: memberFormData.email,
            contact: `${memberFormData.countryCode}${memberFormData.phoneNumber}`,
            description: `Registration fee for ${event.title}`
          })
          paymentId = paymentResponse.razorpay_payment_id
          paymentAmount = event.fee
          paymentStatus = 'paid'
        } catch (payErr) {
          showToast(payErr.message === 'Payment cancelled' ? 'Payment cancelled. Registration not submitted.' : `Payment failed: ${payErr.message}`)
          setSubmitting(false)
          return
        }
      }

      // Create member record
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .insert([
          {
            salutation: memberFormData.salutation,
            full_name: memberFormData.fullName,
            phone_number: `${memberFormData.countryCode}${memberFormData.phoneNumber}`,
            email: memberFormData.email,
            designation: memberFormData.currentDesignation,
            company: memberFormData.currentCompany,
            industry_sector: memberFormData.industrySector,
            industry_type: memberFormData.industryType,
            industry_category: memberFormData.industryCategory,
            industry_sub_category: memberFormData.industrySubCategory,
            country_of_work: memberFormData.countryOfWork,
            location: memberFormData.currentWorkLocation,
            itlc_chapter_name: memberFormData.itlcChapterName,
            years_of_experience: memberFormData.yearsOfExperience,
            date_of_birth: memberFormData.dateOfBirth,
            area_of_expertise: memberFormData.areaOfExpertise,
            profile_image: memberFormData.profileImage,
            status: 'pending'
          }
        ])
        .select()

      if (memberError) throw memberError

      // Create event registration
      if (memberData && memberData.length > 0) {
        const newMemberId = memberData[0].id
        const { error: regError } = await supabase
          .from('event_registrations')
          .insert([
            {
              event_id: eventId,
              member_id: newMemberId,
              status: 'pending',
              registration_date: new Date().toISOString(),
              payment_status: paymentStatus,
              payment_id: paymentId,
              payment_amount: paymentAmount
            }
          ])

        if (regError) {
          console.error('Error creating event registration:', regError)
        }
      }

      navigate(`/thanks?type=membership&source=app`)
    } catch (error) {
      console.error('Error submitting form:', error)
      showToast(formatErrorMessage(error, 'Error submitting application. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGuestSubmit(e) {
    e.preventDefault()

    const cleanPhone = String(guestFormData.phoneNumber || '').replace(/\D/g, '')
    if (!guestFormData.salutation) { showToast('Salutation is required'); return }
    if (!guestFormData.fullName.trim()) { showToast('Full Name is required'); return }
    if (cleanPhone.length < 8 || cleanPhone.length > 15) { showToast('Enter Valid Phone Number'); return }
    if (!guestFormData.email.trim()) { showToast('Email is required'); return }
    if (!guestFormData.designation.trim()) { showToast('Designation is required'); return }
    if (!guestFormData.company.trim()) { showToast('Company Name is required'); return }
    if (!guestFormData.industrySector) { showToast('Industry Sector is required'); return }
    if (!guestFormData.industryType) { showToast('Industry Type is required'); return }
    if (!guestFormData.industryCategory) { showToast('Industry Category is required'); return }
    if (!guestFormData.countryOfWork.trim()) { showToast('Country of Work is required'); return }
    if (!guestFormData.location.trim()) { showToast('Work Location is required'); return }
    if (!guestFormData.yearsOfExperience) { showToast('Years of Experience is required'); return }
    if (!guestFormData.dateOfBirth) { showToast('Date of Birth is required'); return }
    if (!guestFormData.areaOfExpertise.trim()) { showToast('Area of Expertise is required'); return }

    setSubmitting(true)

    try {
      let paymentId = null
      let paymentAmount = null
      let paymentStatus = 'not_required'

      if (event?.fee && event.fee > 0) {
        try {
          const paymentResponse = await openRazorpayCheckout({
            amount: event.fee,
            name: guestFormData.fullName,
            email: guestFormData.email,
            contact: `${guestFormData.countryCode}${guestFormData.phoneNumber}`,
            description: `Registration fee for ${event.title}`
          })
          paymentId = paymentResponse.razorpay_payment_id
          paymentAmount = event.fee
          paymentStatus = 'paid'
        } catch (payErr) {
          showToast(payErr.message === 'Payment cancelled' ? 'Payment cancelled. Registration not submitted.' : `Payment failed: ${payErr.message}`)
          setSubmitting(false)
          return
        }
      }

      // Create event registration as non-member (no ITLC membership created)
      const { error: regError } = await supabase
        .from('event_registrations')
        .insert([
          {
            event_id: eventId,
            registration_type: 'non_member',
            guest_name: guestFormData.fullName,
            guest_designation: guestFormData.designation,
            guest_email: guestFormData.email,
            guest_phone: `${guestFormData.countryCode}${guestFormData.phoneNumber}`,
            guest_salutation: guestFormData.salutation,
            guest_company: guestFormData.company,
            guest_industry_sector: guestFormData.industrySector,
            guest_industry_type: guestFormData.industryType,
            guest_industry_category: guestFormData.industryCategory,
            guest_industry_sub_category: guestFormData.industrySubCategory || null,
            guest_country_of_work: guestFormData.countryOfWork,
            guest_location: guestFormData.location,
            guest_years_of_experience: guestFormData.yearsOfExperience,
            guest_date_of_birth: guestFormData.dateOfBirth,
            guest_area_of_expertise: guestFormData.areaOfExpertise,
            guest_profile_image: guestFormData.profileImage || null,
            status: 'approved',
            registration_date: new Date().toISOString(),
            payment_status: paymentStatus,
            payment_id: paymentId,
            payment_amount: paymentAmount
          }
        ])

      if (regError) throw regError

      navigate(`/thanks?type=event&source=app`)
    } catch (error) {
      console.error('Error creating event registration:', error)
      showToast(formatErrorMessage(error, 'Error submitting registration. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  // If event is not found (after loading)
  if (!loading && !event) {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col gap-4 p-4">
        <span className="material-symbols-outlined text-slate-400 text-6xl">event_busy</span>
        <div className="text-center">
          <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold mb-2">Event Not Found</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            The event you're looking for doesn't exist.
          </p>
          <button 
            onClick={() => navigate('/events')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Go to Events
          </button>
        </div>
      </div>
    )
  }

  // Choice step
  if (step === 'choice') {
    return (
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-[430px] mx-auto bg-background-light dark:bg-background-dark shadow-2xl">
        {toast.show && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold bg-red-600 text-white">
            {toast.message}
          </div>
        )}

        {/* Header */}
        <header className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => navigate(-1)}
            className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
            Register for Event
          </h2>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-4 pb-24">
          <div className="pt-6 pb-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl mb-4">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5">info</span>
              <div>
                <p className="text-amber-900 dark:text-amber-100 font-bold text-sm mb-1">
                  You are not a registered IT Leaders Community (ITLC) member.
                </p>
                <p className="text-amber-800 dark:text-amber-200 text-sm">
                  To participate in this event, you can either become an ITLC member or continue as a non-member.
                </p>
              </div>
            </div>
            <h1 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight">
              How would you like to register for <span className="text-primary">{loading ? 'this event' : event?.title || 'this event'}</span>?
            </h1>
            {!loading && event?.fee > 0 && (
              <div className="mt-3 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-lg">payments</span>
                <p className="text-amber-800 dark:text-amber-200 text-sm font-semibold">
                  Registration Fee: ₹{Number(event.fee).toLocaleString('en-IN')}
                </p>
              </div>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {!loading && (
            <div className="space-y-4">
              {/* Yes - Member Card */}
              <div
                onClick={() => setStep('member-form')}
                className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary bg-white dark:bg-slate-800 cursor-pointer transition-all hover:shadow-lg"
              >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-xl">check_circle</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1">
                    Register as ITLC Member
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                    Complete your membership profile and join our community of IT leaders
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs">done</span>
                      Get a digital member ID card
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs">done</span>
                      Access exclusive member benefits
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs">done</span>
                      Network with IT professionals
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* No - Guest Card */}
            <div
              onClick={() => setStep('guest-form')}
              className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary bg-white dark:bg-slate-800 cursor-pointer transition-all hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">person</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1">
                    Event Registration Only
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                    Register for this event as a non-member without joining ITLC
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs">done</span>
                      Attend this event without membership
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs">done</span>
                      Immediate event confirmation
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs">done</span>
                      Receive event updates via email
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            </div>
          )}
        </main>

      </div>
    )
  }

  // Member form step
  if (step === 'member-form') {
    return (
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-[430px] mx-auto bg-background-light dark:bg-background-dark shadow-2xl">
        {toast.show && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold bg-red-600 text-white">
            {toast.message}
          </div>
        )}

        {/* Header */}
        <header className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => setStep('choice')}
            className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
            Join ITLC Community
          </h2>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-4 pb-24">
          <div className="pt-6 pb-4">
            <h1 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">
              Complete Your Profile
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-sm mt-2 bg-primary/10 dark:bg-primary/20 p-3 rounded-lg">
              Fill in your details to join <span className="font-semibold">{event.title}</span> and become an ITLC member.
            </p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleMemberSubmit} className="space-y-5">
            {/* Profile Picture Upload */}
            <div className="flex flex-col items-center py-4">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold mb-2">Upload Your Single Photo <span className="text-red-500">*</span></label>
              <div className="relative group">
                {imagePreview ? (
                  <div className="size-24 rounded-full overflow-hidden ring-4 ring-primary/20">
                    <img src={imagePreview} alt="Profile preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <label className="size-24 rounded-full bg-primary/10 dark:bg-primary/20 border-2 border-dashed border-primary flex items-center justify-center text-primary overflow-hidden cursor-pointer hover:bg-primary/20 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMemberImageUpload}
                      className="hidden"
                    />
                    <span className="material-symbols-outlined text-4xl">add_a_photo</span>
                  </label>
                )}
                {imagePreview && (
                  <button
                    type="button"
                    onClick={removeMemberImage}
                    className="absolute -bottom-1 -right-1 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm block">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Salutation */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Salutation <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">person</span>
                <select
                  name="salutation"
                  value={memberFormData.salutation}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  required
                >
                  <option value="">Select Salutation</option>
                  <option value="Mr">Mr</option>
                  <option value="Mrs">Mrs</option>
                  <option value="Ms">Ms</option>
                  <option value="Dr">Dr</option>
                  <option value="Prof">Prof</option>
                </select>
              </div>
            </div>

            {/* Full Name */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Full Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">badge</span>
                <input
                  name="fullName"
                  value={memberFormData.fullName}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. JOHN DOE"
                  type="text"
                  required
                />
              </div>
            </div>

            {/* Phone Number */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Phone Number <span className="text-red-500">*</span></label>
              <div className="relative flex gap-2">
                <div className="relative flex-shrink-0">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl z-10">call</span>
                  <select
                    name="countryCode"
                    value={memberFormData.countryCode}
                    onChange={handleMemberChange}
                    className="pl-10 pr-3 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none appearance-none cursor-pointer font-medium"
                    style={{ minWidth: '110px' }}
                  >
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+61">🇦🇺 +61</option>
                    <option value="+971">🇦🇪 +971</option>
                  </select>
                </div>
                <input
                  name="phoneNumber"
                  value={memberFormData.phoneNumber}
                  onChange={handleMemberChange}
                  className="flex-1 px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="9876543210"
                  type="tel"
                  pattern="[0-9]+"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Email Address <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">mail</span>
                <input
                  name="email"
                  value={memberFormData.email}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="john@example.com"
                  type="email"
                  required
                />
              </div>
            </div>

            {/* Designation */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Current Designation <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">work</span>
                <input
                  name="currentDesignation"
                  value={memberFormData.currentDesignation}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. PROJECT MANAGER"
                  type="text"
                  required
                />
              </div>
            </div>

            {/* Company */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Current Company Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">business</span>
                <input
                  name="currentCompany"
                  value={memberFormData.currentCompany}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. TECH SOLUTIONS"
                  type="text"
                  required
                />
              </div>
            </div>

            {/* Industry Sector */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Industry Sector <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">apartment</span>
                <select
                  name="industrySector"
                  value={memberFormData.industrySector}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  required
                >
                  <option value="">Select Industry Sector</option>
                  <option value="Private">Private</option>
                  <option value="PSU">PSU</option>
                  <option value="Government">Government</option>
                </select>
              </div>
            </div>

            {/* Industry Type */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Industry Type <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">category</span>
                <select
                  name="industryType"
                  value={memberFormData.industryType}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  required
                >
                  <option value="">Select Industry Type</option>
                  <option value="Financial">Financial</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Media">Media</option>
                  <option value="Services">Services</option>
                  <option value="Consultancy">Consultancy</option>
                  <option value="Retail">Retail</option>
                  <option value="Training">Training</option>
                  <option value="Trading">Trading</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Industry Category */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Industry Category <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">view_list</span>
                <select
                  name="industryCategory"
                  value={memberFormData.industryCategory}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  required
                >
                  <option value="">Select Industry Category</option>
                  <option value="Automobile">Automobile</option>
                  <option value="Finance">Finance</option>
                  <option value="Food">Food</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Hospitality">Hospitality</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Media (News Paper/TV/Radio)">Media (News Paper/TV/Radio)</option>
                  <option value="IT">IT</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Industry Sub Category */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Industry Sub Category</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">subdirectory_arrow_right</span>
                <input
                  name="industrySubCategory"
                  value={memberFormData.industrySubCategory}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. SOFTWARE DEVELOPMENT"
                  type="text"
                />
              </div>
            </div>

            {/* Country of Work */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Country of Current Work Location <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">public</span>
                <input
                  name="countryOfWork"
                  value={memberFormData.countryOfWork}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. India"
                  type="text"
                  required
                />
              </div>
            </div>

            {/* Work Location */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Current Work Location <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">location_on</span>
                <input
                  name="currentWorkLocation"
                  value={memberFormData.currentWorkLocation}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. KOCHI"
                  type="text"
                  required
                />
              </div>
            </div>

            {/* ITLC Chapter */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">ITLC Chapter Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">groups</span>
                <select
                  name="itlcChapterName"
                  value={memberFormData.itlcChapterName}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  required
                >
                  <option value="">Select ITLC Chapter</option>
                  <option value="Kochi">Kochi</option>
                  <option value="Thiruvananthapuram">Thiruvananthapuram</option>
                  <option value="Kozhikode">Kozhikode</option>
                  <option value="Bengaluru">Bengaluru</option>
                  <option value="Other Indian Cities">Other Indian Cities</option>
                  <option value="Overseas">Overseas</option>
                </select>
              </div>
            </div>

            {/* Years of Experience */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Total Years of Experience <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">workspace_premium</span>
                <input
                  name="yearsOfExperience"
                  value={memberFormData.yearsOfExperience}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. 13"
                  type="number"
                  min="0"
                  required
                />
              </div>
            </div>

            {/* Date of Birth */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Date of Birth <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">cake</span>
                <input
                  name="dateOfBirth"
                  value={memberFormData.dateOfBirth}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  type="date"
                  required
                />
              </div>
            </div>

            {/* Area of Expertise */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Area of Expertise <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">psychology</span>
                <input
                  name="areaOfExpertise"
                  value={memberFormData.areaOfExpertise}
                  onChange={handleMemberChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. UI/UX, Cloud Architecture"
                  type="text"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Complete Registration & Join ITLC'}
              </button>
            </div>
          </form>
        </main>
      </div>
    )
  }

  // Guest form step
  if (step === 'guest-form') {
    return (
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-[430px] mx-auto bg-background-light dark:bg-background-dark shadow-2xl">
        {toast.show && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold bg-red-600 text-white">
            {toast.message}
          </div>
        )}

        {/* Header */}
        <header className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => setStep('choice')}
            className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
            Event Registration
          </h2>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-4 pb-24">
          <div className="pt-6 pb-4">
            <h1 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">
              Register for <span className="text-primary">{event.title}</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-sm mt-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              Fill in your details to register as a <span className="font-semibold text-blue-700 dark:text-blue-300">Non-Member</span>. This will not create an ITLC membership.
            </p>
          </div>

          <form onSubmit={handleGuestSubmit} className="space-y-5">
            {/* Profile Picture Upload */}
            <div className="flex flex-col items-center py-4">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold mb-2">Upload Your Photo <span className="text-slate-400 text-xs font-normal">(Optional)</span></label>
              <div className="relative group">
                {guestImagePreview ? (
                  <div className="size-24 rounded-full overflow-hidden ring-4 ring-primary/20">
                    <img src={guestImagePreview} alt="Profile preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <label className="size-24 rounded-full bg-primary/10 dark:bg-primary/20 border-2 border-dashed border-primary flex items-center justify-center text-primary overflow-hidden cursor-pointer hover:bg-primary/20 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleGuestImageUpload}
                      className="hidden"
                    />
                    <span className="material-symbols-outlined text-4xl">add_a_photo</span>
                  </label>
                )}
                {guestImagePreview && (
                  <button
                    type="button"
                    onClick={removeGuestImage}
                    className="absolute -bottom-1 -right-1 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm block">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Salutation */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Salutation <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">person</span>
                <select
                  name="salutation"
                  value={guestFormData.salutation}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  required
                >
                  <option value="">Select Salutation</option>
                  <option value="Mr">Mr</option>
                  <option value="Mrs">Mrs</option>
                  <option value="Ms">Ms</option>
                  <option value="Dr">Dr</option>
                  <option value="Prof">Prof</option>
                </select>
              </div>
            </div>

            {/* Full Name */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Full Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">badge</span>
                <input
                  name="fullName"
                  value={guestFormData.fullName}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. JOHN DOE"
                  type="text"
                  required
                />
              </div>
            </div>

            {/* Phone Number */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Phone Number <span className="text-red-500">*</span></label>
              <div className="relative flex gap-2">
                <div className="relative flex-shrink-0">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl z-10">call</span>
                  <select
                    name="countryCode"
                    value={guestFormData.countryCode}
                    onChange={handleGuestChange}
                    className="pl-10 pr-3 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none appearance-none cursor-pointer font-medium"
                    style={{ minWidth: '110px' }}
                  >
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+61">🇦🇺 +61</option>
                    <option value="+971">🇦🇪 +971</option>
                  </select>
                </div>
                <input
                  name="phoneNumber"
                  value={guestFormData.phoneNumber}
                  onChange={handleGuestChange}
                  className="flex-1 px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="9876543210"
                  type="tel"
                  pattern="[0-9]+"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Email Address <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">mail</span>
                <input
                  name="email"
                  value={guestFormData.email}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="john@example.com"
                  type="email"
                  required
                />
              </div>
            </div>

            {/* Designation */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Current Designation <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">work</span>
                <input
                  name="designation"
                  value={guestFormData.designation}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. PROJECT MANAGER"
                  type="text"
                  required
                />
              </div>
            </div>

            {/* Company */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Current Company Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">business</span>
                <input
                  name="company"
                  value={guestFormData.company}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. TECH SOLUTIONS"
                  type="text"
                  required
                />
              </div>
            </div>

            {/* Industry Sector */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Industry Sector <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">apartment</span>
                <select
                  name="industrySector"
                  value={guestFormData.industrySector}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  required
                >
                  <option value="">Select Industry Sector</option>
                  <option value="Private">Private</option>
                  <option value="PSU">PSU</option>
                  <option value="Government">Government</option>
                </select>
              </div>
            </div>

            {/* Industry Type */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Industry Type <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">category</span>
                <select
                  name="industryType"
                  value={guestFormData.industryType}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  required
                >
                  <option value="">Select Industry Type</option>
                  <option value="Financial">Financial</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Media">Media</option>
                  <option value="Services">Services</option>
                  <option value="Consultancy">Consultancy</option>
                  <option value="Retail">Retail</option>
                  <option value="Training">Training</option>
                  <option value="Trading">Trading</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Industry Category */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Industry Category <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">view_list</span>
                <select
                  name="industryCategory"
                  value={guestFormData.industryCategory}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  required
                >
                  <option value="">Select Industry Category</option>
                  <option value="Automobile">Automobile</option>
                  <option value="Finance">Finance</option>
                  <option value="Food">Food</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Hospitality">Hospitality</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Media (News Paper/TV/Radio)">Media (News Paper/TV/Radio)</option>
                  <option value="IT">IT</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Industry Sub Category */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Industry Sub Category</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">subdirectory_arrow_right</span>
                <input
                  name="industrySubCategory"
                  value={guestFormData.industrySubCategory}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. SOFTWARE DEVELOPMENT"
                  type="text"
                />
              </div>
            </div>

            {/* Country of Work */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Country of Current Work Location <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">public</span>
                <input
                  name="countryOfWork"
                  value={guestFormData.countryOfWork}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. India"
                  type="text"
                  required
                />
              </div>
            </div>

            {/* Work Location / City */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Current Work Location <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">location_on</span>
                <input
                  name="location"
                  value={guestFormData.location}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. KOCHI"
                  type="text"
                  required
                />
              </div>
            </div>

            {/* Years of Experience */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Total Years of Experience <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">workspace_premium</span>
                <input
                  name="yearsOfExperience"
                  value={guestFormData.yearsOfExperience}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. 13"
                  type="number"
                  min="0"
                  required
                />
              </div>
            </div>

            {/* Date of Birth */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Date of Birth <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">cake</span>
                <input
                  name="dateOfBirth"
                  value={guestFormData.dateOfBirth}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  type="date"
                  required
                />
              </div>
            </div>

            {/* Area of Expertise */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Area of Expertise <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">psychology</span>
                <input
                  name="areaOfExpertise"
                  value={guestFormData.areaOfExpertise}
                  onChange={handleGuestChange}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                  placeholder="e.g. UI/UX, Cloud Architecture"
                  type="text"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
              >
                {submitting ? 'Registering...' : 'Register for Event (Non-Member)'}
              </button>
            </div>
          </form>
        </main>
      </div>
    )
  }
}
