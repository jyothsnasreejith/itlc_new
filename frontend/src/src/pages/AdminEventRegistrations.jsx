import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const DEFAULT_EVENT_IMAGE = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80'

export default function AdminEventRegistrations() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [registrations, setRegistrations] = useState([])
  const [allRegistrations, setAllRegistrations] = useState([])
  const [filter, setFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest') // 'newest' | 'oldest'
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0, totalCollected: 0 })
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  // Export dropdown state
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const exportDropdownRef = useRef(null)

  // Attendance states
  const [presentAttendees, setPresentAttendees] = useState([])
  const [absentAttendees, setAbsentAttendees] = useState([])
  const [attendanceTab, setAttendanceTab] = useState('present')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchRegistrations()
  }, [id])

  useEffect(() => {
    function handleClickOutside(event) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setExportDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    let filtered = allRegistrations

    if (filter === 'pending') {
      filtered = filtered.filter(r => r.status === 'pending')
    } else if (filter === 'approved') {
      filtered = filtered.filter(r => r.status === 'approved')
    } else if (filter === 'rejected') {
      filtered = filtered.filter(r => r.status === 'rejected')
    }

    if (typeFilter === 'non_member') {
      filtered = filtered.filter(r => !r.member_id)
    } else if (typeFilter === 'member') {
      filtered = filtered.filter(r => !!r.member_id)
    }

    setRegistrations(filtered)
  }, [allRegistrations, filter, typeFilter])

  async function fetchRegistrations() {
    try {
      setLoading(true)

      // Fetch event title and fee and other details
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (eventData) {
        setEvent(eventData)
      }

      const { data, error } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', id)

      if (error) throw error

      let normalizedRegistrations = data || []
      const memberIds = [...new Set(normalizedRegistrations.map((r) => r.member_id).filter(Boolean))]

      let memberMap = new Map()
      if (memberIds.length > 0) {
        const { data: membersData, error: membersError } = await supabase
          .from('members')
          .select('id, full_name, email, phone_number, designation, company, itlc_chapter_name, membership_tier, industry_sector, profile_image')
          .in('id', memberIds)

        if (membersError) throw membersError

        memberMap = new Map((membersData || []).map((m) => [m.id, m]))
        normalizedRegistrations = normalizedRegistrations.map((registration) => ({
          ...registration,
          member: memberMap.get(registration.member_id) || null,
        }))
      }

      setAllRegistrations(normalizedRegistrations)

      // Calculate stats from all registrations
      const pending = normalizedRegistrations.filter(r => r.status === 'pending').length || 0
      const approved = normalizedRegistrations.filter(r => r.status === 'approved').length || 0
      const rejected = normalizedRegistrations.filter(r => r.status === 'rejected').length || 0
      const nonMembers = normalizedRegistrations.filter(r => !r.member_id).length || 0
      const totalCollected = normalizedRegistrations
        .filter(r => r.payment_status === 'paid')
        .reduce((sum, r) => sum + (r.payment_amount || 0), 0)
      setStats({ pending, approved, rejected, total: normalizedRegistrations.length || 0, totalCollected, nonMembers })

      // Fetch Attendance Data
      const { data: attendance, error: attError } = await supabase
        .from('event_attendance')
        .select('*')
        .eq('event_id', id)

      if (attError) throw attError

      const attendanceByMember = new Map()
      const attendanceByRegistration = new Map()
      ;(attendance || []).forEach(att => {
        if (att.member_id) attendanceByMember.set(att.member_id, att)
        if (att.registration_id) attendanceByRegistration.set(att.registration_id, att)
      })

      const present = []
      const absent = []

      // Map registrations to present/absent categories based on event_attendance presence
      normalizedRegistrations.forEach(reg => {
        const isMember = !!reg.member_id
        const person = isMember
          ? {
              id: reg.member_id,
              full_name: memberMap.get(reg.member_id)?.full_name || 'Unknown Member',
              profile_image: memberMap.get(reg.member_id)?.profile_image,
              designation: memberMap.get(reg.member_id)?.designation,
              email: memberMap.get(reg.member_id)?.email,
              phone_number: memberMap.get(reg.member_id)?.phone_number,
              isGuest: false
            }
          : {
              id: reg.id,
              full_name: reg.guest_name || 'Guest',
              designation: reg.guest_designation,
              email: reg.guest_email,
              phone_number: reg.guest_phone,
              isGuest: true
            }

        const att = isMember ? attendanceByMember.get(reg.member_id) : attendanceByRegistration.get(reg.id)

        if (att) {
          present.push({
            ...person,
            checkedInAt: att.checked_in_at,
            checkInMethod: att.check_in_method || 'staff_scan',
            checkedOut: att.checked_out,
            checkedOutAt: att.checked_out_at,
            giftClaimed: att.gift_claimed,
            luckyDrawWinner: att.lucky_draw_winner
          })
        } else {
          absent.push(person)
        }
      })

      present.sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt))
      absent.sort((a, b) => a.full_name.localeCompare(b.full_name))

      setPresentAttendees(present)
      setAbsentAttendees(absent)

    } catch (error) {
      console.error('Error fetching registrations & attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const methodLabel = (method) => {
    if (method === 'self_checkin') return 'Self check-in'
    if (method === 'manual') return 'Manual entry'
    return 'Staff scan'
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
  }

  const filterPeople = (people) => {
    if (!searchQuery) return people
    return people.filter(p =>
      p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone_number?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  const filteredPresent = filterPeople(presentAttendees)
  const filteredAbsent = filterPeople(absentAttendees)

  const sortedRegistrations = [...registrations].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime()
    const timeB = new Date(b.created_at || 0).getTime()
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
  })

  const handleExportToExcel = (targetStatus = 'all') => {
    let listToExport = []
    
    if (targetStatus === 'all') {
      listToExport = allRegistrations
    } else if (targetStatus === 'approved') {
      listToExport = allRegistrations.filter(r => r.status === 'approved')
    } else if (targetStatus === 'rejected') {
      listToExport = allRegistrations.filter(r => r.status === 'rejected')
    } else if (targetStatus === 'pending') {
      listToExport = allRegistrations.filter(r => r.status === 'pending')
    } else {
      listToExport = sortedRegistrations
    }

    if (typeFilter === 'non_member') {
      listToExport = listToExport.filter(r => !r.member_id)
    } else if (typeFilter === 'member') {
      listToExport = listToExport.filter(r => !!r.member_id)
    }

    listToExport = [...listToExport].sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime()
      const timeB = new Date(b.created_at || 0).getTime()
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
    })

    if (!listToExport || listToExport.length === 0) {
      alert(`No ${targetStatus !== 'all' ? targetStatus : ''} registration data available to export.`)
      return
    }

    const headers = [
      'Full Name',
      'Member Type',
      'Registration Status',
      'Designation',
      'Company / Organization',
      'Email',
      'Phone Number',
      'ITLC Chapter',
      'Industry Sector',
      'Location',
      'Payment Status',
      'Payment Amount (INR)',
      'Payment ID',
      'Registration Date & Time'
    ]

    const rows = listToExport.map((r) => {
      const isNonMember = !r.member_id
      const displayName = isNonMember ? r.guest_name : r.member?.full_name
      const memberType = isNonMember ? 'Non-Member' : 'Member'
      const status = r.status ? r.status.toUpperCase() : 'PENDING'
      const designation = isNonMember ? r.guest_designation : r.member?.designation
      const company = isNonMember ? r.guest_company : r.member?.company
      const email = isNonMember ? r.guest_email : r.member?.email
      const phone = isNonMember ? r.guest_phone : r.member?.phone_number
      const chapter = isNonMember ? 'N/A' : (r.member?.itlc_chapter_name || 'N/A')
      const industry = isNonMember ? r.guest_industry_sector : r.member?.industry_sector
      const location = isNonMember ? r.guest_location : (r.member?.itlc_chapter_name ? `${r.member.itlc_chapter_name} Chapter` : 'N/A')
      const paymentStatus = r.payment_status ? r.payment_status.toUpperCase() : 'UNPAID'
      const paymentAmount = r.payment_amount || 0
      const paymentId = r.payment_id || 'N/A'
      const registeredAt = r.created_at ? new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'

      return [
        displayName || 'N/A',
        memberType,
        status,
        designation || 'N/A',
        company || 'N/A',
        email || 'N/A',
        phone || 'N/A',
        chapter,
        industry || 'N/A',
        location || 'N/A',
        paymentStatus,
        paymentAmount,
        paymentId,
        registeredAt
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\r\n')

    // UTF-8 BOM for Microsoft Excel auto-formatting
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    const filterLabel = targetStatus
    const sortLabel = sortOrder === 'newest' ? 'newest-first' : 'oldest-first'
    const eventName = (event?.title || 'event').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
    
    link.setAttribute('href', url)
    link.setAttribute('download', `${eventName}-${filterLabel}-${sortLabel}-registrations.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function handleAction(registrationId, action) {
    try {
      const { error } = await supabase
        .from('event_registrations')
        .update({ status: action })
        .eq('id', registrationId)

      if (error) throw error

      fetchRegistrations()
    } catch (error) {
      console.error('Error updating registration:', error)
      alert('Error updating registration')
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center justify-center size-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h2 className="text-lg sm:text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Event Details & Registrations</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{event?.title || 'Event'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/public/event/${id}/poster`)}
              title="Generate 'I Am Attending' Poster"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">style</span>
              <span className="hidden sm:inline">Poster Link</span>
            </button>
            <button
              onClick={() => navigate(`/admin/event-attendance/${id}`)}
              title="Delegates Attendance"
              className="flex size-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span className="material-symbols-outlined">list_alt</span>
            </button>
            <button
              onClick={() => navigate(`/admin/event-checkin-qr/${id}`)}
              title="Check-In QR Code"
              className="flex size-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span className="material-symbols-outlined">qr_code_2</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (Event Info, Stats & Winners) */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            {/* Event Hero Card */}
            {event && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div 
                  className="w-full bg-center bg-no-repeat bg-cover aspect-video bg-slate-200 dark:bg-slate-800"
                  style={{ backgroundImage: `url("${event.image || DEFAULT_EVENT_IMAGE}")` }}
                />
                <div className="p-5">
                  <h1 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight mb-3">
                    {event.title}
                  </h1>
                  <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">calendar_today</span>
                      <span>{event.date} • {event.time || 'Time TBD'}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-sm">location_on</span>
                        <span>{event.location} {event.address && `(${event.address})`}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    {event.description}
                  </p>
                </div>
              </div>
            )}

            {/* Stats Overview */}
            <section className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Registration Stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
                <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-xl border border-primary/20">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-primary">Pending</p>
                  <p className="text-xl font-bold">{stats.pending}</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Approved</p>
                  <p className="text-xl font-bold">{stats.approved}</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Total</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-blue-650">Non-Mbr</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.nonMembers || 0}</p>
                </div>
              </div>
              {event?.fee > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-450 text-lg">account_balance_wallet</span>
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-450">Total Collected</p>
                      <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">₹{Number(stats.totalCollected).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-emerald-600 dark:text-emerald-450">
                    <p>Fee: ₹{Number(event?.fee).toLocaleString('en-IN')}</p>
                    <p>{stats.totalCollected > 0 ? Math.round(stats.totalCollected / event?.fee) : 0} paid</p>
                  </div>
                </div>
              )}
            </section>

            {/* Lucky Draw Winners Section */}
            {event && (
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-xl animate-bounce">military_tech</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Lucky Draw Winners</h2>
                  </div>
                  <button
                    onClick={() => navigate(`/admin/spin-wheel?eventId=${id}`)}
                    className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-xs">casino</span>
                    Draw Arena
                  </button>
                </div>
                
                {presentAttendees.filter(p => p.luckyDrawWinner).length === 0 ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    No winners have been selected for this event yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {presentAttendees
                      .filter(p => p.luckyDrawWinner)
                      .map(winner => (
                        <div key={winner.id} className="bg-white dark:bg-slate-800 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3 shadow-xs">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-amber-500/10 border border-amber-500/20 flex-shrink-0 flex items-center justify-center">
                            {winner.profile_image ? (
                              <img src={winner.profile_image} alt={winner.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-amber-600 text-lg">person</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{winner.full_name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{winner.designation || 'Attendee'}</p>
                          </div>
                          <span className="material-symbols-outlined text-amber-500 text-xl">workspace_premium</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column (Filters & Registration Requests List) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Reviewing Interests</h3>
                {/* Export Dropdown Menu */}
                <div className="relative inline-block text-left" ref={exportDropdownRef}>
                  <button
                    onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-all active:scale-95 cursor-pointer shadow-2xs"
                    title="Export registrations to Excel"
                  >
                    <span className="material-symbols-outlined text-base">table_view</span>
                    <span>Export ({allRegistrations.length}) to Excel</span>
                    <span className="material-symbols-outlined text-sm">expand_more</span>
                  </button>

                  {exportDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700/60 mb-1">
                        Select Export Filter
                      </div>
                      
                      <button
                        onClick={() => { handleExportToExcel('all'); setExportDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-slate-500">grid_on</span>
                          <span>All Registrations</span>
                        </div>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold">{allRegistrations.length}</span>
                      </button>

                      <button
                        onClick={() => { handleExportToExcel('approved'); setExportDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                          <span>Approved Only</span>
                        </div>
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded text-emerald-800 dark:text-emerald-300 font-bold">{stats.approved}</span>
                      </button>

                      <button
                        onClick={() => { handleExportToExcel('rejected'); setExportDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-rose-600">cancel</span>
                          <span>Rejected Only</span>
                        </div>
                        <span className="text-[10px] bg-rose-100 dark:bg-rose-900/50 px-1.5 py-0.5 rounded text-rose-800 dark:text-rose-300 font-bold">{stats.rejected}</span>
                      </button>

                      <button
                        onClick={() => { handleExportToExcel('pending'); setExportDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-amber-600">pending</span>
                          <span>Pending Only</span>
                        </div>
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded text-amber-800 dark:text-amber-300 font-bold">{stats.pending}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Requests
                </button>
                <button
                  onClick={() => setFilter('pending')}
                  className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors ${
                    filter === 'pending'
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setFilter('approved')}
                  className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors ${
                    filter === 'approved'
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Reviewed
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1 mt-2">
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {[['all', 'All Types'], ['member', 'Members'], ['non_member', 'Non-Members']].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setTypeFilter(val)}
                      className={`flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-4 text-xs font-medium ${
                        typeFilter === val
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Sort Option Toggle Button */}
                <button
                  onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                  className="flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="Click to toggle sort order"
                >
                  <span className="material-symbols-outlined text-sm text-primary">swap_vert</span>
                  <span>{sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
                </button>
              </div>
        </div>

        {/* Registration List */}
        <div className="px-4 py-2">
          {loading ? (
            <div className="text-center py-4 text-xs">Loading registrations...</div>
          ) : sortedRegistrations.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-500">No registrations found</div>
          ) : (
            sortedRegistrations.map((registration) => {
              const isNonMember = !registration.member_id
              const displayName = isNonMember ? registration.guest_name : registration.member?.full_name
              const displayDesignation = isNonMember ? registration.guest_designation : registration.member?.designation
              const displayCompany = isNonMember ? registration.guest_company : (registration.member?.company || registration.member?.company_name)
              return (
                <div
                  key={registration.id}
                  className="flex flex-col gap-4 bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs mb-3"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`flex items-center justify-center rounded-full h-12 w-12 text-white font-bold text-lg shadow-md flex-shrink-0 ${isNonMember ? 'bg-gradient-to-br from-blue-500 to-cyan-600' : 'bg-gradient-to-br from-primary to-purple-600'}`}>
                        {displayName?.charAt(0)?.toUpperCase() || 'G'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-base font-bold leading-tight text-slate-900 dark:text-white truncate">{displayName || 'Unknown'}</p>
                          {isNonMember && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex-shrink-0">NON-MEMBER</span>
                          )}
                        </div>
                        {displayDesignation && (
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-snug truncate">
                            {displayDesignation}
                          </p>
                        )}
                        {displayCompany && (
                          <p className="text-[11px] font-medium text-primary dark:text-blue-400 leading-snug truncate">
                            {displayCompany}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                        registration.status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : registration.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {registration.status.toUpperCase()}
                      </span>
                      {event?.fee > 0 && (
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                          registration.payment_status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : registration.payment_status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {registration.payment_status === 'paid' ? `₹${Number(registration.payment_amount || 0).toLocaleString('en-IN')} PAID`
                            : registration.payment_status === 'failed' ? 'PAYMENT FAILED' : 'UNPAID'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-1 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-xs">
                    {isNonMember ? (
                      <>
                        {registration.guest_email && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm">mail</span>
                            <span className="text-slate-600 dark:text-slate-400">{registration.guest_email}</span>
                          </div>
                        )}
                        {registration.guest_phone && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm">phone</span>
                            <span className="text-slate-600 dark:text-slate-400">{registration.guest_phone}</span>
                          </div>
                        )}
                        {(registration.guest_designation || registration.guest_company) && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm">work</span>
                            <span className="text-slate-600 dark:text-slate-400">
                              {[registration.guest_designation, registration.guest_company].filter(Boolean).join(' • ')}
                            </span>
                          </div>
                        )}
                        {registration.guest_industry_sector && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm">business_center</span>
                            <span className="text-slate-600 dark:text-slate-400">{registration.guest_industry_sector}</span>
                          </div>
                        )}
                        {registration.guest_location && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm">location_on</span>
                            <span className="text-slate-600 dark:text-slate-400">{registration.guest_location}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {registration.member?.email && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm">mail</span>
                            <span className="text-slate-600 dark:text-slate-400">{registration.member.email}</span>
                          </div>
                        )}
                        {registration.member?.phone_number && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm">phone</span>
                            <span className="text-slate-600 dark:text-slate-400">{registration.member.phone_number}</span>
                          </div>
                        )}
                        {(registration.member?.designation || registration.member?.company) && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm">work</span>
                            <span className="text-slate-600 dark:text-slate-400">
                              {[registration.member?.designation, registration.member?.company].filter(Boolean).join(' • ')}
                            </span>
                          </div>
                        )}
                        {registration.member?.industry_sector && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm">business_center</span>
                            <span className="text-slate-600 dark:text-slate-400">{registration.member.industry_sector}</span>
                          </div>
                        )}
                        {registration.member?.itlc_chapter_name && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm">location_on</span>
                            <span className="text-slate-600 dark:text-slate-400">{registration.member.itlc_chapter_name} Chapter</span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-2 text-slate-505 dark:text-slate-500 text-[11px] mt-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="material-symbols-outlined text-xs">schedule</span>
                      <span>Registered: {new Date(registration.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
                      })}</span>
                    </div>
                  </div>
                  
                  {registration.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(registration.id, 'approved')}
                        className="flex-1 flex items-center justify-center rounded-lg h-10 bg-primary text-white text-sm font-bold gap-2"
                      >
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        Accept
                      </button>
                      <button
                        onClick={() => handleAction(registration.id, 'rejected')}
                        className="flex-1 flex items-center justify-center rounded-lg h-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold gap-2 border border-slate-200 dark:border-slate-700"
                      >
                        <span className="material-symbols-outlined text-lg">cancel</span>
                        Reject
                      </button>
                    </div>
                  )}
                  
                  {registration.status === 'approved' && (
                    <div className="flex items-center justify-between">
                      <div className="text-green-600 dark:text-green-400 text-sm font-semibold flex items-center gap-2">
                        <span className="material-symbols-outlined">check_circle</span>
                        Approved
                      </div>
                      <button
                        onClick={() => handleAction(registration.id, 'rejected')}
                        className="text-xs text-slate-505 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        Revoke
                      </button>
                    </div>
                  )}

                  {registration.status === 'rejected' && (
                    <div className="flex items-center justify-between">
                      <div className="text-red-600 dark:text-red-400 text-sm font-semibold flex items-center gap-2">
                        <span className="material-symbols-outlined">cancel</span>
                        Rejected
                      </div>
                      <button
                        onClick={() => handleAction(registration.id, 'approved')}
                        className="text-xs text-slate-505 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  </div>

      {/* Floating Action Button - Create Event */}
      <button
        onClick={() => navigate('/admin/create-event')}
        className="fixed bottom-24 right-6 z-30 size-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title="Create New Event"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>

      <BottomNav />
    </div>
  )
}
