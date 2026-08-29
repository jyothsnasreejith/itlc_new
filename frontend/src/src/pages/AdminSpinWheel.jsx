import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const playLockSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(600, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.18)
  } catch (_) {}
}

const playWinSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523.25, 659.25, 783.99, 1046.50]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      const t = ctx.currentTime + i * 0.12
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.15, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(t); osc.stop(t + 0.22)
    })
  } catch (_) {}
}

const ITEM_H = 100
const VISIBLE = 3

function SlotReel({ names, spinning, locked, lockedName, reelIndex }) {
  const animRef = useRef(null)
  const offsetRef = useRef(0)
  const [, setTick] = useState(0)
  const repeated = names.length === 0 ? ['—'] : [...names, ...names, ...names, ...names, ...names]

  useEffect(() => {
    if (spinning && !locked) {
      const speed = 22 + reelIndex * 5
      const animate = () => {
        offsetRef.current += speed
        const total = repeated.length * ITEM_H
        if (offsetRef.current > total) offsetRef.current -= total
        setTick(t => t + 1)
        animRef.current = requestAnimationFrame(animate)
      }
      cancelAnimationFrame(animRef.current)
      animRef.current = requestAnimationFrame(animate)
    } else if (locked && lockedName) {
      cancelAnimationFrame(animRef.current)
      const targetIdx = repeated.findIndex(n => n === lockedName)
      if (targetIdx === -1) return
      const targetOffset = targetIdx * ITEM_H
      const snap = () => {
        const diff = targetOffset - offsetRef.current
        if (Math.abs(diff) < 1) { offsetRef.current = targetOffset; setTick(t => t + 1); return }
        offsetRef.current += diff * 0.18
        setTick(t => t + 1)
        animRef.current = requestAnimationFrame(snap)
      }
      animRef.current = requestAnimationFrame(snap)
    } else if (!spinning) {
      cancelAnimationFrame(animRef.current)
    }
    return () => cancelAnimationFrame(animRef.current)
  }, [spinning, locked, lockedName])

  const topOffset = -offsetRef.current + ITEM_H

  return (
    <div style={{
      height: ITEM_H * VISIBLE,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 16,
      border: locked ? '2px solid #facc15' : '2px solid #1e293b',
      background: '#070f1e',
      boxShadow: locked ? '0 0 24px rgba(250,204,21,0.2)' : 'inset 0 0 16px rgba(0,0,0,0.8)',
      flex: 1,
    }}>
      {/* Spotlight */}
      <div style={{
        position:'absolute', left:0, right:0, top: ITEM_H, height: ITEM_H, zIndex:10, pointerEvents:'none',
        background: locked ? 'rgba(250,204,21,0.08)' : 'rgba(255,255,255,0.02)',
        borderTop: locked ? '2px solid rgba(250,204,21,0.5)' : '1px solid rgba(255,255,255,0.05)',
        borderBottom: locked ? '2px solid rgba(250,204,21,0.5)' : '1px solid rgba(255,255,255,0.05)',
      }} />
      {/* Fades */}
      <div style={{position:'absolute',inset:'0 0 auto 0',height:45,zIndex:10,pointerEvents:'none',background:'linear-gradient(to bottom,#070f1e,transparent)'}} />
      <div style={{position:'absolute',inset:'auto 0 0 0',height:45,zIndex:10,pointerEvents:'none',background:'linear-gradient(to top,#070f1e,transparent)'}} />

      <div style={{ position: 'absolute', left: 0, right: 0, top: topOffset }}>
        {repeated.map((name, idx) => {
          const isCtr = locked && name === lockedName && idx === repeated.findIndex(n => n === lockedName)
          return (
            <div key={idx} style={{ height: ITEM_H, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 10px' }}>
              <span style={{
                display:'block', textAlign:'center', fontWeight:900, lineHeight:1.2,
                fontSize: isCtr ? 24 : spinning && !locked ? 14 : 17,
                color: isCtr ? '#facc15' : spinning && !locked ? '#334155' : '#475569',
                textShadow: isCtr ? '0 0 16px rgba(250,204,21,0.7)' : 'none',
                filter: spinning && !locked ? 'blur(2px)' : 'none',
                transition:'all 0.2s',
                wordBreak:'break-word', width:'100%',
              }}>
                {name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminSpinWheel() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paramEventId = searchParams.get('eventId')

  const [events, setEvents] = useState([])
  const [filteredEvents, setFilteredEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [cutoffTime, setCutoffTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [allAttendees, setAllAttendees] = useState([])
  const [excludedIds, setExcludedIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isSpinning, setIsSpinning] = useState(false)
  const [reelLocked, setReelLocked] = useState([false, false, false])
  const [lockedName, setLockedName] = useState(null)
  const [winner, setWinner] = useState(null)
  const [showWinnerBanner, setShowWinnerBanner] = useState(false)
  const [showWinnerModal, setShowWinnerModal] = useState(false)
  const isSpinningRef = useRef(false)
  const confettiCanvasRef = useRef(null)

  useEffect(() => { fetchEvents() }, [paramEventId])

  async function fetchEvents() {
    try {
      const { data, error } = await supabase.from('events').select('*').order('date', { ascending: false })
      if (error) throw error
      const all = data || []
      setEvents(all)
      if (paramEventId) {
        const found = all.find(e => String(e.id) === String(paramEventId))
        if (found) { setDateFilter(found.date || ''); setSelectedEventId(found.id); return }
      }
      const d = new Date()
      setDateFilter(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (!events.length) return
    const filtered = dateFilter ? events.filter(e => e.date === dateFilter) : events
    setFilteredEvents(filtered)
    if (paramEventId && events.some(e => String(e.id) === String(paramEventId))) setSelectedEventId(paramEventId)
    else if (filtered.length > 0) setSelectedEventId(filtered[0].id)
    else { setSelectedEventId(''); setAllAttendees([]) }
  }, [dateFilter, events, paramEventId])

  useEffect(() => {
    if (!selectedEventId) { setAllAttendees([]); return }
    fetchAttendees(selectedEventId)
  }, [selectedEventId])

  async function fetchAttendees(eventId) {
    try {
      setLoading(true); setExcludedIds(new Set())
      const { data: registrations, error: regError } = await supabase.from('event_registrations').select('*').eq('event_id', eventId)
      if (regError) throw regError
      const memberIds = [...new Set((registrations || []).map(r => r.member_id).filter(Boolean))]
      let memberMap = new Map()
      if (memberIds.length > 0) {
        const { data: members, error: mErr } = await supabase.from('members').select('id, full_name, designation, email, phone_number, profile_image').in('id', memberIds)
        if (mErr) throw mErr
        memberMap = new Map((members || []).map(m => [m.id, m]))
      }
      const { data: attendance, error: attError } = await supabase.from('event_attendance').select('*').eq('event_id', eventId)
      if (attError) throw attError
      const byMember = new Map(); const byReg = new Map()
      ;(attendance || []).forEach(a => {
        if (a.member_id) byMember.set(a.member_id, a)
        if (a.registration_id) byReg.set(a.registration_id, a)
      })
      const present = []
      ;(registrations || []).forEach(reg => {
        const isMember = !!reg.member_id
        const person = isMember
          ? { id: reg.member_id, full_name: memberMap.get(reg.member_id)?.full_name || 'Unknown', profile_image: memberMap.get(reg.member_id)?.profile_image, designation: memberMap.get(reg.member_id)?.designation, email: memberMap.get(reg.member_id)?.email, isGuest: false }
          : { id: reg.id, full_name: reg.guest_name || 'Guest', designation: reg.guest_designation || 'Guest Delegate', email: reg.guest_email, isGuest: true }
        const att = isMember ? byMember.get(reg.member_id) : byReg.get(reg.id)
        if (att) present.push({ ...person, checkedInAt: att.checked_in_at, attendanceId: att.id })
      })
      present.sort((a, b) => new Date(a.checkedInAt) - new Date(b.checkedInAt))
      setAllAttendees(present)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const activeCandidates = allAttendees.filter(att => {
    if (cutoffTime) {
      const d = new Date(att.checkedInAt)
      const hm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      if (hm > cutoffTime) return false
    }
    return !excludedIds.has(att.id)
  })

  const candidateNames = activeCandidates.map(c => c.full_name)

  const spin = useCallback(() => {
    if (isSpinningRef.current || activeCandidates.length === 0) return
    isSpinningRef.current = true
    setIsSpinning(true); setReelLocked([false, false, false]); setLockedName(null); setWinner(null); setShowWinnerBanner(false); setShowWinnerModal(false)
    const pickedWinner = activeCandidates[Math.floor(Math.random() * activeCandidates.length)]
    setTimeout(() => { setReelLocked([true, false, false]); playLockSound() }, 1800)
    setTimeout(() => { setReelLocked([true, true, false]); playLockSound() }, 3000)
    setTimeout(() => {
      setReelLocked([true, true, true]); setLockedName(pickedWinner.full_name); playLockSound()
      isSpinningRef.current = false; setIsSpinning(false); setWinner(pickedWinner); setShowWinnerBanner(true)
      setTimeout(() => { playWinSound(); setShowWinnerModal(true) }, 600)
    }, 4400)
  }, [activeCandidates])

  const toggleExclude = (id) => { const n = new Set(excludedIds); n.has(id) ? n.delete(id) : n.add(id); setExcludedIds(n) }
  const selectAll = () => setExcludedIds(new Set())
  const clearAll = () => setExcludedIds(new Set(allAttendees.map(a => a.id)))

  const claimWinner = async (w) => {
    if (!w?.attendanceId) return
    try {
      const { error } = await supabase.from('event_attendance').update({ lucky_draw_winner: true }).eq('id', w.attendanceId)
      if (error) throw error
    } catch (err) { alert('Failed to save winner: ' + err.message) }
  }

  useEffect(() => {
    if (!showWinnerModal) return
    const canvas = confettiCanvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight
    const colors = ['#facc15','#fb923c','#ef4444','#38bdf8','#4ade80','#a855f7']
    const particles = Array.from({ length: 130 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 5 + 3, color: colors[Math.floor(Math.random() * colors.length)],
      vx: Math.random() * 4 - 2, vy: Math.random() * 5 + 3,
      rot: Math.random() * Math.PI * 2, rotV: Math.random() * 0.1 - 0.05
    }))
    let id
    const run = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.rotV
        if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color
        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); ctx.restore()
      })
      id = requestAnimationFrame(run)
    }
    run(); return () => cancelAnimationFrame(id)
  }, [showWinnerModal])

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-100 pb-28">
      {/* Top Filter Header */}
      <header className="bg-[#0d1726] border-b border-[#1e2c42] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎰</span>
            <div>
              <h1 className="text-lg font-black text-white">LUCKY DRAW</h1>
              <p className="text-xs text-slate-400 font-semibold">Casino Slot Machine Live Arena</p>
            </div>
          </div>
          <button
            onClick={() => window.open(`/admin/spin-wheel/fullscreen?eventId=${selectedEventId}&cutoff=${cutoffTime}`, '_blank')}
            disabled={!selectedEventId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-slate-900 text-xs font-black disabled:opacity-40 transition-all cursor-pointer"
            style={{ background: '#facc15', boxShadow: '0 0 20px rgba(250,204,21,0.3)' }}
          >
            <span className="material-symbols-outlined text-sm">fullscreen</span>
            Launch Fullscreen
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Draw Config */}
        <div className="bg-[#0d1726] rounded-2xl border border-[#1e2c42] p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Event Date</label>
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#1e2c42] rounded-xl bg-[#121e31] text-white text-sm focus:outline-none focus:border-yellow-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Event</label>
              <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#1e2c42] rounded-xl bg-[#121e31] text-white text-sm focus:outline-none focus:border-yellow-400">
                {filteredEvents.length === 0
                  ? <option value="">No events on this date</option>
                  : filteredEvents.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cutoff Time</label>
              <div className="relative">
                <input type="time" value={cutoffTime} onChange={e => setCutoffTime(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#1e2c42] rounded-xl bg-[#121e31] text-white text-sm focus:outline-none focus:border-yellow-400" />
                {cutoffTime && <button onClick={() => setCutoffTime('')} className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-red-400 font-bold">✕</button>}
              </div>
            </div>
          </div>
        </div>

        {selectedEventId ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Slot Machine */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              {/* Winner Banner */}
              <div style={{
                minHeight: 56,
                background: showWinnerBanner && winner
                  ? 'linear-gradient(90deg, #064e3b, #047857, #064e3b)'
                  : 'linear-gradient(90deg, #0d1e1a, #0d1e1a)',
                border: showWinnerBanner && winner ? '2px solid #10b981' : '1px solid #142a26',
                borderRadius: 16,
                padding: '0 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                transition: 'all 0.3s ease',
              }}>
                {showWinnerBanner && winner ? (
                  <>
                    <span style={{ fontSize: 22 }}>🏆</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: '#34d399', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      WINNER: {winner.full_name}
                    </span>
                    <span style={{ fontSize: 22 }}>🏆</span>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>✨</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#059669', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      READY FOR LUCKY DRAW
                    </span>
                    <span style={{ fontSize: 16 }}>✨</span>
                  </div>
                )}
              </div>

              {/* Machine Center Frame */}
              <div style={{
                background: '#0d1726',
                borderRadius: 24,
                border: '1px solid #1e2c42',
                padding: '24px 24px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}>
                {/* Badge */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(250,204,21,0.08)',
                  border: '1.5px solid #facc15',
                  borderRadius: 99,
                  padding: '5px 18px',
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#facc15',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  marginBottom: 18,
                }}>
                  <span>★</span> LUCKY DRAW <span>★</span>
                </div>

                {/* 3 Reels */}
                {activeCandidates.length === 0 ? (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, width:'100%' }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ height:ITEM_H*VISIBLE, borderRadius:16, border:'2px solid #1e2c42', background:'#070f1e', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:12, color:'#475569', fontWeight:700 }}>No Candidates</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:12, width:'100%' }}>
                    {[0,1,2].map(reelIdx => (
                      <SlotReel key={reelIdx} names={candidateNames} spinning={isSpinning} locked={reelLocked[reelIdx]} lockedName={lockedName} reelIndex={reelIdx} />
                    ))}
                  </div>
                )}

                {/* Reel Indicators */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 16 }}>
                  {['REEL 1', 'REEL 2', 'REEL 3'].map((label, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      color: reelLocked[i] ? '#facc15' : '#475569',
                      transition: 'all 0.3s'
                    }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: reelLocked[i] ? '#facc15' : '#1e293b',
                        boxShadow: reelLocked[i] ? '0 0 10px rgba(250,204,21,0.9)' : 'none',
                        transition: 'all 0.3s'
                      }} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Big Pull Lever Button */}
              <button
                onClick={spin}
                disabled={isSpinning || activeCandidates.length === 0}
                style={{
                  height: 68,
                  borderRadius: 18,
                  border: 'none',
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  cursor: isSpinning || activeCandidates.length === 0 ? 'not-allowed' : 'pointer',
                  background: isSpinning || activeCandidates.length === 0 ? '#1e2c42' : 'linear-gradient(135deg, #ea580c, #f97316)',
                  color: isSpinning || activeCandidates.length === 0 ? '#475569' : '#ffffff',
                  boxShadow: isSpinning || activeCandidates.length === 0 ? 'none' : '0 6px 24px rgba(249,115,22,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ fontSize: 26 }}>🎲</span>
                <span>{isSpinning ? 'SPINNING...' : 'PULL LEVER'}</span>
              </button>
            </div>

            {/* Candidate Pool Card */}
            <div style={{
              background: '#0d1726',
              borderRadius: 24,
              border: '1px solid #1e2c42',
              display: 'flex',
              flexDirection: 'column',
              padding: 20,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#f8fafc' }}>Candidate Pool</span>
                <span style={{ background: '#facc15', color: '#0f172a', padding: '3px 12px', borderRadius: 99, fontSize: 13, fontWeight: 900 }}>
                  {activeCandidates.length}
                </span>
              </div>

              <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-[#1e2c42] rounded-xl bg-[#121e31] text-white text-xs mb-3 focus:outline-none focus:border-yellow-400" />

              <div className="flex gap-2 mb-3">
                <button onClick={selectAll} className="flex-1 py-1.5 text-xs border border-[#1e2c42] rounded-lg bg-[#121e31] hover:bg-[#182438] text-slate-300 transition-colors font-bold">Include All</button>
                <button onClick={clearAll} className="flex-1 py-1.5 text-xs border border-[#1e2c42] rounded-lg bg-[#121e31] hover:bg-[#182438] text-slate-300 transition-colors font-bold">Exclude All</button>
              </div>

              <div className="max-h-[460px] overflow-y-auto space-y-2 pr-1">
                {loading ? (
                  <p className="text-center text-xs text-slate-400 py-6 font-semibold">Loading attendees...</p>
                ) : allAttendees.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6 font-semibold">No one checked in yet.</p>
                ) : (
                  allAttendees
                    .filter(a => a.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(att => {
                      const isExcluded = excludedIds.has(att.id)
                      const isWinner = winner && att.id === winner.id
                      const isTimeExcluded = cutoffTime && (() => {
                        const d = new Date(att.checkedInAt)
                        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` > cutoffTime
                      })()
                      return (
                        <div key={att.id} onClick={() => !isTimeExcluded && toggleExclude(att.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14,
                            cursor: 'pointer', transition: 'all 0.2s',
                            background: isWinner
                              ? 'linear-gradient(90deg, rgba(20,83,45,0.4), rgba(22,101,52,0.6))'
                              : isExcluded ? '#0a111e' : '#121e31',
                            border: isWinner ? '2px solid #facc15' : '1px solid #1a2942',
                            opacity: isExcluded || isTimeExcluded ? 0.45 : 1,
                          }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: isWinner ? '#facc15' : '#475569', minWidth: 24 }}>
                            #{String(allAttendees.indexOf(att) + 1).padStart(2, '0')}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 800, color: isWinner ? '#facc15' : '#f1f5f9', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {att.full_name}
                            </p>
                            <p style={{ fontSize: 10, color: isWinner ? '#86efac' : '#64748b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {att.designation || 'Participant'}
                            </p>
                          </div>
                          {isWinner && <span>🏆</span>}
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-[#0d1726] rounded-2xl border border-[#1e2c42]">
            <span className="text-6xl mb-4">🎰</span>
            <h3 className="text-lg font-black text-white mb-2">No Event Selected</h3>
            <p className="text-sm text-slate-400 font-medium max-w-sm">Choose a date with events to load the live draw pool.</p>
          </div>
        )}
      </main>

      {/* Winner Modal */}
      {showWinnerModal && winner && (
        <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(12px)' }}>
          <canvas ref={confettiCanvasRef} style={{ position:'absolute', inset:0, pointerEvents:'none', width:'100%', height:'100%' }} />
          <div style={{
            position:'relative', zIndex:10, width:'100%', maxWidth:460,
            background:'linear-gradient(145deg, #0d1726, #111d30)',
            border:'2px solid #facc15', borderRadius:28, padding:36,
            display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center',
            boxShadow:'0 30px 80px rgba(250,204,21,0.25)',
          }}>
            <div style={{ fontSize:56, marginBottom:12 }}>🏆</div>
            <div style={{ fontSize:11, fontWeight:900, letterSpacing:'0.25em', color:'#facc15', textTransform:'uppercase', marginBottom:8 }}>
              Lucky Draw Winner!
            </div>
            <h1 style={{ fontSize:32, fontWeight:900, color:'#f8fafc', margin:'0 0 6px', lineHeight:1.15 }}>
              {winner.full_name}
            </h1>
            <p style={{ fontSize:14, color:'#facc15', fontWeight:700, margin:'0 0 20px' }}>
              {winner.designation || 'Participant'}
            </p>

            <div style={{ width:80, height:80, borderRadius:'50%', border:'3px solid #facc15', overflow:'hidden', marginBottom:24, background:'#1e293b', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 20px rgba(250,204,21,0.3)' }}>
              {winner.profile_image
                ? <img src={winner.profile_image} alt={winner.full_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={{ fontSize:32 }}>👤</span>}
            </div>

            <div style={{ display:'flex', gap:12, width:'100%' }}>
              <button onClick={async () => { await claimWinner(winner); toggleExclude(winner.id); setShowWinnerModal(false); setShowWinnerBanner(false); }} style={{
                flex:1, padding:'14px 0', borderRadius:14, border:'none',
                background:'linear-gradient(135deg, #ea580c, #f97316)', color:'#fff',
                fontWeight:900, fontSize:15, cursor:'pointer',
                boxShadow:'0 4px 18px rgba(249,115,22,0.35)',
              }}>
                Claim &amp; Exclude
              </button>
              <button onClick={() => setShowWinnerModal(false)} style={{
                flex:1, padding:'14px 0', borderRadius:14, background:'transparent',
                border:'2px solid #1e2c42', color:'#94a3b8', fontWeight:800, fontSize:15, cursor:'pointer',
              }}>
                Keep in Pool
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
