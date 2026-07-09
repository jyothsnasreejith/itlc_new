import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { QRCodeCanvas } from 'qrcode.react'
import html2canvas from 'html2canvas'
import BottomNav from '../components/BottomNav'

export default function AdminEventCheckInQR() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const cardRef = useRef(null)

  const checkInUrl = `${window.location.origin}/attend/${id}`

  useEffect(() => {
    fetchEvent()
  }, [id])

  async function fetchEvent() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setEvent(data)
    } catch (err) {
      console.error('Error fetching event:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#ffffff', scale: 2 })
      const link = document.createElement('a')
      link.download = `${(event?.title || 'event').replace(/\s+/g, '-').toLowerCase()}-checkin-qr.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Error downloading QR:', err)
    } finally {
      setDownloading(false)
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(checkInUrl)
      alert('Check-in link copied to clipboard')
    } catch (err) {
      console.error('Error copying link:', err)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="text-center flex-1">
          <h1 className="text-lg font-bold leading-tight tracking-tight">Check-In QR Code</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate px-2">
            {event?.title || 'Loading...'}
          </p>
        </div>
        <button
          onClick={() => navigate(`/admin/event-registrations/${id}`)}
          className="flex items-center justify-center size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined">group</span>
        </button>
      </header>

      <main className="flex flex-col items-center px-4 py-8">
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm mb-6">
          Display this QR code at the venue. Attendees scan it with their own phone,
          confirm their phone number (and PIN, for members), and get checked in instantly.
        </p>

        {/* Printable QR Card */}
        <div ref={cardRef} className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center max-w-sm w-full">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-slate-900">{event?.title}</h2>
            <p className="text-sm text-slate-500">{event?.date} · {event?.location}</p>
          </div>
          <div className="p-4 bg-white border-4 border-slate-100 rounded-xl">
            <QRCodeCanvas value={checkInUrl} size={220} level="M" includeMargin={false} />
          </div>
          <p className="text-sm font-semibold text-slate-700 mt-6">Scan to check in</p>
        </div>

        {/* Actions */}
        <div className="w-full max-w-sm mt-6 space-y-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-bold py-3 rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined">download</span>
            {downloading ? 'Preparing...' : 'Download QR'}
          </button>
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined">link</span>
            Copy Check-In Link
          </button>
          <button
            onClick={() => navigate(`/scanner/${id}`)}
            className="w-full flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Staff Scanner (Check IDs Instead)
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
