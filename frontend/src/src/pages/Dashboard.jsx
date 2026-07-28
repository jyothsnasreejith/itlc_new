import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({
    totalMembers: 0,
    approvedMembers: 0,
    pendingMembers: 0,
    maxMembers: 1000,
    totalEvents: 0,
    upcomingEvents: 0,
    completedEvents: 0,
    totalRegistrations: 0,
    totalAttendance: 0
  })
  const [recentEvents, setRecentEvents] = useState([])
  const [recentMembers, setRecentMembers] = useState([])
  const [registrationCounts, setRegistrationCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check authentication
    const userData = localStorage.getItem('user')
    if (!userData) {
      navigate('/login')
      return
    }
    const parsedUser = JSON.parse(userData)
    
    // Redirect Event Managers to their own dashboard
    if (parsedUser.role === 'event_manager') {
      navigate('/manager/dashboard')
      return
    }
    
    setUser(parsedUser)
    fetchDashboardData()
  }, [navigate])

  async function fetchDashboardData() {
    setLoading(true)
    try {
      const d = new Date()
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const currentDate = `${year}-${month}-${day}`

      const [
        totalMembersResult,
        approvedMembersResult,
        pendingMembersResult,
        totalEventsResult,
        upcomingEventsResult,
        expiredEventsResult,
        totalRegistrationsResult,
        totalAttendanceResult,
        recentEventsResult,
        recentMembersResult
      ] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }).gte('date', currentDate),
        supabase.from('events').select('id', { count: 'exact', head: true }).lt('date', currentDate),
        supabase.from('event_registrations').select('id', { count: 'exact', head: true }),
        supabase.from('event_attendance').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id, title, date, time, status').gte('date', currentDate).order('date', { ascending: true }).limit(5),
        supabase.from('members').select('id, full_name, designation, company, profile_image').eq('status', 'approved').order('created_at', { ascending: false }).limit(5)
      ])

      const maxMembers = 1000

      setStats({
        totalMembers: Number(totalMembersResult?.count || 0),
        approvedMembers: Number(approvedMembersResult?.count || 0),
        pendingMembers: Number(pendingMembersResult?.count || 0),
        maxMembers: 1000,
        totalEvents: Number(totalEventsResult?.count || 0),
        upcomingEvents: Number(upcomingEventsResult?.count || 0),
        completedEvents: Number(expiredEventsResult?.count || 0),
        totalRegistrations: Number(totalRegistrationsResult?.count || 0),
        totalAttendance: Number(totalAttendanceResult?.count || 0)
      })

      setRecentEvents(recentEventsResult?.data || [])
      setRecentMembers(recentMembersResult?.data || [])

      if (recentEventsResult?.data?.length > 0) {
        const eventIds = recentEventsResult.data.map(e => e.id)
        const { data: registrations } = await supabase
          .from('event_registrations')
          .select('event_id')
          .in('event_id', eventIds)

        const counts = {}
        eventIds.forEach(id => {
          counts[id] = 0
        })
        registrations?.forEach(reg => {
          counts[reg.event_id] = (counts[reg.event_id] || 0) + 1
        })
        setRegistrationCounts(counts)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setStats({
        totalMembers: 0,
        approvedMembers: 0,
        pendingMembers: 0,
        maxMembers: 1000,
        totalEvents: 0,
        upcomingEvents: 0,
        completedEvents: 0,
        totalRegistrations: 0,
        totalAttendance: 0
      })
      setRecentEvents([])
      setRecentMembers([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  function handleLogout() {
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Welcome back, {user?.name || 'Admin'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/admin/membership-requests')}
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400">notifications</span>
              {stats.pendingMembers > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
                  {stats.pendingMembers}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="size-10 rounded-full bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center transition-colors active:scale-95"
              title="Logout"
            >
              <span className="material-symbols-outlined text-red-600 dark:text-red-400">logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Key Metrics Grid */}
        <section>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-3">Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Members */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="size-10 sm:size-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-500 text-xl sm:text-2xl">group</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{stats.totalMembers}</p>
                <p className="text-base sm:text-xl font-semibold text-slate-400 dark:text-slate-500">/ {stats.maxMembers}</p>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Total Members</p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                <span className="text-[11px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded font-medium">
                  {stats.approvedMembers} Approved
                </span>
                {stats.pendingMembers > 0 && (
                  <span className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded">
                    {stats.pendingMembers} Pending
                  </span>
                )}
              </div>
            </div>

            {/* Total Events */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className="size-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-purple-500 text-2xl">event</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalEvents}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total Events</p>
              <div className="flex gap-2 mt-3">
                <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
                  {stats.upcomingEvents} Upcoming
                </span>
                <span className="text-xs bg-slate-500/10 text-slate-600 dark:text-slate-400 px-2 py-1 rounded">
                  {stats.completedEvents} Expired
                </span>
              </div>
            </div>

            {/* Total Registrations */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className="size-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-green-500 text-2xl">person_add</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalRegistrations}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Event Registrations</p>
            </div>

            {/* Total Attendance */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className="size-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-orange-500 text-2xl">check_circle</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalAttendance}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total Attendance</p>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/admin/create-event')}
              className="bg-primary text-white rounded-xl p-4 flex flex-col items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl transition-shadow"
            >
              <span className="material-symbols-outlined text-3xl">add_circle</span>
              <span className="text-sm font-semibold">Create Event</span>
            </button>
            <button
              onClick={() => navigate('/admin/membership-requests')}
              className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl p-4 flex flex-col items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors"
            >
              <span className="material-symbols-outlined text-3xl">approval</span>
              <span className="text-sm font-semibold">Review Requests</span>
            </button>
            <button
              onClick={() => navigate('/events')}
              className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl p-4 flex flex-col items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors"
            >
              <span className="material-symbols-outlined text-3xl">calendar_view_month</span>
              <span className="text-sm font-semibold">View Events</span>
            </button>
            <button
              onClick={() => navigate('/membership-registration')}
              className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl p-4 flex flex-col items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors"
            >
              <span className="material-symbols-outlined text-3xl">person_add</span>
              <span className="text-sm font-semibold">Add Member</span>
            </button>
          </div>
        </section>

        {/* Recent Members */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Members</h2>
            <button onClick={() => navigate('/admin/membership-requests')} className="text-sm text-primary font-medium">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentMembers.length === 0 ? (
              <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400">No members yet</p>
              </div>
            ) : (
              recentMembers.map(member => (
                <div
                  key={member.id}
                  onClick={() => navigate(`/member/profile/${member.id}`)}
                  className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors cursor-pointer"
                >
                  <div className="flex gap-3 items-center">
                    <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {member.profile_image ? (
                        <img src={member.profile_image} alt={member.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-primary">person</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white">{member.full_name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{member.designation || 'Member'}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Events */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Events</h2>
            <button onClick={() => navigate('/events')} className="text-sm text-primary font-medium">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentEvents.length === 0 ? (
              <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400">No upcoming events</p>
              </div>
            ) : (
              recentEvents.map(event => (
                <div
                  key={event.id}
                  onClick={() => navigate(`/admin/event-registrations/${event.id}`)}
                  className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors cursor-pointer"
                >
                  <div className="flex gap-3">
                    <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary">event</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white">{event.title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        <span className="material-symbols-outlined text-xs align-middle">calendar_today</span>
                        {event.date} • {event.time}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        <span className="material-symbols-outlined text-xs align-middle">location_on</span>
                        {event.location}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-primary bg-primary/10 w-fit px-2 py-0.5 rounded">
                        <span className="material-symbols-outlined text-xs">group</span>
                        <span className="text-xs font-semibold">
                          {registrationCounts[event.id] || 0}
                          {event.max_registrations && ` / ${event.max_registrations}`} Registered
                        </span>
                      </div>
                    </div>
                    <div className={`px-2 py-1 h-fit rounded text-xs font-semibold ${
                      new Date(event.date) >= new Date() ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                      'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                    }`}>
                      {new Date(event.date) >= new Date() ? 'Upcoming' : 'Expired'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
