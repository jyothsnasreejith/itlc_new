import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

export default function AdminEventRegistrations() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [registrations, setRegistrations] = useState([])
  const [filter, setFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [stats, setStats] = useState({ pending: 0, approved: 0, total: 0, totalCollected: 0 })
  const [eventFee, setEventFee] = useState(0)
  const [loading, setLoading] = useState(true)
  const [eventTitle, setEventTitle] = useState('')

  useEffect(() => {
    fetchRegistrations()
  }, [id, filter, typeFilter])

  async function fetchRegistrations() {
    try {
      setLoading(true)

      // Fetch event title for header
      const { data: eventData } = await supabase
        .from('events')
        .select('title, fee')
        .eq('id', id)
        .maybeSingle()

      if (eventData?.title) {
        setEventTitle(eventData.title)
      }
      if (eventData?.fee) {
        setEventFee(eventData.fee)
      }

      let query = supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', id)

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      let normalizedRegistrations = data || []
      const memberIds = [...new Set(normalizedRegistrations.map((r) => r.member_id).filter(Boolean))]

      if (memberIds.length > 0) {
        const { data: membersData, error: membersError } = await supabase
          .from('members')
          .select('id, full_name, email, phone_number, designation, company, itlc_chapter_name, membership_tier, industry_sector')
          .in('id', memberIds)

        if (membersError) throw membersError

        const memberMap = new Map((membersData || []).map((m) => [m.id, m]))
        normalizedRegistrations = normalizedRegistrations.map((registration) => ({
          ...registration,
          member: memberMap.get(registration.member_id) || null,
        }))
      }

      // Apply type filter
      const filtered = typeFilter === 'non_member'
        ? normalizedRegistrations.filter(r => !r.member_id)
        : typeFilter === 'member'
        ? normalizedRegistrations.filter(r => !!r.member_id)
        : normalizedRegistrations

      setRegistrations(filtered)

      // Calculate stats from all (unfiltered)
      const pending = normalizedRegistrations.filter(r => r.status === 'pending').length || 0
      const approved = normalizedRegistrations.filter(r => r.status === 'approved').length || 0
      const nonMembers = normalizedRegistrations.filter(r => !r.member_id).length || 0
      const totalCollected = normalizedRegistrations
        .filter(r => r.payment_status === 'paid')
        .reduce((sum, r) => sum + (r.payment_amount || 0), 0)
      setStats({ pending, approved, total: normalizedRegistrations.length || 0, totalCollected, nonMembers })
    } catch (error) {
      console.error('Error fetching registrations:', error)
    } finally {
      setLoading(false)
    }
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
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-[430px] mx-auto border-x border-slate-200 dark:border-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center justify-center size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="text-lg font-bold leading-tight tracking-tight">Event Registrations</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{eventTitle || 'Event'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/admin/event-checkin-qr/${id}`)}
            title="Check-In QR Code"
            className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined">qr_code_2</span>
          </button>
          <button className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
            <span className="material-symbols-outlined">search</span>
          </button>
        </div>
      </header>

      {/* Stats Overview */}
      <section className="p-4 flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-3">
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
            <p className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">Non-Mbr</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.nonMembers || 0}</p>
          </div>
        </div>
        {eventFee > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg">account_balance_wallet</span>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400">Total Collected</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">₹{Number(stats.totalCollected).toLocaleString('en-IN')}</p>
              </div>
            </div>
            <div className="text-right text-xs text-emerald-600 dark:text-emerald-400">
              <p>Fee: ₹{Number(eventFee).toLocaleString('en-IN')}</p>
              <p>{stats.totalCollected > 0 ? Math.round(stats.totalCollected / eventFee) : 0} paid</p>
            </div>
          </div>
        )}
      </section>

      {/* Filters Section */}
      <div className="px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Reviewing Interests</h3>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium ${
              filter === 'all'
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            All Requests
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium ${
              filter === 'pending'
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium ${
              filter === 'approved'
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Reviewed
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mt-2">
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
      </div>

      {/* Registration List */}
      <main className="flex-1 flex flex-col gap-1 p-4">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : registrations.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No registrations found</div>
        ) : (
          registrations.map((registration) => {
            const isNonMember = !registration.member_id
            const displayName = isNonMember ? registration.guest_name : registration.member?.full_name
            const displayDesignation = isNonMember ? registration.guest_designation : registration.member?.designation
            return (
            <div
              key={registration.id}
              className="flex flex-col gap-4 bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-2"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`flex items-center justify-center rounded-full h-12 w-12 text-white font-bold text-lg shadow-md flex-shrink-0 ${isNonMember ? 'bg-gradient-to-br from-blue-500 to-cyan-600' : 'bg-gradient-to-br from-primary to-purple-600'}`}>
                    {displayName?.charAt(0)?.toUpperCase() || 'G'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-base font-bold leading-none truncate">{displayName || 'Unknown'}</p>
                      {isNonMember && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex-shrink-0">NON-MEMBER</span>
                      )}
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium truncate">
                      {displayDesignation || (isNonMember ? 'Non-Member' : 'Member')}
                    </p>
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
                  {eventFee > 0 && (
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
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-500 text-[11px] mt-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-xs">schedule</span>
                  <span>Registered: {new Date(registration.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
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
                    className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
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
                    className="text-xs text-slate-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          )
          })
        )}
      </main>

      {/* Floating Action Button - Create Event */}
      <button
        onClick={() => navigate('/admin/create-event')}
        className="fixed bottom-24 right-6 z-30 size-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title="Create New Event"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  )
}
