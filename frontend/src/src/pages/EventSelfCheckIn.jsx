import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

  useEffect(() => {
    fetchEvent()
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
        setResult({
          name: isMember ? matchInfo.member.full_name : matchInfo.registration.guest_name,
          checkedInAt: existing.checked_in_at
        })
        setStep('already')
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

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loadingEvent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-500">Loading...</p>
      </div>
    )
  }

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
    </div>
  )
}
