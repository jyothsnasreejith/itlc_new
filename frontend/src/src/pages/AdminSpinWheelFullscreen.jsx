import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Custom sound generator using Web Audio API
const playTickSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, audioCtx.currentTime)
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05)
    
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    
    osc.start()
    osc.stop(audioCtx.currentTime + 0.05)
  } catch (e) {}
}

const playWinSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc1 = audioCtx.createOscillator()
    const osc2 = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime)
    osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5)
    
    osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime)
    osc2.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.5)

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6)

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(audioCtx.destination)

    osc1.start()
    osc2.start()
    osc1.stop(audioCtx.currentTime + 0.6)
    osc2.stop(audioCtx.currentTime + 0.6)
  } catch (e) {}
}

export default function AdminSpinWheelFullscreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId')
  const cutoff = searchParams.get('cutoff')

  const canvasRef = useRef(null)
  const bgCanvasRef = useRef(null)
  const confettiCanvasRef = useRef(null)

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [allAttendees, setAllAttendees] = useState([])
  const [excludedIds, setExcludedIds] = useState(new Set())
  
  // Animation/Spin State
  const [currentAngle, setCurrentAngle] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [winner, setWinner] = useState(null)
  const [showWinnerModal, setShowWinnerModal] = useState(false)

  const angleRef = useRef(0)
  const isSpinningRef = useRef(false)
  const candidatesRef = useRef([])

  useEffect(() => {
    if (!eventId) {
      navigate('/admin/spin-wheel')
      return
    }
    fetchData()
  }, [eventId])

  async function fetchData() {
    try {
      setLoading(true)
      
      // Fetch Event Details
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (eventError) throw eventError
      setEvent(eventData)

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
            checkedInAt: att.checked_in_at
          })
        }
      })

      present.sort((a, b) => new Date(a.checkedInAt) - new Date(b.checkedInAt))
      setAllAttendees(present)
    } catch (e) {
      console.error('Error fetching data:', e)
    } finally {
      setLoading(false)
    }
  }

  // Filter pool by cutoff time and exclusions
  const activeCandidates = allAttendees.filter(att => {
    if (cutoff) {
      const checkInDate = new Date(att.checkedInAt)
      const hours = String(checkInDate.getHours()).padStart(2, '0')
      const minutes = String(checkInDate.getMinutes()).padStart(2, '0')
      const checkInTimeStr = `${hours}:${minutes}`
      if (checkInTimeStr > cutoff) return false
    }
    return !excludedIds.has(att.id)
  })

  // Sync ref with state
  useEffect(() => {
    candidatesRef.current = activeCandidates
  }, [activeCandidates])

  // Spacebar to Spin Keypress listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !isSpinningRef.current && !showWinnerModal) {
        e.preventDefault()
        spin()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showWinnerModal, activeCandidates])

  // Full viewport Background Starry Particles
  useEffect(() => {
    const canvas = bgCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2 + 1,
      speed: Math.random() * 0.4 + 0.1,
      opacity: Math.random() * 0.6 + 0.2
    }))

    let animId
    const animateBg = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Radial glow gradient background
      const radialGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 50,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 1.5
      )
      radialGrad.addColorStop(0, '#1e1b4b') // Indigo-950 glow
      radialGrad.addColorStop(1, '#090514') // Pitch black outer
      ctx.fillStyle = radialGrad
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Particles
      particles.forEach(p => {
        p.y -= p.speed
        if (p.y < 0) {
          p.y = canvas.height
          p.x = Math.random() * canvas.width
        }
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI)
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`
        ctx.fill()
      })
      animId = requestAnimationFrame(animateBg)
    }

    animateBg()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  // Continuous animation loop for the wheel (marquee lights)
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
    const outerRimWidth = 18
    const radius = center - outerRimWidth - 5
    ctx.clearRect(0, 0, size, size)

    const candidates = candidatesRef.current

    if (candidates.length === 0) {
      ctx.beginPath()
      ctx.arc(center, center, radius, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)'
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = '#334155'
      ctx.stroke()

      ctx.fillStyle = '#64748b'
      ctx.font = 'bold 16px Be Vietnam Pro'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No Candidates Available', center, center)
      return
    }

    const numSlices = candidates.length
    const sliceAngle = (2 * Math.PI) / numSlices

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

      // Texts (avoiding upside down text on left hemisphere)
      let textAngle = startAngle + sliceAngle / 2
      let normTextAngle = textAngle % (2 * Math.PI)
      if (normTextAngle < 0) normTextAngle += 2 * Math.PI

      ctx.save()
      ctx.translate(center, center)
      ctx.rotate(textAngle)
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
      ctx.shadowBlur = 4
      ctx.font = 'bold 13px Be Vietnam Pro'
      
      const name = candidates[i].full_name || 'Attendee'
      const truncatedName = name.length > 18 ? name.substring(0, 16) + '..' : name

      if (normTextAngle > Math.PI / 2 && normTextAngle < 3 * Math.PI / 2) {
        ctx.rotate(Math.PI)
        ctx.textAlign = 'left'
        ctx.fillText(truncatedName, -radius + 24, 0)
      } else {
        ctx.textAlign = 'right'
        ctx.fillText(truncatedName, radius - 24, 0)
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
    ctx.arc(center, center, 45, 0, 2 * Math.PI)
    ctx.fillStyle = '#a78bfa' // Lavender glow outer circle
    ctx.shadowColor = 'rgba(167, 139, 250, 0.5)'
    ctx.shadowBlur = 12
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.beginPath()
    ctx.arc(center, center, 38, 0, 2 * Math.PI)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    ctx.fillStyle = '#5b21b6' // dark violet text
    ctx.font = 'bold 12px Be Vietnam Pro'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SPIN', center, center)

    // 4. Draw Top Pointer (Metallic Silver/Lavender)
    ctx.save()
    ctx.translate(center, 4)
    ctx.fillStyle = '#cbd5e1' // Silver/lavender metal pointer
    ctx.beginPath()
    ctx.moveTo(-15, 0)
    ctx.lineTo(15, 0)
    ctx.lineTo(0, 26)
    ctx.closePath()
    ctx.fill()
    
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1.5
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

    let velocity = 0.38 + Math.random() * 0.18
    const friction = 0.988 // slightly longer/smoother spin
    let lastTickAngle = angleRef.current
    const sliceAngle = (2 * Math.PI) / candidatesRef.current.length

    const animate = () => {
      angleRef.current += velocity
      setCurrentAngle(angleRef.current)
      
      const currentTickIndex = Math.floor((1.5 * Math.PI - angleRef.current) / sliceAngle)
      const lastTickIndex = Math.floor((1.5 * Math.PI - lastTickAngle) / sliceAngle)
      if (currentTickIndex !== lastTickIndex) {
        playTickSound()
      }
      lastTickAngle = angleRef.current

      velocity *= friction

      if (velocity > 0.0012) {
        requestAnimationFrame(animate)
      } else {
        isSpinningRef.current = false
        setIsSpinning(false)
        
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

  // Confetti Particle System inside full-screen winner modal
  useEffect(() => {
    if (!showWinnerModal) return
    const canvas = confettiCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#eab308', '#a855f7', '#ff7849']
    const particles = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      radius: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: Math.random() * 6 - 3,
      vy: Math.random() * 6 + 4,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: Math.random() * 0.12 - 0.06
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
        ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2)
        ctx.restore()
      })
      animId = requestAnimationFrame(runConfetti)
    }

    runConfetti()
    return () => cancelAnimationFrame(animId)
  }, [showWinnerModal])

  const excludeWinner = () => {
    if (winner) {
      const next = new Set(excludedIds)
      next.add(winner.id)
      setExcludedIds(next)
    }
    setShowWinnerModal(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="font-semibold">Loading Draw Pool...</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-display bg-[#090514]">
      {/* Background Canvas */}
      <canvas ref={bgCanvasRef} className="absolute inset-0 z-0 w-full h-full" />

      {/* Glowing backdrop blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Main Container */}
      <div className="relative z-10 flex flex-col min-h-screen w-full max-w-7xl mx-auto px-6 py-6 select-none">
        
        {/* Upper Title Row */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5 mb-8">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 tracking-tight">
              LUCKY DRAW CHAMPIONSHIP
            </h1>
            <p className="text-sm font-semibold text-slate-400 mt-1">
              Event: {event?.title || 'Unknown Event'} · {event?.date}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="px-3.5 py-1.5 bg-primary/20 border border-primary/30 rounded-full text-xs font-bold text-primary">
              👥 pool size: {activeCandidates.length}
            </span>
          </div>
        </header>

        {/* Central Display */}
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 mb-10">
          
          {/* Candidates Shelf (Left) */}
          <div className="w-full lg:w-80 bg-slate-900/60 border border-slate-800 backdrop-blur-md rounded-3xl p-5 flex flex-col max-h-[480px]">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-3 mb-4 flex justify-between items-center">
              <span>Candidate Pool</span>
              <span className="text-xs font-medium text-slate-500">{activeCandidates.length} total</span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {activeCandidates.map((c, i) => (
                <div 
                  key={c.id} 
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/40 border border-slate-900/50"
                >
                  <span className="text-[10px] font-bold text-slate-600 font-mono">
                    #{String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-extrabold text-slate-200 truncate flex-1">
                    {c.full_name}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate max-w-[100px]">
                    {c.designation || 'Delegate'}
                  </span>
                </div>
              ))}
              {activeCandidates.length === 0 && (
                <p className="text-center text-xs text-slate-600 py-10 font-bold">No active candidates</p>
              )}
            </div>
          </div>

          {/* Interactive Wheel (Center) */}
          <div className="flex-1 flex flex-col items-center">
            <div className="relative flex items-center justify-center aspect-square w-full max-w-[480px]">
              {/* Dynamic canvas */}
              <canvas
                ref={canvasRef}
                width={480}
                height={480}
                className="w-full h-full cursor-pointer max-w-[480px]"
                onClick={spin}
              />
            </div>
            
            <p className="text-xs text-slate-500 font-semibold tracking-widest mt-6 animate-pulse uppercase">
              Press [SPACE] or Click Wheel to Spin
            </p>
          </div>

        </div>

        {/* Action / Back Control */}
        <footer className="flex justify-center border-t border-slate-800 pt-5 mt-auto">
          <button
            onClick={() => window.close()}
            className="px-6 py-2.5 bg-slate-900 border border-slate-850 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
          >
            Close Fullscreen Screen
          </button>
        </footer>
      </div>

      {/* Confetti Winner Reveal Modal */}
      {showWinnerModal && winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <canvas ref={confettiCanvasRef} className="absolute inset-0 pointer-events-none w-full h-full" />
          
          <div className="relative z-10 w-full max-w-lg bg-gradient-to-b from-indigo-950 to-slate-950 border border-amber-500/40 rounded-3xl overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center">
            
            <div className="size-24 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5 animate-pulse border border-amber-500/20">
              <span className="material-symbols-outlined text-6xl">military_tech</span>
            </div>

            <h2 className="text-xs uppercase tracking-[0.3em] font-extrabold text-amber-400 mb-2">Grand Draw Winner</h2>
            <h1 className="text-3xl font-black text-white mb-5 tracking-tight">{winner.full_name}</h1>

            {/* Profile Pic/Avatar */}
            <div className="size-28 rounded-full border-4 border-amber-500/30 overflow-hidden mb-5 bg-slate-900 flex items-center justify-center shrink-0 shadow-lg">
              {winner.profile_image ? (
                <img src={winner.profile_image} alt={winner.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-5xl text-slate-700">person</span>
              )}
            </div>

            {/* Stats */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl w-full mb-8">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Company & Designation</p>
              <p className="text-base font-extrabold text-slate-200">{winner.designation || 'Attendee'}</p>
            </div>

            {/* Controls */}
            <div className="flex gap-4 w-full">
              <button
                onClick={excludeWinner}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20"
              >
                Claim & Exclude Winner
              </button>
              <button
                onClick={() => setShowWinnerModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-3.5 rounded-xl transition-colors"
              >
                Keep in Pool / Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
