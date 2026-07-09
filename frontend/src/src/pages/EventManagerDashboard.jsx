import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function EventManagerDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)

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
    fetchEvents()
  }, [navigate])

  async function fetchEvents() {
    try {
      setLoading(true)
      const currentDate = new Date().toISOString()
      
      // Fetch latest events (upcoming and recent past)
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false })
        .limit(10)

      if (error) throw error

      const eventData = data || []
      setEvents(eventData)

      // Fetch attendance stats for each event
      const statsData = {}
      for (const event of eventData) {
        // Get total registrations
        const { count: registered } = await supabase
          .from('event_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)

        // Get checked-in count
        const { count: checkedIn } = await supabase
          .from('event_attendance')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)

        statsData[event.id] = {
          registered: registered || 0,
          checkedIn: checkedIn || 0,
          absent: (registered || 0) - (checkedIn || 0)
        }
      }

      setStats(statsData)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('user')
    navigate('/login')
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const isUpcoming = (dateString) => {
    if (!dateString) return false
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const currentDate = `${year}-${month}-${day}`
    return dateString >= currentDate
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Event Manager Dashboard
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Welcome back, {user?.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchEvents()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span className="text-sm font-semibold">Refresh</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
                <span className="text-sm font-semibold">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4 animate-pulse">
                <span className="material-symbols-outlined text-4xl text-primary">hourglass_empty</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400">Loading events...</p>
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">
              event_busy
            </span>
            <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
              No events found
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Events Grid */}
            {events.map((event) => {
              const eventStats = stats[event.id] || { registered: 0, checkedIn: 0, absent: 0 }
              const upcoming = isUpcoming(event.date)
              
              return (
                <div
                  key={event.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    {/* Event Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {event.title}
                          </h3>
                          {upcoming && (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
                              Upcoming
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2">
                          {event.description}
                        </p>
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <span className="material-symbols-outlined text-lg">calendar_today</span>
                        <span>{formatDate(event.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <span className="material-symbols-outlined text-lg">schedule</span>
                        <span>{event.time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <span className="material-symbols-outlined text-lg">location_on</span>
                        <span>{event.location}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {eventStats.registered}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">
                          Registered
                        </div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {eventStats.checkedIn}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">
                          Present
                        </div>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {eventStats.absent}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">
                          Absent
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => navigate(`/manager/attendance/${event.id}`)}
                        className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        View Attendance
                      </button>
                      <button
                        onClick={() => navigate(`/scanner/${event.id}`)}
                        className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                      >
                        <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                        Scan QR
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
