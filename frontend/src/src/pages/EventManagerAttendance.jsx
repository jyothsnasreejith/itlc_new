import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function EventManagerAttendance() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [event, setEvent] = useState(null)
  const [presentMembers, setPresentMembers] = useState([])
  const [absentMembers, setAbsentMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('present')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      navigate('/login')
      return
    }
    const parsedUser = JSON.parse(userData)
    if (parsedUser.role !== 'event_manager') {
      navigate('/login')
      return
    }
    setUser(parsedUser)
    fetchAttendanceData()
  }, [eventId, navigate])

  async function fetchAttendanceData() {
    try {
      setLoading(true)

      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (eventError) throw eventError
      setEvent(eventData)

      // Fetch all registered members
      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select(`
          *,
          member:member_id (
            id,
            full_name,
            profile_image,
            designation,
            email,
            phone_number
          )
        `)
        .eq('event_id', eventId)

      if (regError) throw regError

      // Fetch attendance records
      const { data: attendance, error: attError } = await supabase
        .from('event_attendance')
        .select('*')
        .eq('event_id', eventId)

      if (attError) throw attError

      // Create attendance map
      const attendanceMap = new Map()
      attendance.forEach(att => {
        attendanceMap.set(att.member_id, att.checked_in_at)
      })

      // Separate present and absent members
      const present = []
      const absent = []

      registrations.forEach(reg => {
        if (reg.member) {
          const checkedInAt = attendanceMap.get(reg.member.id)
          if (checkedInAt) {
            present.push({
              ...reg.member,
              checkedInAt: checkedInAt
            })
          } else {
            absent.push(reg.member)
          }
        }
      })

      // Sort present by check-in time (most recent first)
      present.sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt))

      // Sort absent alphabetically
      absent.sort((a, b) => a.full_name.localeCompare(b.full_name))

      setPresentMembers(present)
      setAbsentMembers(absent)
    } catch (error) {
      console.error('Error fetching attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterMembers = (members) => {
    if (!searchQuery) return members
    return members.filter(m => 
      m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.designation?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    })
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    })
  }

  const filteredPresentMembers = filterMembers(presentMembers)
  const filteredAbsentMembers = filterMembers(absentMembers)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-6">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/manager/dashboard')}
              className="flex items-center justify-center size-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {event?.title || 'Event Attendance'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {event?.date && formatDate(event.date)} • {event?.location}
              </p>
            </div>
            <button
              onClick={() => navigate(`/scanner/${eventId}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors"
            >
              <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
              <span className="text-sm font-semibold hidden sm:inline">Scan QR</span>
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {presentMembers.length + absentMembers.length}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">
                Total Registered
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {presentMembers.length}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">
                Present
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {absentMembers.length}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">
                Absent
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                  placeholder="Search members..."
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
                  Present ({filteredPresentMembers.length})
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
                  Absent ({filteredAbsentMembers.length})
                </span>
              </button>
            </div>

            {/* Members List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              {activeTab === 'present' ? (
                filteredPresentMembers.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">
                      person_off
                    </span>
                    <p className="text-slate-500 dark:text-slate-400">
                      {searchQuery ? 'No members found' : 'No members checked in yet'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredPresentMembers.map((member) => (
                      <div key={member.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                            {member.profile_image ? (
                              <img
                                src={member.profile_image}
                                alt={member.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl text-slate-400">person</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                              {member.full_name}
                            </div>
                            {member.designation && (
                              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-snug truncate">
                                {member.designation}
                              </div>
                            )}
                            {member.company && (
                              <div className="text-[11px] font-medium text-primary dark:text-blue-400 leading-snug truncate">
                                {member.company}
                              </div>
                            )}
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">
                              {member.email}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400 mb-1">
                              <span className="material-symbols-outlined text-sm">check_circle</span>
                              <span className="text-xs font-semibold">Checked In</span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {formatTime(member.checkedInAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                filteredAbsentMembers.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">
                      thumb_up
                    </span>
                    <p className="text-slate-500 dark:text-slate-400">
                      {searchQuery ? 'No members found' : 'All registered members have checked in!'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredAbsentMembers.map((member) => (
                      <div key={member.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                            {member.profile_image ? (
                              <img
                                src={member.profile_image}
                                alt={member.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl text-slate-400">person</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate">
                              {member.full_name}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                              {member.designation || 'Member'}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">
                              {member.email}
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
    </div>
  )
}
