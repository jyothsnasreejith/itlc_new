import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import html2canvas from 'html2canvas'

const BACKEND_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
  : 'http://localhost:5000'

const STYLES_HTML = {
  'classic-gold': { border: 'border-[#C5A880]', bg: 'bg-[#FAF8F5]', text: 'text-[#B45309]', primary: 'text-slate-800' },
  'modern-indigo': { border: 'border-[#4F46E5]', bg: 'bg-[#F8FAFC]', text: 'text-[#4F46E5]', primary: 'text-[#0F172A]' },
  'emerald-mint': { border: 'border-[#059669]', bg: 'bg-[#F0FDF4]', text: 'text-[#059669]', primary: 'text-[#0F172A]' },
  'royal-crimson': { border: 'border-[#991B1B]', bg: 'bg-[#FFF5F5]', text: 'text-[#991B1B]', primary: 'text-[#0F172A]' }
}

export default function EventSelfCheckIn() {
  const { eventId } = useParams()
  const [event, setEvent] = useState(null)
  const [loadingEvent, setLoadingEvent] = useState(true)
  const [step, setStep] = useState('phone') // 'phone' | 'pin' | 'success' | 'already' | 'not-registered'
  const [phoneNumber, setPhoneNumber] = useState('')
  const [pin, setPin] = useState('')
  const [match, setMatch] = useState(null) // { type: 'member'|'guest', member, registration }
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [giftClaimedInput, setGiftClaimedInput] = useState('no')

  // Certificate States
  const [certTemplate, setCertTemplate] = useState(null)
  const [showCertModal, setShowCertModal] = useState(false)
  const [customLogo, setCustomLogo] = useState('')
  const [generatingCert, setGeneratingCert] = useState(false)

  useEffect(() => {
    fetchEvent()
    fetchCertTemplate()
    // Load custom logo
    const savedLogo = localStorage.getItem('customLogo')
    if (savedLogo) {
      setCustomLogo(savedLogo)
    } else {
      supabase.from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'custom_logo')
        .maybeSingle()
        .then(({ data }) => {
          if (data?.setting_value) setCustomLogo(data.setting_value)
        })
    }
  }, [eventId])

  async function fetchEvent() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (error) throw error
      setEvent(data)
    } catch (err) {
      console.error('Error fetching event:', err)
    } finally {
      setLoadingEvent(false)
    }
  }

  async function fetchCertTemplate() {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'cert_template_global')
        .maybeSingle()
      if (data?.setting_value) {
        setCertTemplate(JSON.parse(data.setting_value))
      }
    } catch (err) {
      console.error('Error fetching certificate template:', err)
    }
  }

  function normalizePhoneVariants(raw) {
    const clean = raw.replace(/\D/g, '')
    const last10 = clean.slice(-10)
    return [raw, clean, `+91${last10}`, last10]
  }

  async function handleSubmitPhone(e) {
    e.preventDefault()
    setError('')

    const cleanPhone = phoneNumber.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      setError('Please enter a valid phone number')
      return
    }

    setLoading(true)
    try {
      const variants = normalizePhoneVariants(phoneNumber)
      const orFilter = variants.map(v => `phone_number.eq.${v}`).join(',')

      // 1. Try to match a member by phone number
      const { data: memberMatch } = await supabase
        .from('members')
        .select('*')
        .or(orFilter)
        .limit(1)
        .maybeSingle()

      if (memberMatch) {
        const { data: registration } = await supabase
          .from('event_registrations')
          .select('*')
          .eq('event_id', eventId)
          .eq('member_id', memberMatch.id)
          .maybeSingle()

        if (!registration) {
          setStep('not-registered')
          setLoading(false)
          return
        }

        setMatch({ type: 'member', member: memberMatch, registration })

        if (memberMatch.login_pin) {
          setStep('pin')
          setLoading(false)
          return
        }

        // No PIN set for this member - check in directly
        await performCheckIn({ type: 'member', member: memberMatch, registration })
        setLoading(false)
        return
      }

      // 2. Try to match a guest registration by phone number
      const guestOrFilter = variants.map(v => `guest_phone.eq.${v}`).join(',')
      const { data: guestRegistration } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', eventId)
        .or(guestOrFilter)
        .limit(1)
        .maybeSingle()

      if (guestRegistration) {
        const guestMatch = { type: 'guest', registration: guestRegistration }
        setMatch(guestMatch)
        await performCheckIn(guestMatch)
        setLoading(false)
        return
      }

      setStep('not-registered')
    } catch (err) {
      console.error('Error verifying phone:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitPin(e) {
    e.preventDefault()
    setError('')

    if (!pin || pin.length !== 4) {
      setError('PIN must be exactly 4 digits')
      return
    }

    if (match.member.login_pin !== pin) {
      setError('Incorrect PIN. Please try again.')
      setPin('')
      return
    }

    setLoading(true)
    await performCheckIn(match)
    setLoading(false)
  }

  async function performCheckIn(matchInfo) {
    try {
      const isMember = matchInfo.type === 'member'

      // Check for an existing check-in first
      const { data: existing } = await supabase
        .from('event_attendance')
        .select('*')
        .eq('event_id', eventId)
        .eq(isMember ? 'member_id' : 'registration_id', isMember ? matchInfo.member.id : matchInfo.registration.id)
        .maybeSingle()

      if (existing) {
        if (existing.checked_out || existing.checked_out_at) {
          setResult({
            name: isMember ? matchInfo.member.full_name : matchInfo.registration.guest_name,
            checkedInAt: existing.checked_in_at,
            checkedOutAt: existing.checked_out_at,
            giftClaimed: existing.gift_claimed
          })
          setStep('already-checked-out')
        } else {
          setGiftClaimedInput('no')
          setResult({
            id: existing.id,
            name: isMember ? matchInfo.member.full_name : matchInfo.registration.guest_name,
            checkedInAt: existing.checked_in_at
          })
          setStep('checkout-prompt')
        }
        return
      }

      const insertPayload = {
        event_id: eventId,
        checked_in_at: new Date().toISOString(),
        check_in_method: 'self_checkin'
      }

      if (isMember) {
        insertPayload.member_id = matchInfo.member.id
        insertPayload.registration_id = matchInfo.registration.id
      } else {
        insertPayload.registration_id = matchInfo.registration.id
        insertPayload.guest_name = matchInfo.registration.guest_name
        insertPayload.guest_phone = matchInfo.registration.guest_phone
      }

      const { data: inserted, error: insertError } = await supabase
        .from('event_attendance')
        .insert([insertPayload])
        .select()
        .single()

      if (insertError) throw insertError

      setResult({
        name: isMember ? matchInfo.member.full_name : matchInfo.registration.guest_name,
        checkedInAt: inserted.checked_in_at
      })
      setStep('success')
    } catch (err) {
      console.error('Error checking in:', err)
      setError('Failed to check in. Please try again or ask event staff for help.')
    }
  }

  async function handleSelfCheckout() {
    setLoading(true)
    setError('')
    try {
      const { data: updated, error: updateError } = await supabase
        .from('event_attendance')
        .update({
          checked_out: true,
          checked_out_at: new Date().toISOString(),
          gift_claimed: event?.gift === 'yes' ? giftClaimedInput : 'no'
        })
        .eq('id', result.id)
        .select()
        .single()

      if (updateError) throw updateError

      setResult({
        name: result.name,
        checkedInAt: updated.checked_in_at,
        checkedOutAt: updated.checked_out_at,
        giftClaimed: updated.gift_claimed
      })
      setStep('checkout-success')
    } catch (err) {
      console.error('Error checking out:', err)
      setError('Failed to check out. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Certificate dynamic rendering data builder
  const getCertDetails = () => {
    const defaultTemplate = {
      title: 'Certificate of Participation',
      headerText: 'IT Leaders Community Kerala',
      subTitle: 'This is proudly presented to',
      bodyText: 'This is proudly presented to {{name}} in recognition of their active participation in the event {{event_title}} held on {{date}} at {{location}}.',
      signatoryName: 'ITLC President',
      signatoryDesignation: 'IT Leaders Community',
      signatureImage: '',
      bgStyle: 'classic-gold',
      logos: []
    }

    const t = certTemplate || defaultTemplate
    const eventTitle = event ? event.title : 'ITLC Event'
    const eventDate = event ? event.date : ''
    const eventLoc = event ? event.location : ''

    const attendeeName = result?.name || 'Attendee'
    let body = t.bodyText || ''
    body = body.replace(/\{\{\s*name\s*\}\}/gi, attendeeName)
    body = body.replace(/\btest\b/gi, attendeeName)
    body = body.replace(/\{\{\s*event_title\s*\}\}/gi, eventTitle)
    body = body.replace(/\{\{\s*date\s*\}\}/gi, eventDate)
    body = body.replace(/\{\{\s*location\s*\}\}/gi, eventLoc || 'N/A')

    return {
      title: t.title,
      headerText: t.headerText || 'IT Leaders Community Kerala',
      subTitle: t.subTitle || 'This is proudly presented to',
      body,
      // Left Signatory
      leftSignatoryEnabled: t.leftSignatoryEnabled ?? false,
      leftSignatoryName: t.leftSignatoryName || '',
      leftSignatoryDesignation: t.leftSignatoryDesignation || '',
      leftSignatoryCompany: t.leftSignatoryCompany || '',
      leftSignatureImage: t.leftSignatureImage || '',
      leftSignatureScale: typeof t.leftSignatureScale === 'number' ? t.leftSignatureScale : 1,
      leftSignatureOffsetX: typeof t.leftSignatureOffsetX === 'number' ? t.leftSignatureOffsetX : 0,
      leftSignatureOffsetY: typeof t.leftSignatureOffsetY === 'number' ? t.leftSignatureOffsetY : 0,
      // Right Signatory
      rightSignatoryEnabled: t.rightSignatoryEnabled ?? true,
      signatoryName: t.signatoryName || '',
      signatoryDesignation: t.signatoryDesignation || '',
      signatoryCompany: t.signatoryCompany || '',
      signatureImage: t.signatureImage || '',
      signatureScale: typeof t.signatureScale === 'number' ? t.signatureScale : 1,
      signatureOffsetX: typeof t.signatureOffsetX === 'number' ? t.signatureOffsetX : 0,
      signatureOffsetY: typeof t.signatureOffsetY === 'number' ? t.signatureOffsetY : 0,
      bgStyle: t.bgStyle
    }
  }

  // Download high-resolution canvas certificate
  const downloadCertificate = async () => {
    try {
      setGeneratingCert(true)
      const element = document.getElementById('certificate-render-card')
      if (!element) {
        throw new Error('Certificate preview element not found')
      }

      // Render the DOM element to a canvas
      const canvas = await html2canvas(element, {
        scale: 3, // scale by 3 for high-res output
        useCORS: true,
        backgroundColor: null,
        logging: false
      })

      // Trigger download
      const link = document.createElement('a')
      link.download = `Certificate-${(event ? event.title : 'Event').replace(/\s+/g, '_')}-${(result?.name || 'User').replace(/\s+/g, '_')}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Error generating certificate image:', err)
      alert('Failed to generate certificate image: ' + err.message)
    } finally {
      setGeneratingCert(false)
    }
  }

  const [sharingOnLinkedIn, setSharingOnLinkedIn] = useState(false)

  // Direct share logic to LinkedIn via OAuth and UGC API
  const executeLinkedInShare = async (token, urn) => {
    try {
      setSharingOnLinkedIn(true)
      const element = document.getElementById('certificate-render-card')
      if (!element) {
        throw new Error('Certificate preview element not found')
      }

      // Render the DOM element to a canvas
      const canvas = await html2canvas(element, {
        scale: 2, // scale by 2 for quick feed image upload
        useCORS: true,
        backgroundColor: null,
        logging: false
      })
      const base64Image = canvas.toDataURL('image/png')

      const eventTitle = event ? event.title : 'ITLC Event'
      const postText = `I am proud to share that I have participated in "${eventTitle}" organized by IT Leaders Community Kerala! 🎓\n\nCertificate Code: CERT-${eventId.substring(0, 8)}-${(result?.name || 'CERT').replace(/\s+/g, '-').toUpperCase()}\n\n#ITLC #ITLeadersCommunity #Kerala #ProfessionalGrowth`

      const shareResponse = await fetch(`${BACKEND_URL}/api/linkedin/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          urn,
          text: postText,
          image: base64Image
        })
      })

      if (!shareResponse.ok) {
        const errJson = await shareResponse.json()
        throw new Error(errJson.error || 'Failed to post on LinkedIn')
      }

      alert('Certificate shared successfully to your LinkedIn feed!')
    } catch (err) {
      console.error('LinkedIn Share Error:', err)
      alert('Failed to share to LinkedIn: ' + err.message + '\nTry re-authenticating.')
      // Clear token to force login next time
      localStorage.removeItem('linkedInToken')
      localStorage.removeItem('linkedInUrn')
      localStorage.removeItem('linkedInName')
    } finally {
      setSharingOnLinkedIn(false)
    }
  }

  // Share to LinkedIn with default message copied to clipboard
  const shareToLinkedIn = () => {
    const token = localStorage.getItem('linkedInToken')
    const urn = localStorage.getItem('linkedInUrn')

    if (token && urn) {
      executeLinkedInShare(token, urn)
    } else {
      // Trigger OAuth login flow
      const width = 500
      const height = 600
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      window.open(`${BACKEND_URL}/api/linkedin/login`, 'LinkedInLogin', `width=${width},height=${height},top=${top},left=${left}`)

      const messageListener = async (evt) => {
        if (evt.data?.type === 'LINKEDIN_LOGIN_SUCCESS') {
          const { token: newToken, urn: newUrn, name: newName } = evt.data.payload
          localStorage.setItem('linkedInToken', newToken)
          localStorage.setItem('linkedInUrn', newUrn)
          localStorage.setItem('linkedInName', newName)
          window.removeEventListener('message', messageListener)
          await executeLinkedInShare(newToken, newUrn)
        }
      }
      window.addEventListener('message', messageListener)
    }
  }

  if (loadingEvent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-500">Loading...</p>
      </div>
    )
  }

  const activeCertPreset = certTemplate ? (STYLES_HTML[certTemplate.bgStyle] || STYLES_HTML['classic-gold']) : STYLES_HTML['classic-gold']

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
            <span className="material-symbols-outlined text-3xl text-primary">event_available</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">{event?.title || 'Event Check-In'}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{event?.date} · {event?.location}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
          {step === 'phone' && (
            <form onSubmit={handleSubmitPhone}>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Confirm your phone number</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Enter the phone number you used to register.</p>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Phone number"
                autoFocus
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary mb-3"
              />
              {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-bold py-3 rounded-lg transition-colors"
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'pin' && (
            <form onSubmit={handleSubmitPin}>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Hi {match?.member?.full_name}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Enter your 4-digit PIN to confirm it's you.</p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                autoFocus
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary mb-3"
              />
              {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-bold py-3 rounded-lg transition-colors"
              >
                {loading ? 'Verifying...' : 'Check In'}
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                <span className="material-symbols-outlined text-4xl text-green-500">check_circle</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">You're checked in!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {result?.name} · {formatTime(result?.checkedInAt)}
              </p>
            </div>
          )}

          {step === 'already' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 mb-4">
                <span className="material-symbols-outlined text-4xl text-amber-500">info</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Already checked in</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {result?.name} checked in at {formatTime(result?.checkedInAt)}
              </p>
            </div>
          )}

          {step === 'checkout-prompt' && (
            <div>
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
                  <span className="material-symbols-outlined text-4xl text-primary">logout</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Check-Out</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {result?.name} is checked in at {formatTime(result?.checkedInAt)}.
                </p>
              </div>

              {event?.gift === 'yes' && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mb-4">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2 text-center">
                    Have you claimed your gift?
                  </p>
                  <div className="flex justify-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="giftClaimed"
                        value="yes"
                        checked={giftClaimedInput === 'yes'}
                        onChange={() => setGiftClaimedInput('yes')}
                        className="rounded-full border-slate-300 text-primary focus:ring-primary size-4"
                      />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">Yes, Claimed</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="giftClaimed"
                        value="no"
                        checked={giftClaimedInput === 'no'}
                        onChange={() => setGiftClaimedInput('no')}
                        className="rounded-full border-slate-300 text-primary focus:ring-primary size-4"
                      />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">No, Not Claimed</span>
                    </label>
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-500 mb-3 text-center">{error}</p>}

              <button
                onClick={handleSelfCheckout}
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-3 rounded-lg transition-colors"
              >
                {loading ? 'Processing...' : 'Confirm Check-Out'}
              </button>
            </div>
          )}

          {step === 'checkout-success' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                <span className="material-symbols-outlined text-4xl text-green-500">check_circle</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Check-Out Complete!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                {result?.name} checked out at {formatTime(result?.checkedOutAt)}.
              </p>
              {event?.gift === 'yes' && (
                <p className="text-xs text-slate-400 mt-1">
                  Gift Claimed: {result?.giftClaimed === 'yes' ? 'Yes' : 'No'}
                </p>
              )}

              {/* Certificate Download Panel */}
              <div className="mt-6 p-4 rounded-xl border border-amber-200 bg-amber-500/5 dark:bg-amber-500/10 dark:border-amber-900/40 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 mb-3">
                  <span className="material-symbols-outlined text-2xl">workspace_premium</span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">Participation Certificate</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Your official ITLC participation certificate is ready for download.</p>
                <button
                  onClick={() => setShowCertModal(true)}
                  className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] transition-all text-white font-bold py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-md">download</span>
                  View & Download
                </button>
              </div>
            </div>
          )}

          {step === 'already-checked-out' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-500/10 mb-4">
                <span className="material-symbols-outlined text-4xl text-slate-500">logout</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Already checked out</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {result?.name} checked out at {formatTime(result?.checkedOutAt)}
              </p>
              {event?.gift === 'yes' && (
                <p className="text-xs text-slate-400 mt-2">
                  Gift Claimed: {result?.giftClaimed === 'yes' ? 'Yes' : 'No'}
                </p>
              )}

              {/* Certificate Download Panel */}
              <div className="mt-6 p-4 rounded-xl border border-amber-200 bg-amber-500/5 dark:bg-amber-500/10 dark:border-amber-900/40 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 mb-3">
                  <span className="material-symbols-outlined text-2xl">workspace_premium</span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">Participation Certificate</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Your official ITLC participation certificate is ready for download.</p>
                <div className="flex flex-col sm:flex-row gap-2 w-full mt-1">
                  <button
                    onClick={() => setShowCertModal(true)}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] transition-all text-white font-bold py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-md">download</span>
                    View & Download
                  </button>
                  <button
                    onClick={shareToLinkedIn}
                    disabled={sharingOnLinkedIn}
                    className="flex-1 bg-[#0a66c2] hover:bg-[#004182] active:scale-[0.98] disabled:opacity-50 transition-all text-white font-bold py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {sharingOnLinkedIn ? (
                      <span>Sharing...</span>
                    ) : (
                      <>
                        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                        </svg>
                        Share
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'not-registered' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
                <span className="material-symbols-outlined text-4xl text-red-500">error</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Not registered</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                We couldn't find a registration for this event with that phone number.
              </p>
              <button
                onClick={() => { setStep('phone'); setPhoneNumber(''); setError('') }}
                className="w-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Certificate Viewer Modal */}
      {showCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => setShowCertModal(false)}
              className="absolute top-4 right-4 size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Your E-Certificate</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Verify details and download the image.</p>

            {/* Certificate Styled Frame */}
            <div className={`w-full aspect-[1.414/1] rounded-lg border-4 ${activeCertPreset.border} ${activeCertPreset.bg} p-3 md:p-5 flex flex-col justify-between relative overflow-hidden select-none border-double`}>
              {/* Corners */}
              <div className={`absolute top-1 left-1 w-4 h-4 border-t border-l ${activeCertPreset.border}`}></div>
              <div className={`absolute top-1 right-1 w-4 h-4 border-t border-r ${activeCertPreset.border}`}></div>
              <div className={`absolute bottom-1 left-1 w-4 h-4 border-b border-l ${activeCertPreset.border}`}></div>
              <div className={`absolute bottom-1 right-1 w-4 h-4 border-b border-r ${activeCertPreset.border}`}></div>

              <div className="flex flex-col items-center text-center shrink-0">
                <div className="flex items-center justify-center gap-2 mb-0.5 min-h-[22px]">
                  {certTemplate?.logos && certTemplate.logos.length > 0 ? (
                    certTemplate.logos.map((logo, idx) => (
                      <img key={idx} src={logo} alt={`Logo ${idx+1}`} className="h-5 object-contain" />
                    ))
                  ) : (
                    customLogo ? (
                      <img src={customLogo} alt="Logo" className="h-5 object-contain" />
                    ) : (
                      <div className={`text-sm font-bold ${activeCertPreset.text}`}>ITLC</div>
                    )
                  )}
                </div>
                <h4 className="text-[7px] font-semibold text-slate-400 uppercase tracking-widest leading-none select-none">
                  {getCertDetails().headerText}
                </h4>
              </div>

              <div className="text-center flex-1 flex flex-col justify-center my-1.5">
                <h2 className={`text-xs md:text-sm font-bold font-serif ${activeCertPreset.text} uppercase tracking-wide shrink-0`}>
                  {getCertDetails().title}
                </h2>
                <p className="text-[7px] text-slate-400 italic font-serif mt-0.5 shrink-0 select-none">{getCertDetails().subTitle}</p>
                <h1 className="text-xs md:text-base font-bold font-serif text-slate-800 dark:text-slate-200 mt-0.5 italic leading-none shrink-0">
                  {result?.name}
                </h1>
                <div 
                  className="cert-modal-body text-[8px] md:text-[9px] leading-relaxed max-w-xs mx-auto text-slate-500 mt-0.5 font-sans"
                  dangerouslySetInnerHTML={{ __html: getCertDetails().body }}
                />
              </div>

              <div className={`flex ${getCertDetails().leftSignatoryEnabled && getCertDetails().rightSignatoryEnabled ? 'justify-between' : getCertDetails().leftSignatoryEnabled ? 'justify-start' : 'justify-end'} items-end border-t border-slate-200/50 pt-1.5 shrink-0`}>
                {/* Left Signatory */}
                {getCertDetails().leftSignatoryEnabled && (
                  <div className="text-center font-sans max-w-[110px] leading-tight shrink-0">
                    <div className="min-h-[16px] flex items-end justify-center mb-0.5 relative">
                      {getCertDetails().leftSignatureImage ? (
                        <img
                          src={getCertDetails().leftSignatureImage}
                          alt="Left Signature"
                          style={{
                            transform: `translate(${(getCertDetails().leftSignatureOffsetX || 0) * 0.6}px, ${(getCertDetails().leftSignatureOffsetY || 0) * 0.6}px) scale(${getCertDetails().leftSignatureScale || 1})`,
                            transformOrigin: 'bottom center'
                          }}
                          className="h-4 md:h-5 max-w-[80px] object-contain mx-auto transition-transform duration-75 select-none pointer-events-none"
                        />
                      ) : (
                        <span className={`font-serif italic text-[8px] ${activeCertPreset.text} opacity-70`}>
                          {getCertDetails().leftSignatoryName ? (getCertDetails().leftSignatoryName.substring(0, 1) + '. ' + getCertDetails().leftSignatoryName.split(' ').pop()) : ''}
                        </span>
                      )}
                    </div>
                    <div className="w-16 border-t border-slate-200 dark:border-slate-700 mx-auto"></div>
                    <h4 className="text-[7px] font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                      {getCertDetails().leftSignatoryName}
                    </h4>
                    <p className="text-[5px] text-slate-400 uppercase tracking-wider truncate">
                      {getCertDetails().leftSignatoryDesignation}
                    </p>
                    {getCertDetails().leftSignatoryCompany && (
                      <p className="text-[4px] text-slate-400 uppercase tracking-widest truncate mt-0.5">
                        {getCertDetails().leftSignatoryCompany}
                      </p>
                    )}
                  </div>
                )}

                {/* Right Signatory */}
                {getCertDetails().rightSignatoryEnabled && (
                  <div className="text-center font-sans max-w-[110px] leading-tight shrink-0">
                    <div className="min-h-[16px] flex items-end justify-center mb-0.5 relative">
                      {getCertDetails().signatureImage ? (
                        <img
                          src={getCertDetails().signatureImage}
                          alt="Signature"
                          style={{
                            transform: `translate(${(getCertDetails().signatureOffsetX || 0) * 0.6}px, ${(getCertDetails().signatureOffsetY || 0) * 0.6}px) scale(${getCertDetails().signatureScale || 1})`,
                            transformOrigin: 'bottom center'
                          }}
                          className="h-4 md:h-5 max-w-[80px] object-contain mx-auto transition-transform duration-75 select-none pointer-events-none"
                        />
                      ) : (
                        <span className={`font-serif italic text-[8px] ${activeCertPreset.text} opacity-70`}>
                          {getCertDetails().signatoryName ? (getCertDetails().signatoryName.substring(0, 1) + '. ' + getCertDetails().signatoryName.split(' ').pop()) : ''}
                        </span>
                      )}
                    </div>
                    <div className="w-16 border-t border-slate-200 dark:border-slate-700 mx-auto"></div>
                    <h4 className="text-[7px] font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                      {getCertDetails().signatoryName}
                    </h4>
                    <p className="text-[5px] text-slate-400 uppercase tracking-wider truncate">
                      {getCertDetails().signatoryDesignation}
                    </p>
                    {getCertDetails().signatoryCompany && (
                      <p className="text-[4px] text-slate-400 uppercase tracking-widest truncate mt-0.5">
                        {getCertDetails().signatoryCompany}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2 mt-5">
              <button
                onClick={() => setShowCertModal(false)}
                className="border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-all text-sm"
              >
                Close
              </button>
              <button
                onClick={downloadCertificate}
                disabled={generatingCert}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                {generatingCert ? 'Generating...' : 'Download Image'}
              </button>
              <button
                onClick={shareToLinkedIn}
                disabled={sharingOnLinkedIn}
                className="bg-[#0a66c2] hover:bg-[#004182] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-1.5 shadow-sm"
              >
                {sharingOnLinkedIn ? (
                  <span>Sharing...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                    </svg>
                    Share
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen high-resolution certificate renderer for download/sharing */}
      <div
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '1024px',
          pointerEvents: 'none'
        }}
      >
        <div
          id="certificate-render-card"
          className={`w-[1024px] aspect-[1.414/1] rounded-lg border-4 ${activeCertPreset.border} ${activeCertPreset.bg} p-8 flex flex-col justify-between relative overflow-hidden select-none border-double`}
        >
          {/* Corners */}
          <div className={`absolute top-2 left-2 w-6 h-6 border-t border-l ${activeCertPreset.border}`}></div>
          <div className={`absolute top-2 right-2 w-6 h-6 border-t border-r ${activeCertPreset.border}`}></div>
          <div className={`absolute bottom-2 left-2 w-6 h-6 border-b border-l ${activeCertPreset.border}`}></div>
          <div className={`absolute bottom-2 right-2 w-6 h-6 border-b border-r ${activeCertPreset.border}`}></div>

          <div className="flex flex-col items-center text-center shrink-0">
            <div className="flex items-center justify-center gap-3 mb-1 min-h-[36px]">
              {certTemplate?.logos && certTemplate.logos.length > 0 ? (
                certTemplate.logos.map((logo, idx) => (
                  <img key={idx} src={logo} alt={`Logo ${idx+1}`} className="h-9 object-contain" />
                ))
              ) : (
                customLogo ? (
                  <img src={customLogo} alt="Logo" className="h-9 object-contain" />
                ) : (
                  <div className={`text-xl font-bold ${activeCertPreset.text}`}>ITLC</div>
                )
              )}
            </div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none select-none">
              {getCertDetails().headerText}
            </h4>
          </div>

          <div className="text-center flex-1 flex flex-col justify-center my-2 shrink-0">
            <h2 className={`text-2xl font-bold font-serif ${activeCertPreset.text} uppercase tracking-wide shrink-0`}>
              {getCertDetails().title}
            </h2>
            <p className="text-xs text-slate-400 italic font-serif mt-1 shrink-0 select-none">{getCertDetails().subTitle}</p>
            <h1 className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-200 mt-1 italic leading-none shrink-0">
              {result?.name}
            </h1>
            <div
              className="cert-render-body text-sm leading-relaxed max-w-xl mx-auto text-slate-500 mt-2 font-sans"
              dangerouslySetInnerHTML={{ __html: getCertDetails().body }}
            />
          </div>

          <div className={`flex ${getCertDetails().leftSignatoryEnabled && getCertDetails().rightSignatoryEnabled ? 'justify-between' : getCertDetails().leftSignatoryEnabled ? 'justify-start' : 'justify-end'} items-end border-t border-slate-200/50 pt-3 shrink-0`}>
            {/* Left Signatory */}
            {getCertDetails().leftSignatoryEnabled && (
              <div className="text-center font-sans max-w-[200px] leading-tight shrink-0">
                <div className="min-h-[32px] flex items-end justify-center mb-1 relative">
                  {getCertDetails().leftSignatureImage ? (
                    <img
                      src={getCertDetails().leftSignatureImage}
                      alt="Left Signature"
                      style={{
                        transform: `translate(${(getCertDetails().leftSignatureOffsetX || 0) * 1.5}px, ${(getCertDetails().leftSignatureOffsetY || 0) * 1.5}px) scale(${getCertDetails().leftSignatureScale || 1})`,
                        transformOrigin: 'bottom center'
                      }}
                      className="h-9 max-w-[160px] object-contain mx-auto transition-transform duration-75 select-none"
                    />
                  ) : (
                    <span className={`font-serif italic text-sm ${activeCertPreset.text} opacity-70`}>
                      {getCertDetails().leftSignatoryName ? (getCertDetails().leftSignatoryName.substring(0, 1) + '. ' + getCertDetails().leftSignatoryName.split(' ').pop()) : ''}
                    </span>
                  )}
                </div>
                <div className="w-24 border-t border-slate-200 dark:border-slate-700 mx-auto"></div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1 truncate">
                  {getCertDetails().leftSignatoryName}
                </h4>
                <p className="text-[8px] text-slate-400 uppercase tracking-wider truncate">
                  {getCertDetails().leftSignatoryDesignation}
                </p>
                {getCertDetails().leftSignatoryCompany && (
                  <p className="text-[7px] text-slate-400 uppercase tracking-widest truncate mt-0.5">
                    {getCertDetails().leftSignatoryCompany}
                  </p>
                )}
              </div>
            )}

            {/* Right Signatory */}
            {getCertDetails().rightSignatoryEnabled && (
              <div className="text-center font-sans max-w-[200px] leading-tight shrink-0">
                <div className="min-h-[32px] flex items-end justify-center mb-1 relative">
                  {getCertDetails().signatureImage ? (
                    <img
                      src={getCertDetails().signatureImage}
                      alt="Signature"
                      style={{
                        transform: `translate(${(getCertDetails().signatureOffsetX || 0) * 1.5}px, ${(getCertDetails().signatureOffsetY || 0) * 1.5}px) scale(${getCertDetails().signatureScale || 1})`,
                        transformOrigin: 'bottom center'
                      }}
                      className="h-9 max-w-[160px] object-contain mx-auto transition-transform duration-75 select-none"
                    />
                  ) : (
                    <span className={`font-serif italic text-sm ${activeCertPreset.text} opacity-70`}>
                      {getCertDetails().signatoryName ? (getCertDetails().signatoryName.substring(0, 1) + '. ' + getCertDetails().signatoryName.split(' ').pop()) : ''}
                    </span>
                  )}
                </div>
                <div className="w-24 border-t border-slate-200 dark:border-slate-700 mx-auto"></div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1 truncate">
                  {getCertDetails().signatoryName}
                </h4>
                <p className="text-[8px] text-slate-400 uppercase tracking-wider truncate">
                  {getCertDetails().signatoryDesignation}
                </p>
                {getCertDetails().signatoryCompany && (
                  <p className="text-[7px] text-slate-400 uppercase tracking-widest truncate mt-0.5">
                    {getCertDetails().signatoryCompany}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
