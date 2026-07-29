import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import { memberService } from '../services/memberService'

export default function MembershipRegistrationForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isPublicRoute = location.pathname.startsWith('/public')
  
  // Extract event and phone from query params
  const eventId = searchParams.get('event')
  const phoneParam = searchParams.get('phone')
  
  const [event, setEvent] = useState(null)
  const [eventLoading, setEventLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    salutation: '',
    fullName: '',
    countryCode: '+91',
    phoneNumber: phoneParam ? phoneParam.replace(/\D/g, '').slice(-10) : '',
    personalCountryCode: '+91',
    personalPhoneNumber: '',
    professionalEmail: '',
    personalEmail: '',
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
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' })

  // Fetch event details if eventId is provided
  useEffect(() => {
    if (eventId) {
      const fetchEvent = async () => {
        try {
          setEventLoading(true)
          const { data, error } = await supabase
            .from('events')
            .select('id, title, description, date, time, capacity')
            .eq('id', eventId)
            .maybeSingle()
          
          if (error) throw error
          setEvent(data)
        } catch (error) {
          console.error('Error fetching event:', error)
        } finally {
          setEventLoading(false)
        }
      }
      
      fetchEvent()
    }
  }, [eventId])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'error' })
    }, 2800)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Please upload a valid image file.')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
        setFormData(prev => ({ ...prev, profileImage: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImagePreview(null)
    setFormData(prev => ({ ...prev, profileImage: null }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const cleanPhone = String(formData.phoneNumber || '').replace(/\D/g, '')
    if (!formData.profileImage) {
      showToast('Upload Profile Photo')
      return
    }
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      showToast('Enter Valid Professional Phone Number')
      return
    }
    if (!formData.professionalEmail) {
      showToast('Enter Mandatory Professional/Work Email')
      return
    }

    const proPhone = `${formData.countryCode}${formData.phoneNumber}`
    const persPhone = formData.personalPhoneNumber ? `${formData.personalCountryCode}${formData.personalPhoneNumber}` : null
    const proEmail = formData.professionalEmail
    const persEmail = formData.personalEmail || null

    setLoading(true)
    
    try {
      const newMember = await memberService.registerMember({
        salutation: formData.salutation,
        full_name: formData.fullName,
        phone_number: proPhone,
        professional_phone: proPhone,
        personal_phone: persPhone,
        email: proEmail,
        professional_email: proEmail,
        personal_email: persEmail,
        designation: formData.currentDesignation,
        company: formData.currentCompany,
        industry_sector: formData.industrySector,
        industry_type: formData.industryType,
        industry_category: formData.industryCategory,
        industry_sub_category: formData.industrySubCategory,
        country_of_work: formData.countryOfWork,
        location: formData.currentWorkLocation,
        itlc_chapter_name: formData.itlcChapterName,
        years_of_experience: formData.yearsOfExperience,
        date_of_birth: formData.dateOfBirth,
        area_of_expertise: formData.areaOfExpertise,
        profile_image: formData.profileImage,
        status: 'pending'
      })
      
      // If this was an event registration request, create event registration record
      if (eventId && newMember && newMember.id) {
        try {
          await eventService.registerForEvent({
            eventId: eventId,
            memberId: newMember.id,
            status: 'pending'
          })
        } catch (regError) {
          console.error('Error creating event registration:', regError)
          // Don't throw - member was created successfully
        }
      }
      
      const source = isPublicRoute ? 'public' : 'app'
      navigate(`/thanks?type=membership&source=${source}`)
    } catch (error) {
      console.error('Error submitting form:', error)
      showToast('Error submitting application. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-[430px] mx-auto bg-background-light dark:bg-background-dark shadow-2xl">
      {toast.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold bg-red-600 text-white">
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
        {!isPublicRoute && (
          <button 
            onClick={() => navigate(-1)}
            className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        <h2 className={`text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center ${!isPublicRoute ? 'pr-12' : ''}`}>
          Membership Registration
        </h2>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="pt-6 pb-4">
          {event ? (
            <>
              <h1 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">
                Join <span className="text-primary">{event.title}</span>
              </h1>
              <p className="text-slate-600 dark:text-slate-300 text-sm mt-2 bg-primary/10 dark:bg-primary/20 p-3 rounded-lg">
                Complete your membership registration to join this event.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">
                Community Member Details
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Join our network of professionals and experts.
              </p>
            </>
          )}
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Profile Picture Upload */}
          <div className="flex flex-col items-center py-4">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold mb-2">Upload Your Single Photo <span className="text-red-500">*</span></label>
            <div className="relative group">
              {imagePreview ? (
                <div className="size-24 rounded-full overflow-hidden ring-4 ring-primary/20">
                  <img src={imagePreview} alt="Profile preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-white text-2xl">delete</span>
                  </button>
                </div>
              ) : (
                <label className="size-24 rounded-full bg-primary/10 dark:bg-primary/20 border-2 border-dashed border-primary flex items-center justify-center text-primary overflow-hidden cursor-pointer hover:bg-primary/20 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <span className="material-symbols-outlined text-4xl">add_a_photo</span>
                </label>
              )}
              {imagePreview && (
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -bottom-1 -right-1 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm block">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Input: Salutation */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Salutation <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                person
              </span>
              <select
                name="salutation"
                value={formData.salutation}
                onChange={handleChange}
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

          {/* Input: Full Name */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Full Name <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                badge
              </span>
              <input
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                placeholder="e.g. SREEJITH VS"
                type="text"
                required
              />
            </div>
          </div>

          {/* Input: Professional/Work Phone Number */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Professional/Work Phone Number <span className="text-red-500">*</span></label>
            <div className="relative flex gap-2">
              <div className="relative flex-shrink-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl z-10">
                  call
                </span>
                <select
                  name="countryCode"
                  value={formData.countryCode}
                  onChange={handleChange}
                  className="pl-10 pr-3 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none appearance-none cursor-pointer font-medium"
                  style={{ minWidth: '110px' }}
                >
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+974">🇶🇦 +974</option>
                  <option value="+965">🇰🇼 +965</option>
                  <option value="+968">🇴🇲 +968</option>
                  <option value="+966">🇸🇦 +966</option>
                  <option value="+60">🇲🇾 +60</option>
                  <option value="+65">🇸🇬 +65</option>
                </select>
              </div>
              <input
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                className="flex-1 px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                placeholder="Work phone number"
                type="tel"
                pattern="[0-9]+"
                required
              />
            </div>
          </div>

          {/* Input: Personal Phone Number */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Personal Phone Number</label>
            <div className="relative flex gap-2">
              <div className="relative flex-shrink-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl z-10">
                  phone_iphone
                </span>
                <select
                  name="personalCountryCode"
                  value={formData.personalCountryCode}
                  onChange={handleChange}
                  className="pl-10 pr-3 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none appearance-none cursor-pointer font-medium"
                  style={{ minWidth: '110px' }}
                >
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+974">🇶🇦 +974</option>
                  <option value="+965">🇰🇼 +965</option>
                  <option value="+968">🇴🇲 +968</option>
                  <option value="+966">🇸🇦 +966</option>
                  <option value="+60">🇲🇾 +60</option>
                  <option value="+65">🇸🇬 +65</option>
                </select>
              </div>
              <input
                name="personalPhoneNumber"
                value={formData.personalPhoneNumber}
                onChange={handleChange}
                className="flex-1 px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                placeholder="Personal phone number"
                type="tel"
                pattern="[0-9]+"
              />
            </div>
          </div>

          {/* Input: Professional/Work Email */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Professional/Work Email <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                work
              </span>
              <input
                name="professionalEmail"
                value={formData.professionalEmail}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                placeholder="work@company.com"
                type="email"
                required
              />
            </div>
          </div>

          {/* Input: Personal Email */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Personal Email</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                mail
              </span>
              <input
                name="personalEmail"
                value={formData.personalEmail}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                placeholder="personal@example.com"
                type="email"
              />
            </div>
          </div>

          {/* Input: Current Designation */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Current Designation <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                work
              </span>
              <input
                name="currentDesignation"
                value={formData.currentDesignation}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                placeholder="e.g. PROJECT MANAGER"
                type="text"
                required
              />
            </div>
          </div>

          {/* Input: Current Company Name */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Current Company Name <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                business
              </span>
              <input
                name="currentCompany"
                value={formData.currentCompany}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                placeholder="e.g. GRAVITY INNOVATIVE SOLUTIONS"
                type="text"
                required
              />
            </div>
          </div>

          {/* Input: Industry Sector */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Industry Sector <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                apartment
              </span>
              <select
                name="industrySector"
                value={formData.industrySector}
                onChange={handleChange}
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

          {/* Input: Industry Type */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Industry Type <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                category
              </span>
              <select
                name="industryType"
                value={formData.industryType}
                onChange={handleChange}
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

          {/* Input: Industry Category */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Industry Category <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                view_list
              </span>
              <select
                name="industryCategory"
                value={formData.industryCategory}
                onChange={handleChange}
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

          {/* Input: Industry Sub Category */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Industry Sub Category</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                subdirectory_arrow_right
              </span>
              <input
                name="industrySubCategory"
                value={formData.industrySubCategory}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                placeholder="e.g. SOFTWARE DEVELOPEMENT SERVICES"
                type="text"
              />
            </div>
          </div>

          {/* Input: Country of Current Work Location */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Country of Current Work Location <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                public
              </span>
              <input
                name="countryOfWork"
                value={formData.countryOfWork}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                placeholder="e.g. India"
                type="text"
                required
              />
            </div>
          </div>

          {/* Input: Current Work Location */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Current Work Location <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                location_on
              </span>
              <input
                name="currentWorkLocation"
                value={formData.currentWorkLocation}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                placeholder="e.g. THRISSUR"
                type="text"
                required
              />
            </div>
          </div>

          {/* Input: ITLC Chapter Name */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">ITLC Chapter Name <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                groups
              </span>
              <select
                name="itlcChapterName"
                value={formData.itlcChapterName}
                onChange={handleChange}
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

          {/* Input: Total Years of Experience */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Total Years of Experience <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                workspace_premium
              </span>
              <input
                name="yearsOfExperience"
                value={formData.yearsOfExperience}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                placeholder="e.g. 13"
                type="number"
                min="0"
                required
              />
            </div>
          </div>

          {/* Input: Date of Birth */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Date of Birth <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                cake
              </span>
              <input
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none"
                type="date"
                required
              />
            </div>
          </div>

          {/* Input: Area of Expertise */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold">Area of Expertise <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                psychology
              </span>
              <input
                name="areaOfExpertise"
                value={formData.areaOfExpertise}
                onChange={handleChange}
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
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </main>

      {/* Bottom Navigation Bar */}
      {!isPublicRoute && <BottomNav />}
    </div>
  )
}
