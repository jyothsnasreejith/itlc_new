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
          present.push({ ...person, checkedInAt: att.checked_in_at, checkInMethod: att.check_in_method || 'staff_scan' })
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
      <main className="max-w-7xl mx-auto px-4 py-6">
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
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
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

            {/* List */}
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
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredPresent.map((person) => (
                      <div key={person.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                            {person.profile_image ? (
                              <img src={person.profile_image} alt={person.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl text-slate-400">person</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-2">
                              {person.full_name}
                              {person.isGuest && (
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                  Guest
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                              {person.designation || (person.isGuest ? 'Guest' : 'Member')}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">
                              {person.phone_number || person.email}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400 mb-1">
                              <span className="material-symbols-outlined text-sm">check_circle</span>
                              <span className="text-xs font-semibold">{formatTime(person.checkedInAt)}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500">
                              {methodLabel(person.checkInMethod)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredAbsent.map((person) => (
                      <div key={person.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                            {person.profile_image ? (
                              <img src={person.profile_image} alt={person.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl text-slate-400">person</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-2">
                              {person.full_name}
                              {person.isGuest && (
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                  Guest
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                              {person.designation || (person.isGuest ? 'Guest' : 'Member')}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">
                              {person.phone_number || person.email}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                              <span className="material-symbols-outlined text-sm">cancel</span>
                              <span className="text-xs font-semibold">Not Checked In</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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
