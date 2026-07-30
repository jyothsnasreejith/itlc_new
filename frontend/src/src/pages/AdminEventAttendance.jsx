import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

export default function AdminEventAttendance() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [presentAttendees, setPresentAttendees] = useState([])
  const [absentAttendees, setAbsentAttendees] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('present')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchAttendanceData()
  }, [id])

  async function fetchAttendanceData() {
    try {
      setLoading(true)

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single()

      if (eventError) throw eventError
      setEvent(eventData)

      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', id)

      if (regError) throw regError

      const memberIds = [...new Set((registrations || []).map(r => r.member_id).filter(Boolean))]
      let memberMap = new Map()
      if (memberIds.length > 0) {
        // Include profile_image in selection now that base64 images are migrated to static URLs
        const { data: members, error: membersError } = await supabase
          .from('members')
          .select('id, full_name, designation, email, phone_number, profile_image')
          .in('id', memberIds)

        if (membersError) throw membersError
        memberMap = new Map((members || []).map(m => [m.id, m]))
      }

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

      ;(registrations || []).forEach(reg => {
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
      console.error('Error fetching attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportToExcel = () => {
    const headers = [
      'Name',
      'Type',
      'Email',
      'Phone',
      'Designation',
      'Status',
      'Check-In Time',
      'Check-Out Time',
      'Gift Claimed',
      'Lucky Winner'
    ]

    const rows = presentAttendees.map(p => [
      p.full_name,
      p.isGuest ? 'Guest' : 'Member',
      p.email || '',
      p.phone_number || '',
      p.designation || '',
      p.checkedOutAt || p.checkedOut ? 'Checked Out' : 'Present',
      p.checkedInAt ? formatTime(p.checkedInAt) : '',
      p.checkedOutAt ? formatTime(p.checkedOutAt) : '',
      event?.gift === 'yes' ? (p.giftClaimed === 'yes' ? 'Yes' : 'No') : 'N/A',
      p.luckyDrawWinner ? 'Yes' : 'No'
    ]).concat(
      absentAttendees.map(p => [
        p.full_name,
        p.isGuest ? 'Guest' : 'Member',
        p.email || '',
        p.phone_number || '',
        p.designation || '',
        'Absent',
        '',
        '',
        'N/A',
        'No'
      ])
    )

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${(event?.title || 'event').replace(/\s+/g, '-').toLowerCase()}-attendance-report.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filterPeople = (people) => {
    if (!searchQuery) return people
    return people.filter(p =>
      p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone_number?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const methodLabel = (method) => {
    if (method === 'self_checkin') return 'Self check-in'
    if (method === 'manual') return 'Manual entry'
    return 'Staff scan'
  }

  const filteredPresent = filterPeople(presentAttendees)
  const filteredAbsent = filterPeople(absentAttendees)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center size-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                {event?.title || 'Event Attendance'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {event?.date} · {event?.location}
              </p>
            </div>
            <button
              onClick={() => navigate(`/admin/event-checkin-qr/${id}`)}
              title="Check-In QR Code"
              className="flex items-center justify-center size-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined">qr_code_2</span>
            </button>
            <button
              onClick={() => navigate(`/scanner/${id}`)}
              title="Staff Scanner"
              className="flex items-center justify-center size-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {presentAttendees.length + absentAttendees.length}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">
                Total Registered
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {presentAttendees.length}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">
                Present
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {absentAttendees.length}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">
                Absent
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Lucky Draw Winners Section */}
        {!loading && (
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500 text-2xl animate-bounce">military_tech</span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Lucky Draw Winners</h2>
              </div>
              <button
                onClick={() => navigate(`/admin/spin-wheel?eventId=${id}`)}
                className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <span className="material-symbols-outlined text-xs">casino</span>
                Draw Arena
              </button>
            </div>
            
            {presentAttendees.filter(p => p.luckyDrawWinner).length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No winners have been selected for this event yet. Open the Lucky Draw Arena to spin the wheel!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {presentAttendees
                  .filter(p => p.luckyDrawWinner)
                  .map(winner => (
                    <div key={winner.id} className="bg-white dark:bg-slate-800 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3 shadow-sm relative overflow-hidden">
                      <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-amber-500/10 rounded-full blur-md"></div>
                      
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-amber-500/10 border border-amber-500/30 flex-shrink-0 flex items-center justify-center">
                        {winner.profile_image ? (
                          <img src={winner.profile_image} alt={winner.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-amber-600 text-xl">person</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{winner.full_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{winner.designation || 'Attendee'}</p>
                      </div>
                      <span className="material-symbols-outlined text-amber-500 text-2xl">workspace_premium</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4 animate-pulse">
                <span className="material-symbols-outlined text-4xl text-primary">hourglass_empty</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400">Loading attendance data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Search Bar & Export button */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search attendees..."
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>
              <button
                onClick={handleExportToExcel}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer whitespace-nowrap"
              >
                <span className="material-symbols-outlined">download</span>
                Export Excel
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab('present')}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === 'present'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Present ({filteredPresent.length})
                </span>
              </button>
              <button
                onClick={() => setActiveTab('absent')}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === 'absent'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  Absent ({filteredAbsent.length})
                </span>
              </button>
            </div>

            {/* Table View with fixed height scroll */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              {activeTab === 'present' ? (
                filteredPresent.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">
                      person_off
                    </span>
                    <p className="text-slate-500 dark:text-slate-400">
                      {searchQuery ? 'No attendees found' : 'No one checked in yet'}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto overflow-x-auto relative">
                    <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400 border-collapse">
                      <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700/80 sticky top-0 z-10">
                        <tr>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Name</th>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Contact Details</th>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Designation</th>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Status</th>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Check-In</th>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Check-Out</th>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Gift Claimed</th>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Winner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {filteredPresent.map((person) => (
                          <tr key={person.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                                  {person.profile_image ? (
                                    <img src={person.profile_image} alt={person.full_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="material-symbols-outlined text-xl text-slate-400">person</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold flex items-center gap-1.5">
                                    {person.full_name}
                                    {person.isGuest && (
                                      <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                                        Guest
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-350">
                              <div>{person.email || 'N/A'}</div>
                              <div className="text-slate-400 mt-0.5">{person.phone_number || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-350 whitespace-nowrap">
                              {person.designation || (person.isGuest ? 'Guest' : 'Member')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {person.checkedOutAt || person.checkedOut ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/50">
                                  Checked Out
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700">
                                  Active In Event
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold text-xs mb-0.5">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                <span>{formatTime(person.checkedInAt)}</span>
                              </div>
                              <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                                {methodLabel(person.checkInMethod)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-350 whitespace-nowrap">
                              {person.checkedOutAt ? (
                                <div className="flex items-center gap-1 text-red-500 font-bold">
                                  <span className="material-symbols-outlined text-[14px]">logout</span>
                                  <span>{formatTime(person.checkedOutAt)}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-normal">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {event?.gift === 'yes' ? (
                                person.giftClaimed === 'yes' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/50">
                                    <span className="material-symbols-outlined text-[12px]">card_membership</span>
                                    Claimed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
                                    <span className="material-symbols-outlined text-[12px]">card_membership</span>
                                    Unclaimed
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {person.luckyDrawWinner ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                                  <span className="material-symbols-outlined text-[12px] fill-[1]">workspace_premium</span>
                                  Winner
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                filteredAbsent.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">
                      thumb_up
                    </span>
                    <p className="text-slate-500 dark:text-slate-400">
                      {searchQuery ? 'No attendees found' : 'Everyone registered has checked in!'}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto overflow-x-auto relative">
                    <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400 border-collapse">
                      <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700/80 sticky top-0 z-10">
                        <tr>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Name</th>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Contact Details</th>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Designation</th>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Status</th>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Gift Claimed</th>
                          <th scope="col" className="px-6 py-4 bg-slate-50 dark:bg-slate-700 font-bold border-b border-slate-200 dark:border-slate-600">Winner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {filteredAbsent.map((person) => (
                          <tr key={person.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                                  {person.profile_image ? (
                                    <img src={person.profile_image} alt={person.full_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="material-symbols-outlined text-xl text-slate-400">person</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold flex items-center gap-1.5">
                                    {person.full_name}
                                    {person.isGuest && (
                                      <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                                        Guest
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-350">
                              <div>{person.email || 'N/A'}</div>
                              <div className="text-slate-400 mt-0.5">{person.phone_number || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-350 whitespace-nowrap">
                              {person.designation || (person.isGuest ? 'Guest' : 'Member')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 dark:bg-red-900/20 text-red-650 dark:text-red-400 border border-red-200/50 dark:border-red-900/50">
                                Absent
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                              —
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                              —
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
