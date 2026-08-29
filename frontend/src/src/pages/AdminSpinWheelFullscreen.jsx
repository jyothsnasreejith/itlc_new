import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const playLockSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(700, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.2)
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.22)
  } catch (_) {}
}

const playWinSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523.25, 659.25, 783.99, 1046.50]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      const t = ctx.currentTime + i * 0.14
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.22, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(t); osc.stop(t + 0.3)
    })
  } catch (_) {}
}

const ITEM_H = 82
const VISIBLE = 3

function SlotReel({ names, spinning, locked, lockedName, reelIndex }) {
  const animRef = useRef(null)
  const offsetRef = useRef(0)
  const [, setTick] = useState(0)

  const repeated = names.length === 0
    ? ['—', '—', '—', '—', '—']
    : [...names, ...names, ...names, ...names, ...names]

  useEffect(() => {
    if (spinning && !locked) {
      const speed = 20 + reelIndex * 5
      const go = () => {
        offsetRef.current += speed
        const total = repeated.length * ITEM_H
        if (offsetRef.current > total) offsetRef.current -= total
        setTick(t => t + 1)
        animRef.current = requestAnimationFrame(go)
      }
      cancelAnimationFrame(animRef.current)
      animRef.current = requestAnimationFrame(go)
    } else if (locked && lockedName) {
      cancelAnimationFrame(animRef.current)
      const idx = repeated.findIndex(n => n === lockedName)
      if (idx === -1) return
      const target = idx * ITEM_H
      const snap = () => {
        const diff = target - offsetRef.current
        if (Math.abs(diff) < 0.8) { offsetRef.current = target; setTick(t => t + 1); return }
        offsetRef.current += diff * 0.16
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
  const totalH = ITEM_H * VISIBLE

  return (
    <div style={{
      position: 'relative',
      height: totalH,
      overflow: 'hidden',
      borderRadius: 14,
      background: '#070f1e',
      border: locked ? '2px solid #facc15' : '1.5px solid #1e293b',
      boxShadow: locked
        ? '0 0 20px rgba(250,204,21,0.2), inset 0 0 16px rgba(0,0,0,0.8)'
        : 'inset 0 0 16px rgba(0,0,0,0.8)',
      flex: 1,
    }}>
      {/* Center highlight glow box */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: ITEM_H, height: ITEM_H,
        zIndex: 10, pointerEvents: 'none',
        background: locked
          ? 'linear-gradient(90deg, rgba(250,204,21,0.05), rgba(250,204,21,0.12), rgba(250,204,21,0.05))'
          : 'rgba(255,255,255,0.015)',
        borderTop: locked ? '1.5px solid rgba(250,204,21,0.4)' : '1px solid rgba(255,255,255,0.04)',
        borderBottom: locked ? '1.5px solid rgba(250,204,21,0.4)' : '1px solid rgba(255,255,255,0.04)',
      }} />

      {/* Top fade gradient */}
      <div style={{ position:'absolute', inset:'0 0 auto', height: 40, zIndex: 11, pointerEvents:'none', background: 'linear-gradient(to bottom, #070f1e 15%, transparent)' }} />
      {/* Bottom fade gradient */}
      <div style={{ position:'absolute', inset:'auto 0 0', height: 40, zIndex: 11, pointerEvents:'none', background: 'linear-gradient(to top, #070f1e 15%, transparent)' }} />

      {/* Scroll content */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: topOffset }}>
        {repeated.map((name, idx) => {
          const isCtr = locked && name === lockedName && idx === repeated.findIndex(n => n === lockedName)
          return (
            <div key={idx} style={{ height: ITEM_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
              {spinning && !locked ? (
                <span style={{ fontSize: 15, fontWeight: 800, color: '#334155', filter: 'blur(2px)', textAlign: 'center', width: '100%' }}>
                  {name}
                </span>
              ) : isCtr ? (
                <span style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#facc15',
                  textAlign: 'center',
                  lineHeight: 1.15,
                  width: '100%',
                  wordBreak: 'break-word',
                  textShadow: '0 0 16px rgba(250,204,21,0.7), 0 2px 4px rgba(0,0,0,0.8)',
                  letterSpacing: '-0.01em',
                }}>
                  {name}
                </span>
              ) : (
                <span style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#475569',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  width: '100%',
                  wordBreak: 'break-word',
                  opacity: 0.65,
                }}>
                  {name}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminSpinWheelFullscreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId')
  const cutoff = searchParams.get('cutoff')

  const confettiCanvasRef = useRef(null)
  const isSpinningRef = useRef(false)

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [allAttendees, setAllAttendees] = useState([])
  const [excludedIds, setExcludedIds] = useState(new Set())
  const [isSpinning, setIsSpinning] = useState(false)
  const [reelLocked, setReelLocked] = useState([false, false, false])
  const [lockedName, setLockedName] = useState(null)
  const [winner, setWinner] = useState(null)
  const [showWinnerBanner, setShowWinnerBanner] = useState(false)
  const [showWinnerModal, setShowWinnerModal] = useState(false)

  useEffect(() => {
    if (!eventId) { navigate('/admin/spin-wheel'); return }
    fetchData()
  }, [eventId])

  async function fetchData() {
    try {
      setLoading(true)
      const { data: eventData, error: eventError } = await supabase.from('events').select('*').eq('id', eventId).single()
      if (eventError) throw eventError
      setEvent(eventData)

      const { data: registrations, error: regError } = await supabase.from('event_registrations').select('*').eq('event_id', eventId)
      if (regError) throw regError

      const memberIds = [...new Set((registrations || []).map(r => r.member_id).filter(Boolean))]
      let memberMap = new Map()
      if (memberIds.length > 0) {
        const { data: members, error: mErr } = await supabase.from('members').select('id, full_name, designation, email, profile_image').in('id', memberIds)
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
    if (cutoff) {
      const d = new Date(att.checkedInAt)
      const hm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      if (hm > cutoff) return false
    }
    return !excludedIds.has(att.id)
  })

  const candidateNames = activeCandidates.map(c => c.full_name)

  useEffect(() => {
    const h = (e) => { if (e.code === 'Space' && !isSpinningRef.current && !showWinnerModal) { e.preventDefault(); spin() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [showWinnerModal, activeCandidates])

  const spin = useCallback(() => {
    if (isSpinningRef.current || activeCandidates.length === 0) return
    isSpinningRef.current = true
    setIsSpinning(true)
    setReelLocked([false, false, false])
    setLockedName(null)
    setWinner(null)
    setShowWinnerBanner(false)
    setShowWinnerModal(false)

    const pickedWinner = activeCandidates[Math.floor(Math.random() * activeCandidates.length)]

    setTimeout(() => { setReelLocked([true, false, false]); playLockSound() }, 1800)
    setTimeout(() => { setReelLocked([true, true, false]); playLockSound() }, 3000)
    setTimeout(() => {
      setReelLocked([true, true, true])
      setLockedName(pickedWinner.full_name)
      playLockSound()
      isSpinningRef.current = false
      setIsSpinning(false)
      setWinner(pickedWinner)
      setShowWinnerBanner(true)
      setTimeout(() => { playWinSound(); setShowWinnerModal(true) }, 800)
    }, 4400)
  }, [activeCandidates])

  const claimAndExclude = async () => {
    if (!winner) return
    if (winner.attendanceId) {
      try {
        const { error } = await supabase.from('event_attendance').update({ lucky_draw_winner: true }).eq('id', winner.attendanceId)
        if (error) throw error
      } catch (err) { alert('Failed to save: ' + err.message) }
    }
    const n = new Set(excludedIds); n.add(winner.id); setExcludedIds(n)
    setShowWinnerModal(false)
  }

  // Confetti
  useEffect(() => {
    if (!showWinnerModal) return
    const canvas = confettiCanvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
    const colors = ['#facc15','#fb923c','#ef4444','#38bdf8','#4ade80','#a855f7']
    const particles = Array.from({ length: 250 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 3, color: colors[Math.floor(Math.random() * colors.length)],
      vx: Math.random() * 6 - 3, vy: Math.random() * 7 + 4,
      rot: Math.random() * Math.PI * 2, rotV: Math.random() * 0.12 - 0.06
    }))
    let id
    const run = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.rotV
        if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot)
        ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); ctx.restore()
      })
      id = requestAnimationFrame(run)
    }
    run()
    return () => cancelAnimationFrame(id)
  }, [showWinnerModal])

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', background:'#070d18', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width:48, height:48, borderRadius:'50%', border:'3px solid rgba(250,204,21,0.2)', borderTopColor:'#facc15', animation:'spin 0.8s linear infinite' }} />
        <p style={{ color:'#94a3b8', fontWeight:700, fontSize:15 }}>Loading Draw Pool...</p>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070d18',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', 'Be Vietnam Pro', sans-serif",
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @keyframes bounceIn { 0%{transform:scale(0.4);opacity:0} 60%{transform:scale(1.08)} 80%{transform:scale(0.96)} 100%{transform:scale(1);opacity:1} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .cand-item:hover { background: #182438 !important; }
        .lever-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .lever-btn:active { transform: translateY(1px); }
      `}</style>

      {/* Main Container - constrained max width & height */}
      <div style={{
        width: '100%',
        maxWidth: 1040,
        display: 'flex',
        gap: 20,
        alignItems: 'stretch',
        boxSizing: 'border-box'
      }}>

        {/* ── LEFT CARD: Candidate Pool ── */}
        <div style={{
          width: 300,
          minWidth: 300,
          background: '#0d1726',
          borderRadius: 20,
          border: '1px solid #1e2c42',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          maxHeight: 520,
        }}>
          {/* Card Header */}
          <div style={{ padding: '18px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #142032' }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#f8fafc', letterSpacing: '-0.01em' }}>
              Candidate Pool
            </span>
            <span style={{
              background: '#facc15',
              color: '#0f172a',
              padding: '3px 12px',
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 900
            }}>
              {activeCandidates.length}
            </span>
          </div>

          {/* Candidate List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeCandidates.map((c, i) => {
              const isWinner = winner && c.id === winner.id
              return (
                <div
                  key={c.id}
                  className="cand-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 12,
                    transition: 'all 0.15s',
                    background: isWinner
                      ? 'linear-gradient(90deg, rgba(20,83,45,0.45), rgba(22,101,52,0.65))'
                      : '#121e31',
                    border: isWinner
                      ? '1.5px solid #facc15'
                      : '1px solid #1a2942',
                    boxShadow: isWinner ? '0 0 15px rgba(250,204,21,0.2)' : 'none',
                  }}
                >
                  <span style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: isWinner ? '#facc15' : '#475569',
                    minWidth: 26
                  }}>
                    #{String(i + 1).padStart(2, '0')}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 800,
                      fontSize: 13,
                      color: isWinner ? '#facc15' : '#f1f5f9',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {c.full_name}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: isWinner ? '#86efac' : '#64748b',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: 1
                    }}>
                      {c.designation || 'Participant'}
                    </div>
                  </div>

                  {isWinner && <span style={{ fontSize: 16 }}>🏆</span>}
                </div>
              )
            })}

            {activeCandidates.length === 0 && (
              <p style={{ textAlign: 'center', color: '#475569', fontSize: 13, padding: 30, fontWeight: 600 }}>
                No active candidates
              </p>
            )}
          </div>
        </div>

        {/* ── RIGHT AREA: Slot Machine & Controls ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, justifyContent: 'center' }}>

          {/* 1. Winner Banner Header */}
          <div style={{
            height: 50,
            background: showWinnerBanner && winner
              ? 'linear-gradient(90deg, #064e3b, #047857, #064e3b)'
              : 'linear-gradient(90deg, #0d1e1a, #0d1e1a)',
            border: showWinnerBanner && winner
              ? '1.5px solid #10b981'
              : '1px solid #142a26',
            borderRadius: 14,
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            boxShadow: showWinnerBanner && winner ? '0 0 25px rgba(16,185,129,0.25)' : 'none',
            transition: 'all 0.3s ease',
          }}>
            {showWinnerBanner && winner ? (
              <>
                <span style={{ fontSize: 20, animation: 'bounceIn 0.5s ease' }}>🏆</span>
                <span style={{
                  fontSize: 17,
                  fontWeight: 900,
                  color: '#34d399',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  textShadow: '0 0 12px rgba(52,211,153,0.5)',
                }}>
                  WINNER: {winner.full_name}
                </span>
                <span style={{ fontSize: 20, animation: 'bounceIn 0.5s ease' }}>🏆</span>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>✨</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#059669', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  READY FOR LUCKY DRAW
                </span>
                <span style={{ fontSize: 15 }}>✨</span>
              </div>
            )}
          </div>

          {/* 2. Center Card Frame holding Reels */}
          <div style={{
            background: '#0d1726',
            borderRadius: 20,
            border: '1px solid #1e2c42',
            padding: '18px 20px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}>
            {/* Top Pill Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(250,204,21,0.08)',
              border: '1.5px solid #facc15',
              borderRadius: 99,
              padding: '4px 18px',
              fontSize: 11,
              fontWeight: 900,
              color: '#facc15',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 14,
              boxShadow: '0 0 12px rgba(250,204,21,0.12)',
            }}>
              <span>★</span> LUCKY DRAW <span>★</span>
            </div>

            {/* 3 Slot Reels Grid */}
            <div style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'center' }}>
              {[0, 1, 2].map(reelIdx => (
                <SlotReel
                  key={reelIdx}
                  names={candidateNames}
                  spinning={isSpinning}
                  locked={reelLocked[reelIdx]}
                  lockedName={lockedName}
                  reelIndex={reelIdx}
                />
              ))}
            </div>

            {/* Reel Indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 14 }}>
              {['REEL 1', 'REEL 2', 'REEL 3'].map((label, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: reelLocked[i] ? '#facc15' : '#475569',
                  transition: 'all 0.3s'
                }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: reelLocked[i] ? '#facc15' : '#1e293b',
                    boxShadow: reelLocked[i] ? '0 0 10px rgba(250,204,21,0.8)' : 'none',
                    transition: 'all 0.3s'
                  }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* 3. Bottom Big PULL LEVER Button */}
          <button
            onClick={spin}
            disabled={isSpinning || activeCandidates.length === 0}
            className="lever-btn"
            style={{
              height: 60,
              borderRadius: 16,
              border: 'none',
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: '0.05em',
              cursor: isSpinning || activeCandidates.length === 0 ? 'not-allowed' : 'pointer',
              background: isSpinning || activeCandidates.length === 0
                ? '#1e293b'
                : 'linear-gradient(135deg, #ea580c, #f97316)',
              color: isSpinning || activeCandidates.length === 0 ? '#475569' : '#ffffff',
              boxShadow: isSpinning || activeCandidates.length === 0
                ? 'none'
                : '0 6px 24px rgba(249,115,22,0.35)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              textTransform: 'uppercase',
            }}
          >
            <span style={{ fontSize: 24 }}>🎲</span>
            <span>{isSpinning ? 'SPINNING...' : 'PULL LEVER'}</span>
          </button>
        </div>
      </div>

      {/* ── Winner Modal Dialog ── */}
      {showWinnerModal && winner && (
        <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(10px)' }}>
          <canvas ref={confettiCanvasRef} style={{ position:'absolute', inset:0, pointerEvents:'none', width:'100%', height:'100%' }} />
          <div style={{
            position:'relative', zIndex:10, width:'100%', maxWidth:440,
            background:'linear-gradient(145deg, #0d1726, #111d30)',
            border:'2px solid #facc15', borderRadius:24, padding:32,
            display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center',
            boxShadow:'0 25px 70px rgba(250,204,21,0.25)',
            animation:'bounceIn 0.5s ease',
          }}>
            <div style={{ fontSize:52, marginBottom:10, animation:'float 2s ease-in-out infinite' }}>🏆</div>
            <div style={{ fontSize:11, fontWeight:900, letterSpacing:'0.2em', color:'#facc15', textTransform:'uppercase', marginBottom:6 }}>
              Lucky Draw Winner
            </div>
            <h1 style={{ fontSize:28, fontWeight:900, color:'#f8fafc', margin:'0 0 4px', lineHeight:1.15 }}>
              {winner.full_name}
            </h1>
            <p style={{ fontSize:14, color:'#facc15', fontWeight:700, margin:'0 0 18px' }}>
              {winner.designation || 'Participant'}
            </p>

            <div style={{ width:76, height:76, borderRadius:'50%', border:'2.5px solid #facc15', overflow:'hidden', marginBottom:20, background:'#1e293b', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 16px rgba(250,204,21,0.3)' }}>
              {winner.profile_image
                ? <img src={winner.profile_image} alt={winner.full_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={{ fontSize:30 }}>👤</span>}
            </div>

            <div style={{ display:'flex', gap:10, width:'100%' }}>
              <button onClick={claimAndExclude} style={{
                flex:1, padding:'12px 0', borderRadius:12, border:'none',
                background:'linear-gradient(135deg, #ea580c, #f97316)', color:'#fff',
                fontWeight:900, fontSize:14, cursor:'pointer',
                boxShadow:'0 4px 14px rgba(249,115,22,0.3)',
              }}>
                Claim &amp; Exclude
              </button>
              <button onClick={() => setShowWinnerModal(false)} style={{
                flex:1, padding:'12px 0', borderRadius:12, background:'transparent',
                border:'1.5px solid #1e2c42', color:'#94a3b8', fontWeight:800, fontSize:14, cursor:'pointer',
              }}>
                Keep in Pool
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
