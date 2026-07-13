import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Html5Qrcode } from 'html5-qrcode'
import BottomNav from '../components/BottomNav'

export default function EventAttendanceScanner() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [scanResult, setScanResult] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualMemberId, setManualMemberId] = useState('')
  const [stats, setStats] = useState({ registered: 0, checkedIn: 0 })
  const [cameraLoading, setCameraLoading] = useState(false)
  const [giftClaimedInput, setGiftClaimedInput] = useState('no')
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)

  useEffect(() => {
    fetchEventData()
    fetchAttendees()
    fetchStats()
  }, [eventId])

  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [])

  async function fetchEventData() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (error) throw error
      setEvent(data)
    } catch (error) {
      console.error('Error fetching event:', error)
    }
  }

  async function fetchAttendees() {
    try {
      const { data, error } = await supabase
        .from('event_attendance')
        .select(`
          *,
          member:member_id (
            id,
            full_name,
            profile_image,
            designation
          )
        `)
        .eq('event_id', eventId)
        .order('checked_in_at', { ascending: false })

      if (error) throw error
      setAttendees(data || [])
    } catch (error) {
      console.error('Error fetching attendees:', error)
    }
  }

  async function fetchStats() {
    try {
      // Get total registrations
      const { count: registered } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)

      // Get checked-in count
      const { count: checkedIn } = await supabase
        .from('event_attendance')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)

      setStats({ registered: registered || 0, checkedIn: checkedIn || 0 })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  async function startScanning() {
    try {
      setCameraLoading(true)
      
      // Set scanning state first to render the scanner element
      setIsScanning(true)
      
      // Wait for the DOM to update and element to be available
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const scannerElement = document.getElementById('qr-reader')
      if (!scannerElement) {
        throw new Error('Scanner element not found')
      }

      const html5QrCode = new Html5Qrcode('qr-reader')
      html5QrCodeRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        onScanSuccess,
        onScanFailure
      )
      
      setCameraLoading(false)
    } catch (error) {
      console.error('Error starting scanner:', error)
      setCameraLoading(false)
      setIsScanning(false)
      
      let errorMessage = 'Unable to access camera. '
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please grant camera permissions in your browser settings.'
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.'
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.'
      } else {
        errorMessage += 'Please check camera permissions and ensure you are using HTTPS or localhost.'
      }
      
      alert(errorMessage)
    }
  }

  async function stopScanning() {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        await html5QrCodeRef.current.clear()
        html5QrCodeRef.current = null
      } catch (error) {
        console.error('Error stopping scanner:', error)
      }
    }
    setIsScanning(false)
    setCameraLoading(false)
  }

  function onScanSuccess(decodedText, decodedResult) {
    // Extract member ID from QR code (expecting format: URL/member/{id} or just the ID)
    let memberId = decodedText
    if (decodedText.includes('/member/')) {
      memberId = decodedText.split('/member/').pop()
    }
    
    handleMarkAttendance(memberId)
  }

  function onScanFailure(error) {
    // Ignore scan failures (when no QR code is detected)
  }

  async function handleMarkAttendance(memberId) {
    try {
      // Stop scanning temporarily
      if (isScanning) {
        await stopScanning()
      }

      // Check if member is registered for this event
      const { data: registration, error: regError } = await supabase
        .from('event_registrations')
        .select(`
          *,
          member:member_id (
            id,
            full_name,
            profile_image,
            designation
          )
        `)
        .eq('event_id', eventId)
        .eq('member_id', memberId)
        .single()

      if (regError || !registration) {
        setScanResult({
          success: false,
          message: 'Not Registered',
          name: 'Unknown Member',
          detail: 'This member is not registered for this event.',
          memberId: memberId
        })
        return
      }

      // Generate member number based on creation order
      const { data: allMembers } = await supabase
        .from('members')
        .select('id, created_at')
        .order('created_at', { ascending: true })
      
      let memberNumber = ''
      if (allMembers) {
        const memberIndex = allMembers.findIndex(m => m.id === memberId)
        if (memberIndex !== -1) {
          const paddedNumber = String(memberIndex + 1).padStart(4, '0')
          memberNumber = `ITLC${paddedNumber}`
        }
      }

      // Check if already checked in
      const { data: existing } = await supabase
        .from('event_attendance')
        .select('*')
        .eq('event_id', eventId)
        .eq('member_id', memberId)
        .maybeSingle()

      if (existing) {
        if (existing.checked_out || existing.checked_out_at) {
          setScanResult({
            success: false,
            message: 'Already Checked Out',
            name: registration.member.full_name,
            detail: `Checked out at ${new Date(existing.checked_out_at).toLocaleTimeString()} (Gift Claimed: ${existing.gift_claimed === 'yes' ? 'Yes' : 'No'})`,
            memberId: memberId,
            memberNumber: memberNumber,
            member: registration.member
          })
        } else {
          setGiftClaimedInput('no')
          setScanResult({
            success: true,
            isCheckoutPrompt: true,
            attendanceId: existing.id,
            name: registration.member.full_name,
            checkedInTime: existing.checked_in_at,
            memberId: memberId,
            memberNumber: memberNumber,
            member: registration.member
          })
        }
        return
      }

      // Mark attendance
      const { error: attendanceError } = await supabase
        .from('event_attendance')
        .insert([
          {
            event_id: eventId,
            member_id: memberId,
            checked_in_at: new Date().toISOString()
          }
        ])

      if (attendanceError) throw attendanceError

      setScanResult({
        success: true,
        message: 'Check-In Successful',
        name: registration.member.full_name,
        detail: `Welcome to ${event?.title || 'the event'}!`,
        memberId: memberId,
        memberNumber: memberNumber,
        member: registration.member
      })

      // Refresh attendees and stats
      fetchAttendees()
      fetchStats()
    } catch (error) {
      console.error('Error processing attendance:', error)
      setScanResult({
        success: false,
        message: 'Error',
        name: '',
        detail: 'Failed to mark attendance. Please try again.',
        memberId: memberId
      })
    }
  }

  async function handleCheckout(attendanceId, giftClaimed) {
    try {
      const { error } = await supabase
        .from('event_attendance')
        .update({
          checked_out: true,
          checked_out_at: new Date().toISOString(),
          gift_claimed: giftClaimed
        })
        .eq('id', attendanceId)

      if (error) throw error

      setScanResult(null)
      alert('Checkout processed successfully!')
      fetchAttendees()
      fetchStats()
      if (!isScanning) {
        startScanning()
      }
    } catch (error) {
      console.error('Error processing checkout:', error)
      alert('Failed to process checkout: ' + error.message)
    }
  }

  async function handleManualEntry() {
    if (!manualMemberId.trim()) {
      alert('Please enter a Member ID')
      return
    }
    
    await handleMarkAttendance(manualMemberId.trim())
    setManualMemberId('')
    setShowManualEntry(false)
  }

  function handleContinueScanning() {
    setScanResult(null)
    if (!isScanning) {
      startScanning()
    }
  }

  return (
    <div className="relative flex h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="text-center flex-1">
          <h1 className="text-lg font-bold leading-tight tracking-tight">Attendance Scanner</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate px-2">
            {event?.title || 'Loading...'}
          </p>
        </div>
        <button 
          onClick={() => navigate(`/admin/event-registrations/${eventId}`)}
          className="flex items-center justify-center size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined">group</span>
        </button>
      </header>

      {/* Stats Bar */}
      <div className="bg-white dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
            <div className="text-xl font-bold text-primary">{stats.registered}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Registered</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.checkedIn}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Checked In</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {stats.registered > 0 ? Math.round((stats.checkedIn / stats.registered) * 100) : 0}%
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Attendance</div>
          </div>
        </div>
      </div>

      {/* Scanner Viewport Area */}
      <main className="relative flex-1 flex flex-col overflow-hidden">
        {!isScanning ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-4">
                <span className="material-symbols-outlined text-6xl text-primary">qr_code_scanner</span>
              </div>
              <h2 className="text-xl font-bold mb-2">Ready to Scan</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Start the scanner to check in members
              </p>
            </div>
            
            <button
              onClick={startScanning}
              disabled={cameraLoading}
              className="w-full max-w-xs bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] mb-4"
            >
              <span className="material-symbols-outlined">{cameraLoading ? 'hourglass_empty' : 'qr_code_scanner'}</span>
              {cameraLoading ? 'Starting...' : 'Start Scanner'}
            </button>

            <button
              onClick={() => setShowManualEntry(true)}
              className="w-full max-w-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <span className="material-symbols-outlined">badge</span>
              Manual Entry
            </button>
          </div>
        ) : (
          <div className="flex-1 relative bg-black">
            {/* QR Reader Container */}
            <div ref={scannerRef} id="qr-reader" className="w-full h-full"></div>
            
            {/* Camera Loading Overlay */}
            {cameraLoading && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4 animate-pulse">
                    <span className="material-symbols-outlined text-4xl text-primary">videocam</span>
                  </div>
                  <p className="text-white font-semibold">Initializing Camera...</p>
                  <p className="text-white/60 text-sm mt-2">Please allow camera access</p>
                </div>
              </div>
            )}
            
            {/* Scanner Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="flex items-center justify-center h-full">
                <div className="relative w-64 h-64">
                  {/* Corner Accents */}
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
                </div>
              </div>
              
              <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                <div className="bg-black/70 backdrop-blur-md text-white px-6 py-3 rounded-full text-sm font-medium">
                  Align QR code within the frame
                </div>
              </div>
            </div>

            {/* Stop Scanner Button */}
            <div className="absolute top-4 right-4 z-10 pointer-events-auto">
              <button
                onClick={stopScanning}
                className="bg-red-500 hover:bg-red-600 text-white font-bold p-3 rounded-full shadow-lg transition-all active:scale-95"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>
        )}

        {/* Attendees List */}
        {attendees.length > 0 && !isScanning && (
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 max-h-64 overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Recent Check-ins ({attendees.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {attendees.slice(0, 10).map((attendance) => (
                <div key={attendance.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                    {attendance.member?.profile_image ? (
                      <img 
                        src={attendance.member.profile_image} 
                        alt={attendance.member.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-400">person</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{attendance.member?.full_name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {attendance.member?.designation || 'Member'}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(attendance.checked_in_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                  <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Manual Entry Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Manual Check-In</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Enter the member ID to mark attendance
              </p>
              <input
                type="text"
                value={manualMemberId}
                onChange={(e) => setManualMemberId(e.target.value)}
                placeholder="Enter Member ID"
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                onKeyPress={(e) => e.key === 'Enter' && handleManualEntry()}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowManualEntry(false)
                    setManualMemberId('')
                  }}
                  className="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualEntry}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg transition-colors"
                >
                  Check In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Results Drawer (Appears on Scan) */}
      {scanResult && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={handleContinueScanning}>
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 transform translate-y-0 transition-transform duration-300 pb-safe" onClick={(e) => e.stopPropagation()}>
            {/* Pull Handle */}
            <div className="flex h-6 w-full items-center justify-center pt-2">
              <div className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700"></div>
            </div>
            
            <div className="px-6 pb-8 pt-2">
              {/* Member Info */}
              {scanResult.member && (
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                    {scanResult.member.profile_image ? (
                      <img 
                        src={scanResult.member.profile_image} 
                        alt={scanResult.member.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-slate-400">person</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-lg">{scanResult.name}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {scanResult.member.designation || 'Member'}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      ID: {scanResult.memberNumber || `#${scanResult.memberId?.toString().slice(0, 8)}`}
                    </div>
                  </div>
                </div>
              )}

              {/* Status Message */}
              {scanResult.isCheckoutPrompt ? (
                <div className="flex flex-col gap-4 p-4 mb-4 bg-primary/10 border-2 border-primary/30 rounded-xl text-left">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/20">
                      <span className="material-symbols-outlined text-3xl">logout</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-primary font-bold text-lg leading-tight">
                        Check-Out Prompt
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Already checked in at {new Date(scanResult.checkedInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                      </p>
                    </div>
                  </div>

                  {event?.gift === 'yes' && (
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-3 mt-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        Gift claimed or not?
                      </p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="giftClaimed"
                            value="yes"
                            checked={giftClaimedInput === 'yes'}
                            onChange={() => setGiftClaimedInput('yes')}
                            className="rounded-full border-slate-300 text-primary focus:ring-primary size-4"
                          />
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Yes, Claimed</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="giftClaimed"
                            value="no"
                            checked={giftClaimedInput === 'no'}
                            onChange={() => setGiftClaimedInput('no')}
                            className="rounded-full border-slate-300 text-primary focus:ring-primary size-4"
                          />
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">No, Not Claimed</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ) : scanResult.success ? (
                <div className="flex items-center gap-4 p-4 mb-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/20">
                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-green-600 dark:text-green-400 font-bold text-lg leading-tight">
                      {scanResult.message}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {scanResult.detail}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4 mb-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/20">
                    <span className="material-symbols-outlined text-3xl">error</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-red-600 dark:text-red-400 font-bold text-lg leading-tight">
                      {scanResult.message}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {scanResult.detail}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {scanResult.isCheckoutPrompt ? (
                  <button
                    onClick={() => handleCheckout(scanResult.attendanceId, event?.gift === 'yes' ? giftClaimedInput : 'no')}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-red-600/20 transition-all active:scale-[0.98]"
                  >
                    Confirm Check-Out
                  </button>
                ) : (
                  <button
                    onClick={handleContinueScanning}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                  >
                    Continue Scanning
                  </button>
                )}
                {scanResult.isCheckoutPrompt ? (
                  <button
                    onClick={handleContinueScanning}
                    className="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-4 rounded-xl font-bold text-sm transition-all"
                  >
                    Cancel
                  </button>
                ) : (
                  scanResult.member && (
                    <button
                      onClick={() => navigate(`/member/${scanResult.memberId}`)}
                      className="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-4 rounded-xl font-bold text-sm transition-all"
                    >
                      View Profile
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  )
}
