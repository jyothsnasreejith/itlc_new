import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const DEFAULT_EVENT_IMAGE = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80'
const DEFAULT_PAGE_TITLE = 'IT Leaders Community (ITLC)'

export default function EventDetailsRegistration() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isPublicRoute = location.pathname.startsWith('/public')
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [registrationStats, setRegistrationStats] = useState({
    approved: 0,
    rejected: 0,
    total: 0,
    totalCollected: 0,
  })

  useEffect(() => {
    if (id) {
      fetchEvent()
    } else {
      // Default demo event data
      setEvent({
        id: 'demo',
        title: 'Annual Community Gala 2026',
        description: 'Join us for an evening of elegance, celebration, and networking. The Annual Community Gala brings together members for a night featuring keynote speakers, live performances, and a catered three-course dinner.',
        date: '2026-10-25',
        time: '6:00 PM - 10:00 PM',
        location: 'Metropolitan Grand Ballroom',
        address: '123 Community Way, Downtown',
        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80'
      })
    }
  }, [id])

  useEffect(() => {
    if (event?.id && event.id !== 'demo') {
      fetchRegistrationStats()
    }
  }, [event])

  useEffect(() => {
    if (!event?.title) {
      document.title = DEFAULT_PAGE_TITLE
      return
    }

    const pageTitle = `${event.title} | Event Details`
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
    } else {
      setMetaByProperty('og:image', DEFAULT_EVENT_IMAGE)
      setMetaByName('twitter:image', DEFAULT_EVENT_IMAGE)
    }
  }, [event])

  async function fetchEvent() {
    setLoading(true)
    try {
      let eventData = null

      // Check if id is a slug (contains hyphens but not a full UUID) or a UUID
      const parts = id.split('-')
      const isFullUuid = parts.length === 5 && parts[0].length === 8 && parts[1].length === 4

      if (!isFullUuid) {
        // This is a slug, extract short ID from the end
        const shortId = parts[parts.length - 1]

        console.log('Slug detected:', id)
        console.log('Extracted shortId:', shortId)

        // Try method 1: Reconstruct UUID for test data pattern (e3333333 -> e3333333-3333-3333-3333-333333333333)
        if (shortId.length === 8 && shortId[0] === shortId[1]) {
          const firstChar = shortId[0]
          const repeatChar = shortId[1]
          const fullUuid = `${shortId}-${repeatChar.repeat(4)}-${repeatChar.repeat(4)}-${repeatChar.repeat(4)}-${repeatChar.repeat(12)}`

          console.log('Trying pattern-based UUID:', fullUuid)

          const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', fullUuid)
            .maybeSingle()

          if (!error && data) {
            eventData = data
            console.log('Event found via pattern match:', eventData)
          }
        }

        // Method 2: If pattern match fails, try to get all events and match client-side
        if (!eventData && shortId.length >= 8) {
          console.log('Trying client-side UUID match for shortId:', shortId)

          // Fetch all events and match on client side
          const { data: allEvents, error: fetchError } = await supabase
            .from('events')
            .select('*')

          if (!fetchError && allEvents) {
            // Find event where UUID starts with the shortId
            eventData = allEvents.find(event => event.id.toLowerCase().startsWith(shortId.toLowerCase()))
            if (eventData) {
              console.log('Event found via client-side match:', eventData)
            }
          } else {
            console.error('Error fetching events:', fetchError)
          }
        }

        // Method 3: Try RPC function if available (requires CREATE_SLUG_SEARCH_FUNCTION.sql)
        if (!eventData && shortId.length >= 8) {
          console.log('Trying RPC search for shortId:', shortId)

          const { data, error } = await supabase
            .rpc('find_event_by_slug', { slug_id: shortId })

          if (!error && data && data.length > 0) {
            eventData = data[0]
            console.log('Event found via RPC:', eventData)
          } else if (error && error.code !== 'PGRST202') {
            // Only log error if it's not "function not found"
            console.error('RPC search error:', error)
          }
        }
      } else {
        // Direct UUID lookup for backwards compatibility
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error
        eventData = data
      }

      // Set event data or show error
      if (eventData) {
        setEvent(eventData)
      } else {
        console.error('Event not found for ID:', id)
        setEvent(null)
      }
    } catch (error) {
      console.error('Error fetching event:', error)
      setEvent(null)
    } finally {
      setLoading(false)
    }
  }

  async function fetchRegistrationStats() {
    try {
      setLoadingStats(true)

      const { count: totalCount, error: totalError } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)

      const { count: approvedCount, error: approvedError } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'approved')

      const { count: rejectedCount, error: rejectedError } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'rejected')

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('event_registrations')
        .select('payment_amount')
        .eq('event_id', event.id)
        .eq('payment_status', 'paid')

      if (totalError || approvedError || rejectedError) {
        throw totalError || approvedError || rejectedError
      }

      const totalCollected = (paymentsData || []).reduce((sum, r) => sum + (r.payment_amount || 0), 0)

      setRegistrationStats({
        approved: approvedCount || 0,
        rejected: rejectedCount || 0,
        total: totalCount || 0,
        totalCollected,
      })
    } catch (error) {
      console.error('Error fetching registration stats:', error)
      setRegistrationStats({ approved: 0, rejected: 0, total: 0 })
    } finally {
      setLoadingStats(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    // If already formatted (contains comma or full month name), return as is
    if (dateString.includes(',') || dateString.match(/January|February|March|April|May|June|July|August|September|October|November|December/)) {
      return dateString
    }
    // Otherwise, format ISO date
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col gap-4 p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-slate-600 dark:text-slate-400">Loading event...</p>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col gap-4 p-4">
        <span className="material-symbols-outlined text-slate-400 text-6xl">event_busy</span>
        <div className="text-center">
          <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold mb-2">Event Not Found</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            The event you're looking for doesn't exist or hasn't been created yet.
          </p>
          <button
            onClick={() => navigate('/events')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Go to Events List
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark">
      {/* Header */}
      <div className="flex items-center bg-background-light dark:bg-background-dark p-4 lg:px-8 justify-between border-b border-slate-200 dark:border-slate-800">
        {!isPublicRoute && (
          <div
            onClick={() => navigate(-1)}
            className="text-slate-900 dark:text-slate-100 flex size-10 shrink-0 items-center cursor-pointer"
          >
            <span className="material-symbols-outlined">arrow_back_ios</span>
          </div>
        )}
        <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
          Event Details
        </h2>
        <div className="flex w-10 items-center justify-end">
          <button className="flex items-center justify-center text-slate-900 dark:text-slate-100">
            <span className="material-symbols-outlined">share</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Hero Image */}
        <div className="@container">
          <div className="px-0">
            <div
              className="w-full bg-center bg-no-repeat bg-cover flex flex-col justify-end aspect-video bg-slate-200 dark:bg-slate-800"
              style={{ backgroundImage: `url("${event.image || DEFAULT_EVENT_IMAGE}")` }}
            />
          </div>
        </div>

        {/* Event Title & Info */}
        <div className="px-4 lg:px-8 xl:px-16 py-6 max-w-7xl mx-auto w-full">
          <h1 className="text-slate-900 dark:text-slate-100 tracking-tight text-2xl lg:text-3xl font-bold leading-tight mb-4">
            {event.title}
          </h1>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4">
              <div className="text-primary flex items-center justify-center rounded-lg bg-primary/10 shrink-0 size-12">
                <span className="material-symbols-outlined">calendar_today</span>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-slate-900 dark:text-slate-100 text-base font-medium">{formatDate(event.date)}</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{event.time || 'Time TBD'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-primary flex items-center justify-center rounded-lg bg-primary/10 shrink-0 size-12">
                <span className="material-symbols-outlined">location_on</span>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-slate-900 dark:text-slate-100 text-base font-medium">{event.location || 'Location TBD'}</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{event.address || ''}</p>
              </div>
            </div>
          </div>

          {event.fee > 0 && (
            <div className="mt-4 flex items-center gap-4">
              <div className="text-primary flex items-center justify-center rounded-lg bg-primary/10 shrink-0 size-12">
                <span className="material-symbols-outlined">payments</span>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-slate-900 dark:text-slate-100 text-base font-medium">Registration Fee</p>
                <p className="text-primary font-bold text-lg">₹{Number(event.fee).toLocaleString('en-IN')}</p>
              </div>
            </div>
          )}

          <div className="mt-8">
            <h3 className="text-slate-900 dark:text-slate-100 text-lg lg:text-xl font-bold mb-2">About this event</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm lg:text-base leading-relaxed">
              {event.description}
            </p>
          </div>

          {/* I Am Attending Poster Creator Banner */}
          <div className="mt-6 bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-indigo-500/30 p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 sm:size-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">style</span>
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Attending this event?</h4>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Create your official "I Am Attending" poster and share it on LinkedIn</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/public/event/${event.id}/poster`)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              <span>Create Poster</span>
            </button>
          </div>

          {/* Registration Stats Section */}
          {event.id !== 'demo' && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-900 dark:text-slate-100 text-lg lg:text-xl font-bold">
                  Registration Overview
                </h3>
                {event.max_registrations && (
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs lg:text-sm px-3 py-1 rounded-full font-medium ${registrationStats.total >= event.max_registrations
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : registrationStats.total >= event.max_registrations * 0.8
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                      {registrationStats.total} / {event.max_registrations} Applications
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {registrationStats.total >= event.max_registrations
                        ? '🔴 Full'
                        : `${event.max_registrations - registrationStats.total} spots left`
                      }
                    </span>
                  </div>
                )}
              </div>

              {event.max_registrations && registrationStats.total >= event.max_registrations && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-600 dark:text-red-400">info</span>
                    <p className="text-red-800 dark:text-red-300 text-sm font-medium">
                      This event has reached maximum capacity
                    </p>
                  </div>
                </div>
              )}

              {loadingStats ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Successful</p>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{registrationStats.approved}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Rejected</p>
                      <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{registrationStats.rejected}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Applications</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{registrationStats.total}</p>
                    </div>
                  </div>
                  {event.fee > 0 && (
                    <div className="mt-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">account_balance_wallet</span>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-bold">Total Amount Collected</p>
                          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                            ₹{Number(registrationStats.totalCollected).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-emerald-600 dark:text-emerald-400">
                        <p className="font-semibold">{registrationStats.totalCollected > 0 ? Math.round(registrationStats.totalCollected / event.fee) : 0} paid</p>
                        <p>via Razorpay</p>
                      </div>
                    </div>
                  )}
                </>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                Delegate identities are hidden. Only aggregate registration counts are shown.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Registration Button - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto px-4 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => navigate(`/unified-event-registration/${id}`)}
          disabled={event.max_registrations && registrationStats.total >= event.max_registrations}
          className="w-full bg-primary hover:bg-primary/90 text-white py-3 px-4 rounded-xl font-bold text-base shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {event.max_registrations && registrationStats.total >= event.max_registrations
            ? 'Event is Full'
            : 'Register for Event'}
        </button>
      </div>

      {/* Bottom Navigation Bar */}
      {!isPublicRoute && <BottomNav />}
    </div>
  )
}
