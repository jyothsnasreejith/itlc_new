import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

// Custom sound generator using Web Audio API (no external asset needed)
const playTickSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, audioCtx.currentTime)
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05)
    
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    
    osc.start()
    osc.stop(audioCtx.currentTime + 0.05)
  } catch (e) {
    // Web audio blocked or unsupported
  }
}

const playWinSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc1 = audioCtx.createOscillator()
    const osc2 = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime) // C5
    osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.4) // A5
    
    osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime) // E5
    osc2.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.4) // C6

    gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5)

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(audioCtx.destination)

    osc1.start()
    osc2.start()
    osc1.stop(audioCtx.currentTime + 0.5)
    osc2.stop(audioCtx.currentTime + 0.5)
  } catch (e) {
    // Web audio blocked or unsupported
  }
}

export default function AdminSpinWheel() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const confettiCanvasRef = useRef(null)
  
  const [events, setEvents] = useState([])
  const [filteredEvents, setFilteredEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  
  // Filters
  const [dateFilter, setDateFilter] = useState('')
  const [cutoffTime, setCutoffTime] = useState('')
  
  // Candidates State
  const [loading, setLoading] = useState(false)
  const [allAttendees, setAllAttendees] = useState([])
  const [excludedIds, setExcludedIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  
  // Spin State
  const [currentAngle, setCurrentAngle] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [winner, setWinner] = useState(null)
  const [showWinnerModal, setShowWinnerModal] = useState(false)
  
  const angleRef = useRef(0)
  const isSpinningRef = useRef(false)
  const candidatesRef = useRef([])

  // Fetch events list on load
  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error
      setEvents(data || [])
      
      // Default date filter to today's local date
      const d = new Date()
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const todayStr = `${year}-${month}-${day}`
      setDateFilter(todayStr)
    } catch (e) {
      console.error('Error fetching events:', e)
    }
  }

  // Filter events based on Date Filter
  useEffect(() => {
    if (!events.length) return
    let filtered = events
    if (dateFilter) {
      filtered = events.filter(e => e.date === dateFilter)
    }
    setFilteredEvents(filtered)
    
    // Auto-select first event if matches exist
    if (filtered.length > 0) {
      setSelectedEventId(filtered[0].id)
    } else {
      setSelectedEventId('')
      setAllAttendees([])
    }
  }, [dateFilter, events])

  // Fetch attendance when event changes
  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEvent(null)
      setAllAttendees([])
      return
    }
    const current = events.find(e => e.id === selectedEventId)
    setSelectedEvent(current || null)
    fetchAttendees(selectedEventId)
  }, [selectedEventId])

  async function fetchAttendees(eventId) {
    try {
      setLoading(true)
      setExcludedIds(new Set())
      
      // Fetch registrations
      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', eventId)

      if (regError) throw regError

      const memberIds = [...new Set((registrations || []).map(r => r.member_id).filter(Boolean))]
      let memberMap = new Map()
      if (memberIds.length > 0) {
        const { data: members, error: membersError } = await supabase
          .from('members')
          .select('id, full_name, designation, email, phone_number, profile_image')
          .in('id', memberIds)

        if (membersError) throw membersError
        memberMap = new Map((members || []).map(m => [m.id, m]))
      }

      // Fetch present check-ins
      const { data: attendance, error: attError } = await supabase
        .from('event_attendance')
        .select('*')
        .eq('event_id', eventId)

      if (attError) throw attError

      const attendanceByMember = new Map()
      const attendanceByRegistration = new Map()
      ;(attendance || []).forEach(att => {
        if (att.member_id) attendanceByMember.set(att.member_id, att)
        if (att.registration_id) attendanceByRegistration.set(att.registration_id, att)
      })

      const present = []
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
              designation: reg.guest_designation || 'Guest Delegate',
              email: reg.guest_email,
              phone_number: reg.guest_phone,
              isGuest: true
            }

        const att = isMember ? attendanceByMember.get(reg.member_id) : attendanceByRegistration.get(reg.id)

        if (att) {
          present.push({
            ...person,
            checkedInAt: att.checked_in_at,
            attendanceId: att.id
          })
        }
      })

      // Sort by check-in time ascending (older first)
      present.sort((a, b) => new Date(a.checkedInAt) - new Date(b.checkedInAt))
      setAllAttendees(present)
    } catch (e) {
      console.error('Error fetching attendees:', e)
    } finally {
      setLoading(false)
    }
  }

  // Filter attendees by Cutoff Time and Excluded IDs
  const activeCandidates = allAttendees.filter(att => {
    // 1. Time Filter
    if (cutoffTime) {
      const checkInDate = new Date(att.checkedInAt)
      const hours = String(checkInDate.getHours()).padStart(2, '0')
      const minutes = String(checkInDate.getMinutes()).padStart(2, '0')
      const checkInTimeStr = `${hours}:${minutes}`
      if (checkInTimeStr > cutoffTime) return false
    }
    // 2. Excluded filter
    if (excludedIds.has(att.id)) return false
    
    return true
  })

  // Set candidate ref for animation loop
  useEffect(() => {
    candidatesRef.current = activeCandidates
  }, [activeCandidates])

  // Canvas drawing loop to animate marquee lights even when idle
  useEffect(() => {
    let animId
    const tick = () => {
      drawWheel()
      animId = requestAnimationFrame(tick)
    }
    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [activeCandidates])

  const drawWheel = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const size = canvas.width
    const center = size / 2
    const outerRimWidth = 14
    const radius = center - outerRimWidth - 5
    ctx.clearRect(0, 0, size, size)

    const candidates = candidatesRef.current

    if (candidates.length === 0) {
      // Draw placeholder circle
      ctx.beginPath()
      ctx.arc(center, center, radius, 0, 2 * Math.PI)
      ctx.fillStyle = '#f8fafc'
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = '#e2e8f0'
      ctx.stroke()

      ctx.fillStyle = '#94a3b8'
      ctx.font = '14px Be Vietnam Pro'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No Candidates Matching', center, center - 10)
      ctx.fillText('Filters Available', center, center + 10)
      return
    }

    const numSlices = candidates.length
    const sliceAngle = (2 * Math.PI) / numSlices

    // Slices palette
    const colors = [
      '#6366f1', // Indigo/purple
      '#a78bfa', // Lavender
      '#1e293b', // Dark slate charcoal
      '#0f766e', // Deep teal
      '#14b8a6', // Neon aqua-cyan
      '#9f1239', // Burgundy red
      '#5eead4', // Light minty green
      '#4f46e5'  // Darker indigo
    ]

    // 1. Draw Slices
    for (let i = 0; i < numSlices; i++) {
      const startAngle = angleRef.current + i * sliceAngle
      const endAngle = startAngle + sliceAngle

      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.arc(center, center, radius, startAngle, endAngle)
      ctx.closePath()

      // Flat slice color filling matching the clean reference image
      ctx.fillStyle = colors[i % colors.length]
      ctx.fill()

      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.stroke()

      // Text labels (avoiding upside down text on left hemisphere)
      let textAngle = startAngle + sliceAngle / 2
      let normTextAngle = textAngle % (2 * Math.PI)
      if (normTextAngle < 0) normTextAngle += 2 * Math.PI

      ctx.save()
      ctx.translate(center, center)
      ctx.rotate(textAngle)
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
      ctx.shadowBlur = 4
      ctx.font = 'bold 11px Be Vietnam Pro'
      
      const name = candidates[i].full_name || 'Attendee'
      const truncatedName = name.length > 14 ? name.substring(0, 12) + '..' : name

      if (normTextAngle > Math.PI / 2 && normTextAngle < 3 * Math.PI / 2) {
        ctx.rotate(Math.PI)
        ctx.textAlign = 'left'
        ctx.fillText(truncatedName, -radius + 20, 0)
      } else {
        ctx.textAlign = 'right'
        ctx.fillText(truncatedName, radius - 20, 0)
      }
      ctx.restore()
    }

    // 2. Modern Dark Slate Outer Rim (GLOWSPIN Style)
    ctx.beginPath()
    ctx.arc(center, center, radius + outerRimWidth / 2, 0, 2 * Math.PI)
    ctx.lineWidth = outerRimWidth
    ctx.strokeStyle = '#1e293b' // Dark slate rim border
    ctx.stroke()

    // 3. Center PIN Button (GLOWSPIN Style)
    ctx.beginPath()
    ctx.arc(center, center, 36, 0, 2 * Math.PI)
    ctx.fillStyle = '#a78bfa' // Lavender glow outer circle
    ctx.shadowColor = 'rgba(167, 139, 250, 0.5)'
    ctx.shadowBlur = 10
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.beginPath()
    ctx.arc(center, center, 30, 0, 2 * Math.PI)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    ctx.fillStyle = '#5b21b6' // dark violet text
    ctx.font = 'bold 10px Be Vietnam Pro'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SPIN', center, center)

    // 4. Draw Top Pointer (Metallic Silver/Lavender)
    ctx.save()
    ctx.translate(center, 4)
    ctx.fillStyle = '#cbd5e1' // Silver/lavender metal pointer
    ctx.beginPath()
    ctx.moveTo(-12, 0)
    ctx.lineTo(12, 0)
    ctx.lineTo(0, 22)
    ctx.closePath()
    ctx.fill()
    
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }

  // Handle spin click
  const spin = () => {
    if (isSpinningRef.current || activeCandidates.length === 0) return

    isSpinningRef.current = true
    setIsSpinning(true)
    setWinner(null)
    setShowWinnerModal(false)

    // Initial spin velocity (between 0.3 and 0.45 rad/frame)
    let velocity = 0.35 + Math.random() * 0.15
    const friction = 0.985 // Inertia decay
    let lastTickAngle = angleRef.current
    const sliceAngle = (2 * Math.PI) / candidatesRef.current.length

    const animate = () => {
      // Rotate wheel
      angleRef.current += velocity
      setCurrentAngle(angleRef.current)
      
      // Sound tick triggers when pointer crosses slice boundary
      const currentTickIndex = Math.floor((1.5 * Math.PI - angleRef.current) / sliceAngle)
      const lastTickIndex = Math.floor((1.5 * Math.PI - lastTickAngle) / sliceAngle)
      if (currentTickIndex !== lastTickIndex) {
        playTickSound()
      }
      lastTickAngle = angleRef.current

      // Apply friction
      velocity *= friction

      if (velocity > 0.0015) {
        requestAnimationFrame(animate)
      } else {
        // Spin finished
        isSpinningRef.current = false
        setIsSpinning(false)
        
        // Calculate winner
        let normalizedAngle = (1.5 * Math.PI - angleRef.current) % (2 * Math.PI)
        if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI
        const winnerIdx = Math.floor(normalizedAngle / sliceAngle)
        
        const finalWinner = candidatesRef.current[winnerIdx]
        setWinner(finalWinner)
        playWinSound()
        setShowWinnerModal(true)
      }
    }

    animate()
  }

  const toggleExclude = (id) => {
    const next = new Set(excludedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setExcludedIds(next)
  }

  const claimWinner = async (winnerObj) => {
    if (!winnerObj || !winnerObj.attendanceId) return
    try {
      const { error } = await supabase
        .from('event_attendance')
        .update({ lucky_draw_winner: true })
        .eq('id', winnerObj.attendanceId)
      if (error) throw error
      console.log('✓ Winner successfully saved to database:', winnerObj.full_name)
    } catch (err) {
      console.error('Error claiming winner:', err)
      alert('Failed to save winner to database: ' + err.message)
    }
  }

  const selectAll = () => {
    setExcludedIds(new Set())
  }

  const clearAll = () => {
    const allIds = allAttendees.map(a => a.id)
    setExcludedIds(new Set(allIds))
  }

  // Confetti Particle System inside winner modal
  useEffect(() => {
    if (!showWinnerModal) return
    const canvas = confettiCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = canvas.parentElement.clientWidth
    canvas.height = canvas.parentElement.clientHeight

    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#eab308', '#a855f7', '#ff7849']
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      radius: Math.random() * 5 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: Math.random() * 4 - 2,
      vy: Math.random() * 5 + 3,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: Math.random() * 0.1 - 0.05
    }))

    let animId
    const runConfetti = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.rotationSpeed

        if (p.y > canvas.height) {
          p.y = -10
          p.x = Math.random() * canvas.width
        }

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        // Draw little squares
        ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2)
        ctx.restore()
      })
      animId = requestAnimationFrame(runConfetti)
    }

    runConfetti()
    return () => cancelAnimationFrame(animId)
  }, [showWinnerModal])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-28">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Lucky Draw Arena</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Spin the wheel to select event winners</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.open(`/admin/spin-wheel/fullscreen?eventId=${selectedEventId}&cutoff=${cutoffTime}`, '_blank')}
              disabled={!selectedEventId}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              Fullscreen Preview
            </button>
            <span className="material-symbols-outlined text-primary text-2xl">casino</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Step 1: Filter Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              1. Event Date Filter
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              2. Select Event
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {filteredEvents.length === 0 ? (
                <option value="">No events on this date</option>
              ) : (
                filteredEvents.map(e => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              3. Check-In Cutoff Time
            </label>
            <div className="relative">
              <input
                type="time"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {cutoffTime && (
                <button
                  onClick={() => setCutoffTime('')}
                  className="absolute right-3 top-2 text-xs text-slate-400 hover:text-rose-500"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Draw Area */}
        {selectedEventId ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Spin Wheel Panel */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 w-full border-b pb-2">
                🎡 Interactive Spin Wheel ({activeCandidates.length} Active Candidates)
              </h3>

              <div className="relative flex items-center justify-center w-full max-w-[360px] aspect-square">
                {/* HTML Canvas Spin Wheel */}
                <canvas
                  ref={canvasRef}
                  width={360}
                  height={360}
                  className="w-full h-full cursor-pointer max-w-[360px]"
                  onClick={spin}
                />
              </div>

              <button
                onClick={spin}
                disabled={isSpinning || activeCandidates.length === 0}
                className="mt-6 px-8 py-3.5 bg-primary hover:bg-primary/95 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-[0.98] w-full max-w-[360px]"
              >
                {isSpinning ? 'SPINNING...' : 'TAP WHEEL TO SPIN'}
              </button>
            </div>

            {/* Candidates Selection Panel */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Attendees Pool</h3>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300">
                  {activeCandidates.length} Selected
                </span>
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Search attendee name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />

              {/* Exclude Quick Actions */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={selectAll}
                  className="flex-1 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Include All
                </button>
                <button
                  onClick={clearAll}
                  className="flex-1 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Exclude All
                </button>
              </div>

              {/* Scrollable list */}
              <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                {loading ? (
                  <p className="text-center text-xs text-slate-400 py-4">Loading attendees...</p>
                ) : allAttendees.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-4">No one has checked in yet.</p>
                ) : (
                  allAttendees
                    .filter(a => a.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(att => {
                      const isExcluded = excludedIds.has(att.id)
                      const isTimeExcluded = cutoffTime && (() => {
                        const checkInDate = new Date(att.checkedInAt)
                        const hours = String(checkInDate.getHours()).padStart(2, '0')
                        const minutes = String(checkInDate.getMinutes()).padStart(2, '0')
                        return `${hours}:${minutes}` > cutoffTime
                      })()

                      return (
                        <div
                          key={att.id}
                          onClick={() => !isTimeExcluded && toggleExclude(att.id)}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors cursor-pointer ${
                            isTimeExcluded
                              ? 'opacity-40 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 pointer-events-none'
                              : isExcluded
                              ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                              : 'bg-primary/5 dark:bg-primary/10 border-primary/20 hover:bg-primary/10'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!isExcluded && !isTimeExcluded}
                            onChange={() => {}}
                            disabled={!!isTimeExcluded}
                            className="rounded border-slate-300 text-primary focus:ring-primary size-4"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-950 dark:text-slate-100 truncate">{att.full_name}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {att.designation || 'Attendee'}
                            </p>
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-3">event_busy</span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Event Selected</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Please choose a date that has scheduled events, and select the event to fetch attendance.
            </p>
          </div>
        )}
      </main>

      {/* Confetti Winner Reveal Modal */}
      {showWinnerModal && winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          {/* Winner Card Container */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border-2 border-primary/30 rounded-3xl overflow-hidden shadow-2xl p-6 flex flex-col items-center text-center">
            
            {/* Confetti Canvas */}
            <canvas ref={confettiCanvasRef} className="absolute inset-0 pointer-events-none w-full h-full" />

            <div className="relative z-10 w-full flex flex-col items-center">
              {/* Decorative Crown/Trophy Icon */}
              <div className="flex items-center justify-center size-20 bg-amber-500/10 rounded-full text-amber-500 mb-4 animate-bounce">
                <span className="material-symbols-outlined text-5xl">military_tech</span>
              </div>

              <h2 className="text-xs uppercase tracking-[0.2em] font-extrabold text-amber-500 mb-1">Lucky Draw Winner!</h2>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-4">{winner.full_name}</h1>

              {/* Profile Image / Initials */}
              <div className="size-24 rounded-full border-4 border-primary/20 overflow-hidden mb-4 bg-slate-100 flex items-center justify-center shrink-0">
                {winner.profile_image ? (
                  <img src={winner.profile_image} alt={winner.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
                )}
              </div>

              {/* Winner Stats */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl w-full border border-slate-100 dark:border-slate-800 mb-6">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-0.5">Designation & Company</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{winner.designation || 'Attendee'}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={async () => {
                    await claimWinner(winner)
                    toggleExclude(winner.id) // Exclude winner
                    setShowWinnerModal(false)
                  }}
                  className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20"
                >
                  Claim & Exclude Winner
                </button>
                <button
                  onClick={() => setShowWinnerModal(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Bottom Nav Bar */}
      <BottomNav />
    </div>
  )
}
