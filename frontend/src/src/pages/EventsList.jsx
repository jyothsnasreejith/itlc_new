import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

export default function EventsList() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('upcoming')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookmarkedEvents, setBookmarkedEvents] = useState(new Set())
  const [shareMenuOpen, setShareMenuOpen] = useState(null)
  const [sendingEmails, setSendingEmails] = useState(false)
  const [selectedChapter, setSelectedChapter] = useState('all')
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailModalEvent, setEmailModalEvent] = useState(null)
  const [emailRecipient, setEmailRecipient] = useState('')
  const [registrationCounts, setRegistrationCounts] = useState({})
  const [registeredMembers, setRegisteredMembers] = useState({})
  const [membersModalOpen, setMembersModalOpen] = useState(false)
  const [membersModalEvent, setMembersModalEvent] = useState(null)
  const [allEventMembers, setAllEventMembers] = useState([])
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [hasEventCounters, setHasEventCounters] = useState(null)
  const [performanceLog, setPerformanceLog] = useState([])
  const PAGE_SIZE = 25
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    // reset paging when tab changes
    setPage(0)
    setEvents([])
    setHasMore(false)
    fetchEvents(0)
    // Check if user is admin
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    setIsAdminUser(user?.role === 'admin')
  }, [activeTab])

  useEffect(() => {
    async function checkEventCounters() {
      const { error } = await supabase
        .from('event_counters')
        .select('event_id', { head: true, count: 'exact' })
      setHasEventCounters(!error)
    }
    checkEventCounters()
  }, [])

  // fetch when page changes (load more)
  useEffect(() => {
    if (page === 0) return
    fetchEvents(page)
  }, [page])

  const toggleBookmark = (eventId) => {
    setBookmarkedEvents(prev => {
      const newSet = new Set(prev)
      if (newSet.has(eventId)) {
        newSet.delete(eventId)
      } else {
        newSet.add(eventId)
      }
      return newSet
    })
  }

  async function fetchEvents(pageToFetch = page) {
    try {
      setLoading(true)
      const pageStartTime = performance.now()
      const logs = []
      const d = new Date()
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const currentDate = `${year}-${month}-${day}`
      
      const start = pageToFetch * PAGE_SIZE
      const end = start + PAGE_SIZE - 1
      let query = supabase
        .from('events')
        .select('id, title, description, date, time, image, location, fee')
        .range(start, end)
        .order('date', { ascending: activeTab === 'upcoming' })

      if (activeTab === 'upcoming') {
        query = query.gte('date', currentDate)
      } else {
        query = query.lt('date', currentDate)
      }
      const eventsStart = performance.now()
      const { data, error } = await query
      const eventsDuration = performance.now() - eventsStart
      logs.push({
        api: 'GET /events',
        filter: activeTab,
        duration: eventsDuration.toFixed(2),
        count: data?.length || 0,
        status: error ? 'ERROR' : 'OK'
      })
      console.log(`[EventsList] ${activeTab} events query duration: ${eventsDuration.toFixed(2)}ms`)

      if (error) throw error

      const eventData = data || []
      // append for subsequent pages
      setEvents(prev => pageToFetch === 0 ? eventData : [...prev, ...eventData])
      setHasMore((eventData || []).length === PAGE_SIZE)

      // Fetch registration counts and (for upcoming events only) member previews in one batched request
      if (eventData.length > 0) {
        const eventIds = eventData.map(event => event.id)

        if (hasEventCounters === false && activeTab === 'expired') {
          console.warn('Skipping expired tab fallback because event_counters is unavailable')
          logs.push({
            api: 'SKIP /event_counters',
            filter: activeTab,
            duration: '0.00',
            count: 0,
            status: 'SKIPPED (no table)'
          })
          const counts = {}
          eventIds.forEach(id => { counts[id] = 0 })
          setRegistrationCounts(prev => ({ ...prev, ...counts }))
        } else {
          // Fetch per-event registration counts from counters table (fast)
          const countersStart = performance.now()
          const { data: counters, error: countersError } = await supabase
            .from('event_counters')
            .select('event_id, registration_count')
            .in('event_id', eventIds)
          const countersDuration = performance.now() - countersStart
          logs.push({
            api: 'GET /event_counters',
            filter: `${eventIds.length} events`,
            duration: countersDuration.toFixed(2),
            count: counters?.length || 0,
            status: countersError ? 'ERROR (fallback)' : 'OK'
          })

          if (!countersError) {
            const counts = {}
            counters?.forEach(row => { counts[row.event_id] = row.registration_count || 0 })
            // default zero for events not present in counters
            eventIds.forEach(id => { if (!(id in counts)) counts[id] = 0 })
            setRegistrationCounts(prev => ({ ...prev, ...counts }))
          } else if (activeTab === 'expired') {
            console.warn('event_counters unavailable for expired tab; skipping heavy fallback', countersError)
            const counts = {}
            eventIds.forEach(id => { counts[id] = 0 })
            setRegistrationCounts(prev => ({ ...prev, ...counts }))
          } else {
            console.warn('event_counters not available, falling back to registrations table', countersError)
            // fallback to count from registrations table
            const regsStart = performance.now()
            const { data: registrations, error: registrationError } = await supabase
              .from('event_registrations')
              .select('event_id, members (id, full_name, profile_image)')
              .in('event_id', eventIds)
              .order('created_at', { ascending: false })
            const regsDuration = performance.now() - regsStart
            logs.push({
              api: 'GET /event_registrations',
              filter: `${eventIds.length} events`,
              duration: regsDuration.toFixed(2),
              count: registrations?.length || 0,
              status: registrationError ? 'ERROR' : 'OK (FALLBACK)'
            })
            if (registrationError) throw registrationError
            const counts = {}
            const members = {}
            for (const reg of registrations || []) {
              const eventId = reg.event_id
              counts[eventId] = (counts[eventId] || 0) + 1
              if (reg.members) {
                members[eventId] = members[eventId] || []
                if (members[eventId].length < 3) members[eventId].push(reg.members)
              }
            }
            setRegistrationCounts(prev => ({ ...prev, ...counts }))
            setRegisteredMembers(prev => ({ ...prev, ...members }))
          }
        }
      }
      
      const totalDuration = performance.now() - pageStartTime
      logs.push({
        api: '=== TOTAL TIME ===',
        filter: `page ${pageToFetch}`,
        duration: totalDuration.toFixed(2),
        count: eventData.length,
        status: 'COMPLETE'
      })
      
      setPerformanceLog(logs)
      console.table(logs)
    } catch (error) {
      console.error('Error fetching events:', error)
      // Show no events if fetch fails
      setEvents([])
      alert('Failed to load events. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatFullDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const generateSlug = (title, id) => {
    // Create SEO-friendly slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .substring(0, 60) // Limit length
    // Append short ID for uniqueness
    const shortId = id.split('-')[0]
    return `${slug}-${shortId}`
  }

  const getEventUrl = (event) => {
    const baseUrl = window.location.origin
    const slug = generateSlug(event.title, event.id)
    return `${baseUrl}/event/${slug}`
  }

  const getEventRegistrationUrl = (event) => {
    // URL for event registration (public join link, no member ID)
    const baseUrl = window.location.origin
    return `${baseUrl}/event-registration/${event.id}`
  }

  const handleShareWhatsApp = (event) => {
    const url = getEventRegistrationUrl(event)
    const text = `Join this event: ${event.title}\n${event.description}\n${formatFullDate(event.date)} at ${event.time}\n${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    setShareMenuOpen(null)
  }

  const handleShareLinkedIn = (event) => {
    const url = getEventRegistrationUrl(event)
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank')
    setShareMenuOpen(null)
  }

  const handleShareFacebook = (event) => {
    const url = getEventRegistrationUrl(event)
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank')
    setShareMenuOpen(null)
  }

  const handleShareInstagram = (event) => {
    // Instagram doesn't support direct URL sharing, copy to clipboard instead
    const url = getEventRegistrationUrl(event)
    const text = `${event.title}\n${event.description}\n${formatFullDate(event.date)} at ${event.time}\n${url}`
    navigator.clipboard.writeText(text)
    alert('Event details copied to clipboard! You can now paste it in your Instagram post or story.')
    setShareMenuOpen(null)
  }

  const openEmailInviteModal = (event) => {
    setEmailModalEvent(event)
    setEmailRecipient('')
    setEmailModalOpen(true)
    setShareMenuOpen(null)
  }

  const closeEmailInviteModal = () => {
    if (sendingEmails) return
    setEmailModalOpen(false)
    setEmailModalEvent(null)
    setEmailRecipient('')
  }

  const handleEmailInvite = async (event, recipientInput = '') => {
    const chapterText = selectedChapter === 'all' ? 'all chapters' : selectedChapter
    const recipient = recipientInput.trim()

    setSendingEmails(true)
    try {
      const localUser = JSON.parse(localStorage.getItem('user') || 'null')
      
      if (!localUser) {
        alert('Please log in to send invitations.')
        setSendingEmails(false)
        navigate('/login')
        return
      }

      // Call local backend Edge Function via custom client
      const { data: result, error } = await supabase.functions.invoke('send-event-invites', {
        body: {
          eventId: event.id,
          chapter: selectedChapter,
          targetEmail: recipient && recipient.includes('@') ? recipient : null,
          targetPhone: recipient && !recipient.includes('@') ? recipient : null,
        }
      })

      if (error) throw error

      const successText = recipient
        ? `✅ Success! ${result.count} invitation email(s) sent to ${recipient}.`
        : `✅ Success! ${result.count} invitation email(s) sent to members from ${chapterText}.`
      alert(successText)
      setSelectedChapter('all') // Reset chapter selection
      closeEmailInviteModal()
      
    } catch (error) {
      console.error('Error sending invitations:', error)
      alert(`❌ Error: ${error.message || 'Failed to send invitations. Please try again.'}`)
    } finally {
      setSendingEmails(false)
    }
  }

  const handleCopyLink = (event) => {
    const url = getEventRegistrationUrl(event)
    navigator.clipboard.writeText(url)
    alert('Event registration link copied to clipboard!')
    setShareMenuOpen(null)
  }

  const handleEventClick = (event) => {
    navigate(`/admin/event-registrations/${event.id}`)
  }

  const openMembersModal = async (event) => {
    setMembersModalEvent(event)
    try {
      const { data: registrations } = await supabase
        .from('event_registrations')
        .select(`
          id,
          status,
          created_at,
          payment_status,
          payment_id,
          payment_amount,
          updated_at,
          members (
            id,
            full_name,
            email,
            phone_number,
            designation,
            company,
            itlc_chapter_name,
            profile_image
          )
        `)
        .eq('event_id', event.id)
        .order('created_at', { ascending: false })

      const members = (registrations || [])
        .filter(reg => reg.members)
        .map(reg => ({
          ...reg.members,
          registration_status: reg.status,
          registered_at: reg.created_at,
          payment_status: reg.payment_status,
          payment_id: reg.payment_id,
          payment_amount: reg.payment_amount,
          payment_at: reg.updated_at
        }))

      setAllEventMembers(members)
      setMembersModalOpen(true)
    } catch (error) {
      console.error('Error fetching members:', error)
      alert('Error loading members')
    }
  }

  const closeMembersModal = () => {
    setMembersModalOpen(false)
    setMembersModalEvent(null)
    setAllEventMembers([])
  }

  return (
    <div className="relative flex min-h-screen max-w-full mx-auto flex-col bg-background-light dark:bg-background-dark overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center bg-white/80 dark:bg-background-dark/80 backdrop-blur-md p-4 pb-2 justify-between border-b border-slate-100 dark:border-slate-800">
        <div 
          onClick={() => navigate(-1)}
          className="text-slate-900 dark:text-slate-100 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </div>
        <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
          All Events
        </h2>
        <div className="flex w-10 items-center justify-end">
          <button className="flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined">search</span>
          </button>
        </div>
      </div>

      {/* Segmented Control */}
      <div className="flex px-4 py-4 bg-white dark:bg-background-dark">
        <div className="flex h-11 flex-1 max-w-7xl mx-auto items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 transition-all ${
            activeTab === 'upcoming' 
              ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' 
              : 'text-slate-500 dark:text-slate-400'
          } text-sm font-semibold`}>
            <span className="truncate">Upcoming</span>
            <input 
              checked={activeTab === 'upcoming'} 
              onChange={() => setActiveTab('upcoming')}
              className="invisible w-0" 
              name="event-filter" 
              type="radio" 
              value="upcoming"
            />
          </label>
          <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 transition-all ${
            activeTab === 'expired' 
              ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' 
              : 'text-slate-500 dark:text-slate-400'
          } text-sm font-semibold`}>
            <span className="truncate">Expired</span>
            <input 
              checked={activeTab === 'expired'} 
              onChange={() => setActiveTab('expired')}
              className="invisible w-0" 
              name="event-filter" 
              type="radio" 
              value="expired"
            />
          </label>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-500 dark:text-slate-400">Loading events...</div>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">
                event_busy
              </span>
              <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
                No {activeTab} events
              </p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">
                {activeTab === 'upcoming' ? 'Check back later for new events' : 'No past events to display'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pt-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`flex flex-col md:flex-row items-stretch justify-start rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow ${
                    activeTab === 'expired' ? 'opacity-60 grayscale-[0.5]' : ''
                  }`}
                >
                  {/* Event Image */}
                  <div 
                    className="relative w-full md:w-72 lg:w-80 shrink-0 aspect-video md:aspect-auto md:min-h-[220px] bg-center bg-no-repeat bg-cover cursor-pointer bg-slate-200 dark:bg-slate-800 overflow-hidden rounded-t-xl md:rounded-tr-none md:rounded-l-xl"
                    style={{ backgroundImage: `url('${event.image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80'}')` }}
                    onClick={() => handleEventClick(event)}
                  >
                    {activeTab === 'expired' && <div className="absolute inset-0 bg-slate-900/10"></div>}
                    
                    {/* Date Badge */}
                    <div className={`absolute top-3 left-3 px-3 py-1.5 rounded-lg shadow-sm ${
                      activeTab === 'expired' 
                        ? 'bg-slate-200 dark:bg-slate-800' 
                        : 'bg-white/90 dark:bg-slate-900/90 backdrop-blur'
                    }`}>
                      <p className={`text-xs font-bold uppercase tracking-wider ${
                        activeTab === 'expired' ? 'text-slate-500' : 'text-primary'
                      }`}>
                        {formatDate(event.date)}
                      </p>
                    </div>

                    {/* Expired Badge */}
                    {activeTab === 'expired' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-slate-900/60 text-white px-4 py-1 rounded-full text-xs font-bold backdrop-blur-sm uppercase">
                          Expired
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Event Details */}
                  <div className="flex flex-col justify-between flex-1 gap-2 p-4 md:p-6">
                    <div className="flex justify-between items-start gap-2">
                      <h3 
                        className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight cursor-pointer hover:text-primary transition-colors flex-1"
                        onClick={() => handleEventClick(event)}
                      >
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button 
                          className="flex items-center justify-center size-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 dark:hover:bg-primary/20 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/admin/edit-event/${event.id}`)
                          }}
                          title="Edit Event"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <div className="relative">
                          <button 
                            className="flex items-center justify-center size-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 dark:hover:bg-primary/20 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              setShareMenuOpen(shareMenuOpen === event.id ? null : event.id)
                            }}
                            title="Share Event"
                          >
                            <span className="material-symbols-outlined text-lg">share</span>
                          </button>
                          
                          {/* Share Menu */}
                          {shareMenuOpen === event.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setShareMenuOpen(null)}
                              ></div>
                              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 max-h-[calc(100vh-8rem)] overflow-y-auto">
                                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Share Event</p>
                                </div>
                                
                                <button
                                  onClick={() => handleShareWhatsApp(event)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                                >
                                  <div className="flex items-center justify-center size-8 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                    </svg>
                                  </div>
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">WhatsApp</span>
                                </button>

                                <button
                                  onClick={() => handleShareLinkedIn(event)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                                >
                                  <div className="flex items-center justify-center size-8 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                    </svg>
                                  </div>
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">LinkedIn</span>
                                </button>

                                <button
                                  onClick={() => handleShareFacebook(event)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                                >
                                  <div className="flex items-center justify-center size-8 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                    </svg>
                                  </div>
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Facebook</span>
                                </button>

                                <button
                                  onClick={() => handleShareInstagram(event)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                                >
                                  <div className="flex items-center justify-center size-8 rounded-full bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                                    </svg>
                                  </div>
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Instagram</span>
                                </button>

                                <div className="border-t border-slate-200 dark:border-slate-800 my-2"></div>

                                {/* Chapter Selection for Email */}
                                <div className="px-4 py-2">
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                                    Select Chapter
                                  </label>
                                  <select
                                    value={selectedChapter}
                                    onChange={(e) => setSelectedChapter(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                    disabled={sendingEmails}
                                  >
                                    <option value="all">All Chapters</option>
                                    <option value="Kochi">Kochi</option>
                                    <option value="Thiruvananthapuram">Thiruvananthapuram</option>
                                    <option value="Kozhikode">Kozhikode</option>
                                    <option value="Bengaluru">Bengaluru</option>
                                    <option value="Other Indian Cities">Other Indian Cities</option>
                                    <option value="Overseas">Overseas</option>
                                  </select>
                                </div>

                                <button
                                  onClick={() => openEmailInviteModal(event)}
                                  disabled={sendingEmails}
                                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3 disabled:opacity-50"
                                >
                                  <div className="flex items-center justify-center size-8 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                                    <span className="material-symbols-outlined text-base">mail</span>
                                  </div>
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {sendingEmails ? 'Sending...' : 'Email Members'}
                                  </span>
                                </button>

                                <button
                                  onClick={() => handleCopyLink(event)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                                >
                                  <div className="flex items-center justify-center size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    <span className="material-symbols-outlined text-base">link</span>
                                  </div>
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Copy Link</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        
                        <span 
                          className={`material-symbols-outlined cursor-pointer transition-colors ${
                            bookmarkedEvents.has(event.id) 
                              ? 'text-primary fill-[1]' 
                              : 'text-slate-400 hover:text-primary'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleBookmark(event.id)
                          }}
                          style={{ fontVariationSettings: bookmarkedEvents.has(event.id) ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          bookmark
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2">
                      {event.description}
                    </p>

                    {/* Registration Count */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/admin/event-registrations/${event.id}`)
                        }}
                        className="flex items-center gap-1 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-primary/20 dark:hover:bg-primary/20 hover:text-primary transition-colors px-2.5 py-1 rounded-lg cursor-pointer"
                        title="Click to view registered members"
                      >
                        <span className="material-symbols-outlined text-sm">group</span>
                        <span className="text-xs font-semibold">
                          {registrationCounts[event.id] || 0}
                          {event.max_registrations && ` / ${event.max_registrations}`} Registered
                        </span>
                      </button>
                    </div>

                    {/* Location */}
                    {event.location && (
                      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-medium mt-2">
                        <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}

                    {/* Action Buttons Row */}
                    {activeTab === 'upcoming' && (
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        <button
                          onClick={() => navigate(`/admin/event-registrations/${event.id}`)}
                          className="flex-1 min-w-0 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center bg-primary hover:bg-primary/90 text-white shadow-sm active:scale-[0.98] whitespace-nowrap"
                        >
                          View Details
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/admin/event-checkin-qr/${event.id}`)
                          }}
                          title="Check-In QR Code"
                          className="shrink-0 size-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-xl">qr_code_2</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/admin/event-attendance/${event.id}`)
                          }}
                          title="Attendance"
                          className="shrink-0 size-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-xl">how_to_reg</span>
                        </button>
                      </div>
                    )}

                    {activeTab === 'expired' && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => navigate(`/admin/event-registrations/${event.id}`)}
                          className="flex-1 bg-slate-600 hover:bg-slate-700 text-white rounded-lg h-10 font-bold text-sm flex items-center justify-center cursor-pointer transition-colors"
                        >
                          View Details & Attendees
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/admin/event-checkin-qr/${event.id}`)
                          }}
                          title="Check-In QR Code"
                          className="flex-shrink-0 size-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-primary/20 dark:hover:bg-primary/20 hover:text-primary text-slate-600 dark:text-slate-400 transition-colors"
                        >
                          <span className="material-symbols-outlined text-xl">qr_code_2</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/admin/event-attendance/${event.id}`)
                          }}
                          title="Attendance"
                          className="flex-shrink-0 size-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-primary/20 dark:hover:bg-primary/20 hover:text-primary text-slate-600 dark:text-slate-400 transition-colors"
                        >
                          <span className="material-symbols-outlined text-xl">how_to_reg</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="flex items-center justify-center py-6">
                  <button
                    onClick={() => setPage(prev => prev + 1)}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90"
                  >
                    Load more
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button - Create Event */}
      {emailModalOpen && emailModalEvent && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={closeEmailInviteModal}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Email Invitation</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{emailModalEvent.title}</p>
              </div>

              <form
                className="p-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleEmailInvite(emailModalEvent, emailRecipient)
                }}
              >
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Recipient (Optional)
                  </label>
                  <input
                    type="text"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    placeholder="Phone or email for single invite"
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    disabled={sendingEmails}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Leave empty to send to chapter selection.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Select Chapter
                  </label>
                  <select
                    value={selectedChapter}
                    onChange={(e) => setSelectedChapter(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    disabled={sendingEmails}
                  >
                    <option value="all">All Chapters</option>
                    <option value="Kochi">Kochi</option>
                    <option value="Thiruvananthapuram">Thiruvananthapuram</option>
                    <option value="Kozhikode">Kozhikode</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Other Indian Cities">Other Indian Cities</option>
                    <option value="Overseas">Overseas</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEmailInviteModal}
                    disabled={sendingEmails}
                    className="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingEmails}
                    className="flex-1 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold transition-colors disabled:opacity-50"
                  >
                    {sendingEmails ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Floating Action Button - Create Event */}
      <button
        onClick={() => navigate('/admin/create-event')}
        className="fixed bottom-24 md:bottom-28 right-4 md:right-8 lg:right-12 z-30 size-14 md:size-16 bg-primary hover:bg-primary/90 text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title="Create New Event"
      >
        <span className="material-symbols-outlined text-3xl md:text-4xl">add</span>
      </button>

      {/* Members Modal - Enhanced Table View */}
      {membersModalOpen && membersModalEvent && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={closeMembersModal}
          />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-6xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Event Details & Registrations</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{membersModalEvent.title}</p>
                </div>
                <button 
                  onClick={closeMembersModal}
                  className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-2 flex-shrink-0"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Event Summary */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">{membersModalEvent.date}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Time</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">{membersModalEvent.time || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Location</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">{membersModalEvent.location || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Registered</p>
                    <p className="text-sm font-bold text-primary mt-1">{allEventMembers.length}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Total Collected</p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                      {membersModalEvent.fee > 0
                        ? `₹${Number(allEventMembers.reduce((sum, m) => sum + (m.payment_status === 'paid' ? (m.payment_amount || 0) : 0), 0)).toLocaleString('en-IN')}`
                        : 'Free Event'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Members Table */}
              <div className="flex-1 overflow-auto p-5">
                {allEventMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700 mb-3">
                      person_off
                    </span>
                    <p className="text-slate-500 dark:text-slate-400">No members registered</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">No.</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Name</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Email</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Phone</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Designation</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Company</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Chapter</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Status</th>
                          {membersModalEvent.fee > 0 && (
                            <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Payment</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {allEventMembers.map((member, index) => (
                          <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">{index + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center aspect-square rounded-full h-8 w-8 text-white text-xs font-bold flex-shrink-0">
                                  {member.full_name?.charAt(0) || 'M'}
                                </div>
                                <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{member.full_name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate">{member.email || '-'}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate">{member.phone_number || '-'}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate">{member.designation || '-'}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate">{member.company || '-'}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate">{member.itlc_chapter_name || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                member.registration_status === 'approved'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : member.registration_status === 'rejected'
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                              }`}>
                                {member.registration_status?.toUpperCase() || 'PENDING'}
                              </span>
                            </td>
                            {membersModalEvent.fee > 0 && (
                              <td className="px-4 py-3">
                                {member.payment_status === 'paid' ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 w-fit">
                                      <span className="material-symbols-outlined text-xs">check_circle</span>
                                      ₹{Number(member.payment_amount || 0).toLocaleString('en-IN')} PAID
                                    </span>
                                    {member.payment_at && (
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 pl-1">
                                        {new Date(member.payment_at).toLocaleString('en-IN', {
                                          day: '2-digit', month: 'short', year: 'numeric',
                                          hour: '2-digit', minute: '2-digit', hour12: true
                                        })}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                    UNPAID
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-between flex-shrink-0">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Total Members: <span className="font-bold text-slate-900 dark:text-slate-100">{allEventMembers.length}</span>
                </p>
                <button
                  onClick={closeMembersModal}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-lg transition-colors text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  )
}
