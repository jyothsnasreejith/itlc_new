import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

export default function DigitalMemberIdCard() {
  const navigate = useNavigate()
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [customLogo, setCustomLogo] = useState('')
  const [memberNumber, setMemberNumber] = useState('')

  useEffect(() => {
    fetchMemberData()
    // Load custom logo from localStorage
    const savedLogo = localStorage.getItem('customLogo')
    if (savedLogo) setCustomLogo(savedLogo)
  }, [])

  async function fetchMemberData() {
    try {
      // In a real app, you'd get the current user's ID from auth
      // For now, we'll fetch the first approved member
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('status', 'approved')
        .limit(1)
        .single()

      if (error) throw error
      setMember(data)

      // Generate member number based on creation order
      const { data: allMembers } = await supabase
        .from('members')
        .select('id, created_at')
        .order('created_at', { ascending: true })
      
      if (allMembers && data) {
        const memberIndex = allMembers.findIndex(m => m.id === data.id)
        if (memberIndex !== -1) {
          const paddedNumber = String(memberIndex + 1).padStart(4, '0')
          setMemberNumber(`ITLC${paddedNumber}`)
        }
      }
    } catch (error) {
      console.error('Error fetching member:', error)
      // Set demo data if no member found
      setMember({
        id: '882910',
        full_name: 'Alex Rivera',
        designation: 'Senior Community Lead',
        membership_tier: 'Platinum Member',
        joined_date: 'Jan 12, 2023',
        expiry_date: 'Dec 31, 2024',
        location: 'San Francisco, CA'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="relative flex h-screen w-full flex-col bg-slate-100 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center bg-white dark:bg-slate-800 p-4 pb-2 justify-between border-b border-slate-200 dark:border-slate-700">
        <div 
          onClick={() => navigate(-1)}
          className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center"
        >
          <span className="material-symbols-outlined cursor-pointer">arrow_back_ios</span>
        </div>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight flex-1 text-center">
          Digital Member ID
        </h2>
        <div className="flex w-12 items-center justify-end">
          <button className="flex items-center justify-center rounded-lg h-12 bg-transparent text-slate-900 dark:text-white p-0">
            <span className="material-symbols-outlined">share</span>
          </button>
        </div>
      </div>

      {/* Main Content Scrollable Area */}
      <div className="flex-1 overflow-y-auto pb-24 flex items-center justify-center p-4">
        {/* ID Card */}
        <div className="w-full max-w-sm">
          <div className="bg-white dark:bg-slate-800 rounded-[20px] shadow-2xl overflow-hidden">
            {/* Card Header */}
            <div className="px-4 py-3 flex justify-between items-center">
              <div className="text-slate-900 dark:text-white text-sm font-semibold">
                IT Leaders Community
              </div>
              <div className="border border-dashed border-slate-400 dark:border-slate-600 px-3 py-1.5 rounded-lg overflow-hidden">
                {customLogo ? (
                  <img src={customLogo} alt="Logo" className="h-6 w-auto object-contain" />
                ) : (
                  <img src="/itlc-logo.svg" alt="ITLC Logo" className="h-6 w-auto object-contain" />
                )}
              </div>
            </div>

            {/* Card Middle (Gray Background) */}
            <div className="bg-slate-300 dark:bg-slate-700 h-40 relative">
              {/* Profile Picture Overlapping */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-36 h-36 rounded-full border-8 border-white dark:border-slate-800 overflow-hidden bg-slate-200 dark:bg-slate-600 shadow-lg">
                {member?.profile_image ? (
                  <img 
                    src={member.profile_image} 
                    alt={member.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-center bg-cover bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-6xl text-slate-400 dark:text-slate-500">person</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card Footer */}
            <div className="px-4 pt-20 pb-6 relative">
              <div className="text-center">
                <div className="text-slate-600 dark:text-slate-400 text-sm mb-1">
                  {member?.designation || 'Member'}
                </div>
                <div className="text-green-700 dark:text-green-500 text-lg font-bold uppercase tracking-wide">
                  {member?.full_name}
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  ID: {memberNumber}
                </div>
              </div>

              {/* QR Code - Bottom Right */}
              <div className="absolute right-4 bottom-6 w-20 h-20 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center rounded">
                <span className="material-symbols-outlined text-4xl text-slate-400">qr_code_2</span>
              </div>
            </div>
          </div>

          {/* Membership Details Below Card */}
          <div className="mt-6 bg-white dark:bg-slate-800 rounded-xl p-5 shadow-md">
            <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">
              Membership Info
            </h3>
            <div className="space-y-1">

              <div className="flex justify-between items-center py-2.5 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-base">calendar_today</span>
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Joined</p>
                </div>
                <p className="text-slate-900 dark:text-white text-sm font-semibold text-right">
                  {member?.joined_date || (member?.created_at ? new Date(member.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }) : 'N/A')}
                </p>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-base">event_busy</span>
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Expiry</p>
                </div>
                <p className="text-slate-900 dark:text-white text-sm font-semibold text-right">
                  {member?.expiry_date || 'Dec 31, 2026'}
                </p>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-base">mail</span>
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Email</p>
                </div>
                <p className="text-slate-900 dark:text-white text-sm font-semibold text-right truncate ml-2">
                  {member?.email || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNav />

      {/* iOS Home Indicator Overlay */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full opacity-50"></div>
    </div>
  )
}
