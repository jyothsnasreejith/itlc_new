import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const PAGE_SIZE = 20

export default function AdminMembershipRequests() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [selectedMember, setSelectedMember] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState('pending')
  const [sortBy, setSortBy] = useState('date-desc')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const loaderRef = useRef(null)
  const searchDebounceRef = useRef(null)

  // Debounce search input
  useEffect(() => {
    clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 350)
    return () => clearTimeout(searchDebounceRef.current)
  }, [searchQuery])

  // Reset and refetch when tab or debounced search changes
  useEffect(() => {
    setRequests([])
    setPage(0)
    setHasMore(false)
    fetchRequests(0, true)
  }, [activeTab, debouncedSearch])

  // Load more when page increments (skip initial load which is handled above)
  useEffect(() => {
    if (page === 0) return
    fetchRequests(page, false)
  }, [page])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSortDropdown && !event.target.closest('.sort-dropdown-container')) {
        setShowSortDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSortDropdown])

  // Infinite scroll observer — only for approved tab
  useEffect(() => {
    if (activeTab !== 'approved') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setPage(prev => prev + 1)
        }
      },
      { threshold: 0.1 }
    )
    if (loaderRef.current) observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [activeTab, hasMore, loadingMore])

  async function fetchRequests(pageNum, isReset) {
    if (isReset) setLoading(true)
    else setLoadingMore(true)

    try {
      if (activeTab === 'approved') {
        // Server-side paginated fetch with optional search
        let query = supabase
          .from('members')
          .select('*')
          .eq('status', 'approved')

        if (debouncedSearch.trim()) {
          const q = debouncedSearch.trim()
          query = query.or(
            `full_name.ilike.%${q}%,company.ilike.%${q}%,phone_number.ilike.%${q}%,designation.ilike.%${q}%`
          )
        }

        query = query
          .order('created_at', { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

        const { data, error } = await query
        if (error) throw error

        setHasMore((data || []).length === PAGE_SIZE)
        setRequests(prev => isReset ? (data || []) : [...prev, ...(data || [])])
      } else {
        // For pending/rejected: fetch all (small lists)
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .eq('status', activeTab)
          .order('created_at', { ascending: false })

        if (error) throw error
        setRequests(data || [])
        setHasMore(false)
      }

      // Fetch stats counts
      const [{ count: pendingCount }, { count: approvedCount }, { count: rejectedCount }] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      ])

      setStats({
        pending: pendingCount || 0,
        approved: approvedCount || 0,
        rejected: rejectedCount || 0
      })
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  async function handleAction(memberId, action) {
    try {
      const { data: beforeData, error: beforeError } = await supabase
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single()

      if (beforeError) {
        alert(`Error finding member: ${beforeError.message}`)
        return
      }

      const { data, error } = await supabase
        .from('members')
        .update({ status: action })
        .eq('id', memberId)
        .select()

      if (error) {
        alert(`Database error: ${error.message}`)
        throw error
      }

      setShowModal(false)
      setSelectedMember(null)

      if (action === 'approved') {
        alert('Member approved successfully! Switching to approved list...')
        await new Promise(resolve => setTimeout(resolve, 300))
        setActiveTab('approved')
      } else {
        setRequests(prev => prev.filter(req => req.id !== memberId))
        setStats(prev => ({ ...prev, pending: prev.pending - 1 }))
        alert('Member rejected successfully!')
      }
    } catch (error) {
      console.error('Error updating request:', error)
      alert(`Error updating request: ${error.message || 'Unknown error'}`)
    }
  }

  function handleViewDetails(member) {
    navigate(`/member/profile/${member.id}`)
  }

  function closeModal() {
    setShowModal(false)
    setSelectedMember(null)
  }

  // Sort (client-side for all tabs)
  const sortRequests = (requestsToSort) => {
    const sorted = [...requestsToSort]
    switch (sortBy) {
      case 'date-desc': return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      case 'date-asc': return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      case 'designation-asc': return sorted.sort((a, b) => (a.designation || '').toLowerCase().localeCompare((b.designation || '').toLowerCase()))
      case 'designation-desc': return sorted.sort((a, b) => (b.designation || '').toLowerCase().localeCompare((a.designation || '').toLowerCase()))
      case 'name-asc': return sorted.sort((a, b) => (a.full_name || '').toLowerCase().localeCompare((b.full_name || '').toLowerCase()))
      case 'name-desc': return sorted.sort((a, b) => (b.full_name || '').toLowerCase().localeCompare((a.full_name || '').toLowerCase()))
      default: return sorted
    }
  }

  const getSortLabel = () => {
    switch (sortBy) {
      case 'date-desc': return 'Newest First'
      case 'date-asc': return 'Oldest First'
      case 'designation-asc': return 'Designation A-Z'
      case 'designation-desc': return 'Designation Z-A'
      case 'name-asc': return 'Name A-Z'
      case 'name-desc': return 'Name Z-A'
      default: return 'Sort By'
    }
  }

  // For pending/rejected: client-side filter + sort
  // For approved: server-side search already applied, just sort loaded pages
  const filterRequests = (requestsToFilter) => {
    if (activeTab === 'approved') return requestsToFilter
    if (!searchQuery.trim()) return requestsToFilter
    const query = searchQuery.toLowerCase().trim()
    return requestsToFilter.filter(request =>
      (request.full_name || '').toLowerCase().includes(query) ||
      (request.company || '').toLowerCase().includes(query) ||
      (request.phone_number || '').toLowerCase().includes(query) ||
      (request.designation || '').toLowerCase().includes(query)
    )
  }

  const filteredRequests = filterRequests(requests)
  const sortedRequests = sortRequests(filteredRequests)

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 md:px-6 py-4 md:py-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div
              onClick={() => navigate(-1)}
              className="text-primary cursor-pointer"
            >
              <span className="material-symbols-outlined">arrow_back_ios</span>
            </div>
            {!showSearch && (
              <h1 className="text-xl font-bold tracking-tight">Membership Requests</h1>
            )}
          </div>
          {showSearch ? (
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, company, phone, designation..."
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => { setShowSearch(false); setSearchQuery('') }}
                className="flex items-center justify-center size-10 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">close</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center justify-center size-10 rounded-full bg-slate-200/50 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-primary">search</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24">
        {/* Summary Stats Section */}
        <div className="p-4 md:p-6">
          <div className="max-w-7xl mx-auto flex flex-wrap gap-4">
            <div
              onClick={() => setActiveTab('pending')}
              className={`flex flex-1 flex-col gap-1 rounded-xl p-5 cursor-pointer transition-all ${
                activeTab === 'pending'
                  ? 'bg-primary/10 border-2 border-primary shadow-lg shadow-primary/20'
                  : 'bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:shadow-md'
              }`}
            >
              <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">
                Total Pending
              </p>
              <div className="flex items-end gap-2">
                <p className={`text-3xl font-bold ${
                  activeTab === 'pending' ? 'text-primary' : 'text-slate-900 dark:text-white'
                }`}>{stats.pending}</p>
              </div>
            </div>
            <div
              onClick={() => setActiveTab('approved')}
              className={`flex flex-1 flex-col gap-1 rounded-xl p-5 cursor-pointer transition-all ${
                activeTab === 'approved'
                  ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-600 shadow-lg shadow-green-500/20'
                  : 'bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:border-green-400 hover:shadow-md'
              }`}
            >
              <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">
                Approved
              </p>
              <div className="flex items-end gap-2">
                <p className={`text-3xl font-bold ${
                  activeTab === 'approved' ? 'text-green-600 dark:text-green-500' : 'text-slate-900 dark:text-white'
                }`}>{stats.approved}</p>
              </div>
            </div>
            <div
              onClick={() => setActiveTab('rejected')}
              className={`flex flex-1 flex-col gap-1 rounded-xl p-5 cursor-pointer transition-all ${
                activeTab === 'rejected'
                  ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-600 shadow-lg shadow-red-500/20'
                  : 'bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:border-red-400 hover:shadow-md'
              }`}
            >
              <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">
                Rejected
              </p>
              <div className="flex items-end gap-2">
                <p className={`text-3xl font-bold ${
                  activeTab === 'rejected' ? 'text-red-600 dark:text-red-500' : 'text-slate-900 dark:text-white'
                }`}>{stats.rejected}</p>
              </div>
            </div>
          </div>
        </div>

        {/* List Section Header */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-2">
          <div>
            <h2 className="text-lg md:text-xl font-bold">
              {activeTab === 'pending' ? 'Pending Applications' : activeTab === 'approved' ? 'Approved Members' : 'Rejected Applications'}
            </h2>
            {searchQuery && activeTab === 'approved' && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {loading ? 'Searching...' : `${sortedRequests.length} result${sortedRequests.length !== 1 ? 's' : ''} loaded`}
              </p>
            )}
            {searchQuery && activeTab !== 'approved' && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {filteredRequests.length} result{filteredRequests.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
          <div className="relative sort-dropdown-container">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
            >
              <span className="material-symbols-outlined text-lg">sort</span>
              <span>{getSortLabel()}</span>
              <span className="material-symbols-outlined text-lg">{showSortDropdown ? 'expand_less' : 'expand_more'}</span>
            </button>

            {showSortDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sort By</p>
                </div>
                <div className="py-1">
                  <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Date</p>
                  <button
                    onClick={() => { setSortBy('date-desc'); setShowSortDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3 ${
                      sortBy === 'date-desc' ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">arrow_downward</span>
                    Newest First
                  </button>
                  <button
                    onClick={() => { setSortBy('date-asc'); setShowSortDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3 ${
                      sortBy === 'date-asc' ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">arrow_upward</span>
                    Oldest First
                  </button>
                </div>
                <div className="py-1 border-t border-slate-200 dark:border-slate-800">
                  <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Designation</p>
                  <button
                    onClick={() => { setSortBy('designation-asc'); setShowSortDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3 ${
                      sortBy === 'designation-asc' ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">sort_by_alpha</span>
                    A to Z
                  </button>
                  <button
                    onClick={() => { setSortBy('designation-desc'); setShowSortDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3 ${
                      sortBy === 'designation-desc' ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg" style={{ transform: 'scaleY(-1)' }}>sort_by_alpha</span>
                    Z to A
                  </button>
                </div>
                <div className="py-1 border-t border-slate-200 dark:border-slate-800">
                  <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Name</p>
                  <button
                    onClick={() => { setSortBy('name-asc'); setShowSortDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3 ${
                      sortBy === 'name-asc' ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">sort_by_alpha</span>
                    A to Z
                  </button>
                  <button
                    onClick={() => { setSortBy('name-desc'); setShowSortDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3 ${
                      sortBy === 'name-desc' ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg" style={{ transform: 'scaleY(-1)' }}>sort_by_alpha</span>
                    Z to A
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Request List Items */}
        <div className="flex flex-col gap-1 px-4 md:px-6 max-w-7xl mx-auto">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No {activeTab} {activeTab === 'pending' ? 'requests' : 'members'}
            </div>
          ) : sortedRequests.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700 mb-3">search_off</span>
              <p className="font-semibold">No results found</p>
              <p className="text-sm mt-1">Try searching with different keywords</p>
            </div>
          ) : (
            <>
              {sortedRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-4 bg-white dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm mt-2"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-14 w-14 ring-2 ring-primary/20 bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 flex items-center justify-center overflow-hidden">
                      {request.profile_image ? (
                        <img src={request.profile_image} alt={request.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-primary font-bold text-xl">
                          {request.full_name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col flex-1">
                      <p className="text-base font-bold leading-tight">{request.full_name}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-tighter">
                          {request.designation || 'N/A'}
                        </p>
                        {request.company && (
                          <>
                            <span className="text-slate-400 dark:text-slate-600 text-xs">•</span>
                            <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                              {request.company}
                            </p>
                          </>
                        )}
                      </div>
                      {activeTab === 'approved' && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="material-symbols-outlined text-green-600 dark:text-green-500 text-xs">calendar_month</span>
                          <p className="text-green-600 dark:text-green-500 text-xs font-medium">
                            Joined {new Date(request.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      )}
                      {activeTab === 'pending' && (
                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                          Requested {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`tel:${request.phone_number}`}
                        className="size-9 flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        title="Call"
                      >
                        <span className="material-symbols-outlined text-base">call</span>
                      </a>
                      <a
                        href={`https://wa.me/${request.phone_number.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="size-9 flex items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                        title="WhatsApp"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                      </a>
                      {request.email && (
                        <a
                          href={`mailto:${request.email}`}
                          className="size-9 flex items-center justify-center rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                          title="Email"
                        >
                          <span className="material-symbols-outlined text-base">mail</span>
                        </a>
                      )}
                      {(activeTab === 'pending' || activeTab === 'rejected') && (
                        <button
                          onClick={() => handleViewDetails(request)}
                          className="size-9 flex items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary/20 transition-colors"
                          title="View Details"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {activeTab === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetails(request)}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleAction(request.id, 'approved')}
                        className="flex-1 bg-primary text-white py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleAction(request.id, 'rejected')}
                        className="flex-1 bg-red-500 dark:bg-red-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  ) : activeTab === 'rejected' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetails(request)}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleAction(request.id, 'approved')}
                        className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-green-600/20 hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        Re-approve
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleViewDetails(request)}
                      className="w-full px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-lg">visibility</span>
                      View Details
                    </button>
                  )}
                </div>
              ))}

              {/* Infinite scroll sentinel & loader — approved tab only */}
              {activeTab === 'approved' && (
                <div ref={loaderRef} className="py-4 flex justify-center">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                      <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Loading more members...
                    </div>
                  )}
                  {!hasMore && !loadingMore && sortedRequests.length > 0 && (
                    <p className="text-slate-400 dark:text-slate-600 text-xs">
                      All {sortedRequests.length} members loaded
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Member Details Modal */}
      {showModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Member Details</h2>
              <button
                onClick={closeModal}
                className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-col items-center gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
                <div className="size-24 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary text-4xl font-bold overflow-hidden ring-4 ring-primary/10">
                  {selectedMember.profile_image ? (
                    <img src={selectedMember.profile_image} alt={selectedMember.full_name} className="w-full h-full object-cover" />
                  ) : (
                    selectedMember.full_name?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedMember.full_name}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    Applied on {new Date(selectedMember.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="size-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">call</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">Professional Phone</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">{selectedMember.professional_phone || selectedMember.phone_number}</p>
                  </div>
                </div>

                {selectedMember.personal_phone && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="size-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">phone_iphone</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">Personal Phone</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">{selectedMember.personal_phone}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="size-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">work</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">Professional/Work Email</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">{selectedMember.professional_email || selectedMember.email}</p>
                  </div>
                </div>

                {selectedMember.personal_email && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="size-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">mail</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">Personal Email</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">{selectedMember.personal_email}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="size-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">work</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">Designation</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">{selectedMember.designation || 'Not provided'}</p>
                  </div>
                </div>

                {selectedMember.company && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="size-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">business</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">Company</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">{selectedMember.company}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="size-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">psychology</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">Area of Expertise</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">{selectedMember.area_of_expertise || 'Not provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="size-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">location_on</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">Location</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">{selectedMember.location || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {selectedMember.status === 'pending' ? (
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => handleAction(selectedMember.id, 'approved')}
                    className="flex-1 bg-primary text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                    Accept Member
                  </button>
                  <button
                    onClick={() => handleAction(selectedMember.id, 'rejected')}
                    className="flex-1 bg-red-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">cancel</span>
                    Reject
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-4 px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                  <span className="material-symbols-outlined text-green-600 dark:text-green-500 text-2xl">verified</span>
                  <div className="flex-1">
                    <p className="text-green-700 dark:text-green-400 text-base font-bold">Verified Member</p>
                    <p className="text-green-600 dark:text-green-500 text-xs">This member has been approved and is active</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button - Create New Member */}
      <button
        onClick={() => navigate('/membership-registration')}
        className="fixed bottom-24 right-6 z-30 size-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title="Create New Member"
      >
        <span className="material-symbols-outlined text-3xl">person_add</span>
      </button>

      <BottomNav />
    </div>
  )
}
