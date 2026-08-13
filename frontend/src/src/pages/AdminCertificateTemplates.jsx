import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import { Editor } from '@tinymce/tinymce-react'
import { useCertificateTemplate } from '../hooks/useCertificateTemplate'

const STYLE_PRESETS = {
  'classic-gold': {
    name: 'Classic Gold',
    bgClass: 'bg-[#FAF8F5]',
    borderClass: 'border-[#C5A880]',
    accentText: 'text-[#B45309]',
    primaryText: 'text-slate-800',
    borderColor: '#C5A880',
    primaryColor: '#B45309'
  },
  'modern-indigo': {
    name: 'Modern Indigo',
    bgClass: 'bg-[#F8FAFC]',
    borderClass: 'border-[#4F46E5]',
    accentText: 'text-[#4F46E5]',
    primaryText: 'text-[#0F172A]',
    borderColor: '#4F46E5',
    primaryColor: '#4F46E5'
  },
  'emerald-mint': {
    name: 'Emerald Mint',
    bgClass: 'bg-[#F0FDF4]',
    borderClass: 'border-[#059669]',
    accentText: 'text-[#059669]',
    primaryText: 'text-[#0F172A]',
    borderColor: '#059669',
    primaryColor: '#059669'
  },
  'royal-crimson': {
    name: 'Royal Crimson',
    bgClass: 'bg-[#FFF5F5]',
    borderClass: 'border-[#991B1B]',
    accentText: 'text-[#991B1B]',
    primaryText: 'text-[#0F172A]',
    borderColor: '#991B1B',
    primaryColor: '#991B1B'
  }
}

export default function AdminCertificateTemplates() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [loadingEvents, setLoadingEvents] = useState(true)

  // Drag & Touch Pinch State
  const [activeDragTarget, setActiveDragTarget] = useState(null) // 'left' | 'right' | null
  const dragStartRef = useRef({ x: 0, y: 0, initialOffsetX: 0, initialOffsetY: 0 })
  const touchPinchRef = useRef({ side: 'right', initialDist: 0, initialScale: 1 })

  const {
    template,
    setTemplate,
    customLogo,
    loading: loadingTemplate,
    saving,
    error,
    setError,
    success,
    saveTemplate
  } = useCertificateTemplate()

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    try {
      setLoadingEvents(true)
      const { data, error: err } = await supabase
        .from('events')
        .select('id, title, date, location')
        .order('date', { ascending: false })

      if (err) throw err
      setEvents(data || [])
      if (data && data.length > 0) {
        setSelectedEventId(data[0].id)
      }
    } catch (err) {
      console.error('Error fetching events:', err)
      setError('Failed to load events list.')
    } finally {
      setLoadingEvents(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    await saveTemplate()
  }

  const handleSignatureUpload = (e, side = 'right') => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file for the signature.')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setTemplate(prev => ({
          ...prev,
          [side === 'left' ? 'leftSignatureImage' : 'signatureImage']: reader.result,
          [side === 'left' ? 'leftSignatureScale' : 'signatureScale']: prev[side === 'left' ? 'leftSignatureScale' : 'signatureScale'] || 1,
          [side === 'left' ? 'leftSignatureOffsetX' : 'signatureOffsetX']: prev[side === 'left' ? 'leftSignatureOffsetX' : 'signatureOffsetX'] || 0,
          [side === 'left' ? 'leftSignatureOffsetY' : 'signatureOffsetY']: prev[side === 'left' ? 'leftSignatureOffsetY' : 'signatureOffsetY'] || 0
        }))
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  // Mouse Drag Handlers
  const handleMouseDown = (e, side = 'right') => {
    e.preventDefault()
    setActiveDragTarget(side)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialOffsetX: side === 'left' ? (template.leftSignatureOffsetX || 0) : (template.signatureOffsetX || 0),
      initialOffsetY: side === 'left' ? (template.leftSignatureOffsetY || 0) : (template.signatureOffsetY || 0)
    }
  }

  const handleMouseMove = useCallback((e) => {
    if (!activeDragTarget) return
    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y
    const newX = Math.min(120, Math.max(-120, dragStartRef.current.initialOffsetX + deltaX))
    const newY = Math.min(60, Math.max(-60, dragStartRef.current.initialOffsetY + deltaY))
    setTemplate(prev => ({
      ...prev,
      [activeDragTarget === 'left' ? 'leftSignatureOffsetX' : 'signatureOffsetX']: Math.round(newX),
      [activeDragTarget === 'left' ? 'leftSignatureOffsetY' : 'signatureOffsetY']: Math.round(newY)
    }))
  }, [activeDragTarget, setTemplate])

  const handleMouseUp = useCallback(() => {
    setActiveDragTarget(null)
  }, [])

  useEffect(() => {
    if (activeDragTarget) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [activeDragTarget, handleMouseMove, handleMouseUp])

  // Touch Drag & Pinch-to-Zoom Handlers (Mobile)
  const handleTouchStart = (e, side = 'right') => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      setActiveDragTarget(side)
      dragStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        initialOffsetX: side === 'left' ? (template.leftSignatureOffsetX || 0) : (template.signatureOffsetX || 0),
        initialOffsetY: side === 'left' ? (template.leftSignatureOffsetY || 0) : (template.signatureOffsetY || 0)
      }
    } else if (e.touches.length === 2) {
      setActiveDragTarget(null)
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      touchPinchRef.current = {
        side,
        initialDist: dist,
        initialScale: side === 'left' ? (template.leftSignatureScale || 1) : (template.signatureScale || 1)
      }
    }
  }

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && activeDragTarget) {
      const touch = e.touches[0]
      const deltaX = touch.clientX - dragStartRef.current.x
      const deltaY = touch.clientY - dragStartRef.current.y
      const newX = Math.min(120, Math.max(-120, dragStartRef.current.initialOffsetX + deltaX))
      const newY = Math.min(60, Math.max(-60, dragStartRef.current.initialOffsetY + deltaY))
      setTemplate(prev => ({
        ...prev,
        [activeDragTarget === 'left' ? 'leftSignatureOffsetX' : 'signatureOffsetX']: Math.round(newX),
        [activeDragTarget === 'left' ? 'leftSignatureOffsetY' : 'signatureOffsetY']: Math.round(newY)
      }))
    } else if (e.touches.length === 2 && touchPinchRef.current.initialDist > 0) {
      const side = touchPinchRef.current.side || 'right'
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const factor = dist / touchPinchRef.current.initialDist
      const newScale = Math.min(3.0, Math.max(0.3, touchPinchRef.current.initialScale * factor))
      setTemplate(prev => ({
        ...prev,
        [side === 'left' ? 'leftSignatureScale' : 'signatureScale']: parseFloat(newScale.toFixed(2))
      }))
    }
  }

  const handleTouchEnd = () => {
    setActiveDragTarget(null)
    touchPinchRef.current.initialDist = 0
  }

  // Generate preview text replacing placeholders with dummy data
  const renderPreviewText = (text) => {
    if (!text) return ''
    const selectedEvent = events.find(ev => ev.id === selectedEventId) || {
      title: '[Sample Event Name]',
      date: 'July 14, 2026',
      location: 'Grand Ballroom, ITLC Center'
    }

    let processed = text
    processed = processed.replace(/\{\{\s*name\s*\}\}/gi, 'John Doe')
    processed = processed.replace(/\btest\b/gi, 'John Doe')
    processed = processed.replace(/\{\{\s*event_title\s*\}\}/gi, selectedEvent.title)
    processed = processed.replace(/\{\{\s*date\s*\}\}/gi, selectedEvent.date)
    processed = processed.replace(/\{\{\s*location\s*\}\}/gi, selectedEvent.location || 'N/A')
    return processed
  }

  const selectedPreset = STYLE_PRESETS[template.bgStyle] || STYLE_PRESETS['classic-gold']
  const isLongContent = (template.bodyText || '').length > 150

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 select-none">
      <style>{`
        .tox-notifications-container, .tox-statusbar__branding {
          display: none !important;
        }
        .cert-body-content p {
          margin-bottom: 0.2rem;
        }
        .cert-body-content p:last-child {
          margin-bottom: 0;
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Certificate Templates</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure participant check-out certificates</p>
          </div>
        </div>
      </header>

      {loadingEvents || loadingTemplate ? (
        <div className="flex items-center justify-center p-12">
          <p className="text-slate-500">Loading certificate configuration...</p>
        </div>
      ) : (
        <main className="p-4 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Editor Column */}
          <div className="lg:col-span-5 space-y-6 select-text">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
              <h2 className="text-md font-bold text-slate-950 dark:text-white mb-4">Template Settings</h2>
              
              <form onSubmit={handleSave} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800/40 rounded-lg text-sm">
                    {success}
                  </div>
                )}

                {/* Event Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Choose Event
                  </label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
                  >
                    {events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} ({e.date})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Style Preset Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Certificate Theme
                  </label>
                  <select
                    value={template.bgStyle}
                    onChange={(e) => setTemplate({ ...template, bgStyle: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
                  >
                    {Object.keys(STYLE_PRESETS).map((key) => (
                      <option key={key} value={key}>
                        {STYLE_PRESETS[key].name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Header Text */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Certificate Header Text
                  </label>
                  <input
                    type="text"
                    value={template.headerText}
                    onChange={(e) => setTemplate({ ...template, headerText: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
                    placeholder="IT Leaders Community Kerala"
                    required
                  />
                </div>

                {/* Certificate Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Certificate Title
                  </label>
                  <input
                    type="text"
                    value={template.title}
                    onChange={(e) => setTemplate({ ...template, title: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
                    placeholder="Certificate of Participation"
                    required
                  />
                </div>

                {/* Subtitle Text */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Certificate Subtitle
                  </label>
                  <input
                    type="text"
                    value={template.subTitle}
                    onChange={(e) => setTemplate({ ...template, subTitle: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
                    placeholder="This is proudly presented to"
                    required
                  />
                </div>

                {/* Event Specific Logos (Max 3) */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 flex justify-between items-center">
                    <span>Event Logos (Max 3)</span>
                    <span className="text-[10px] text-slate-400 normal-case font-normal">
                      {template.logos?.length || 0} / 3 uploaded
                    </span>
                  </label>
                  
                  {template.logos && template.logos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {template.logos.map((logo, idx) => (
                        <div key={idx} className="relative aspect-[3/2] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 flex items-center justify-center group">
                          <img src={logo} alt={`Uploaded logo ${idx+1}`} className="max-h-full max-w-full object-contain" />
                          <button
                            type="button"
                            onClick={() => {
                              const newLogos = [...template.logos]
                              newLogos.splice(idx, 1)
                              setTemplate({ ...template, logos: newLogos })
                            }}
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center justify-center size-5 shadow"
                          >
                            <span className="material-symbols-outlined text-[12px] leading-none">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(!template.logos || template.logos.length < 3) && (
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            if (!file.type.startsWith('image/')) {
                              alert('Please select an image file.')
                              return
                            }
                            const reader = new FileReader()
                            reader.onload = () => {
                              const newLogos = [...(template.logos || []), reader.result]
                              setTemplate({ ...template, logos: newLogos })
                            }
                            reader.readAsDataURL(file)
                          }
                          e.target.value = ''
                        }}
                        className="hidden"
                      />
                      <div className="cursor-pointer border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary/50 dark:hover:border-primary/50 bg-slate-50/50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 py-3 rounded-lg font-semibold transition-all text-center text-xs flex items-center justify-center gap-1.5">
                        <span className="material-symbols-outlined text-md">add_photo_alternate</span>
                        Upload Logo
                      </div>
                    </label>
                  )}
                </div>

                {/* Certificate Content Body Text */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Certificate Content
                    </label>
                    <span className="text-[10px] text-primary dark:text-primary font-semibold">Placeholders: name, event_title, date, location</span>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <Editor
                      tinymceScriptSrc="https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.2/tinymce.min.js"
                      value={template.bodyText}
                      onEditorChange={(content) => setTemplate({ ...template, bodyText: content })}
                      init={{
                        height: 220,
                        menubar: false,
                        plugins: [
                          'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                          'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                          'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                        ],
                        toolbar: 'undo redo | bold italic | forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat',
                        content_style: 'body { font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px }',
                        skin: document.documentElement.classList.contains('dark') ? 'oxide-dark' : 'oxide',
                        content_css: document.documentElement.classList.contains('dark') ? 'dark' : 'default'
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-normal">
                    Format: Use double curly braces like <code>{"{{name}}"}</code> to insert values dynamically.
                  </p>
                </div>

                {/* Left Signatory Section (Optional) */}
                <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={template.leftSignatoryEnabled || false}
                        onChange={(e) => setTemplate({ ...template, leftSignatoryEnabled: e.target.checked })}
                        className="size-4 text-primary rounded border-slate-300 dark:border-slate-700 focus:ring-primary"
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        Left Signatory (Optional)
                      </span>
                    </label>
                    {template.leftSignatoryEnabled && template.leftSignatureImage && (
                      <button
                        type="button"
                        onClick={() => setTemplate({ ...template, leftSignatureImage: '', leftSignatureScale: 1, leftSignatureOffsetX: 0, leftSignatureOffsetY: 0 })}
                        className="text-[11px] text-red-500 hover:underline font-semibold"
                      >
                        Remove Signature
                      </button>
                    )}
                  </div>

                  {template.leftSignatoryEnabled && (
                    <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      {/* Left Signature Image */}
                      {template.leftSignatureImage ? (
                        <div className="space-y-3">
                          <div className="relative p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between">
                            <img
                              src={template.leftSignatureImage}
                              alt="Left Signature"
                              className="h-9 max-w-[130px] object-contain"
                            />
                            <label className="cursor-pointer text-xs text-primary font-semibold hover:underline">
                              Change Image
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleSignatureUpload(e, 'left')}
                              />
                            </label>
                          </div>

                          {/* Range Controls & Reset */}
                          <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">open_with</span> Position Controls
                              </span>
                              <button
                                type="button"
                                onClick={() => setTemplate({ ...template, leftSignatureScale: 1, leftSignatureOffsetX: 0, leftSignatureOffsetY: 0 })}
                                className="text-[10px] text-primary hover:underline font-semibold"
                              >
                                Reset
                              </button>
                            </div>

                            {/* Size / Scale Slider */}
                            <div>
                              <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                                <span>Size / Scale</span>
                                <span>{Math.round((template.leftSignatureScale || 1) * 100)}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setTemplate({ ...template, leftSignatureScale: Math.max(0.3, parseFloat(((template.leftSignatureScale || 1) - 0.1).toFixed(2))) })}
                                  className="size-6 bg-slate-200 dark:bg-slate-800 rounded flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-300"
                                >
                                  -
                                </button>
                                <input
                                  type="range"
                                  min="0.3"
                                  max="3.0"
                                  step="0.05"
                                  value={template.leftSignatureScale || 1}
                                  onChange={(e) => setTemplate({ ...template, leftSignatureScale: parseFloat(e.target.value) })}
                                  className="w-full accent-primary h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <button
                                  type="button"
                                  onClick={() => setTemplate({ ...template, leftSignatureScale: Math.min(3.0, parseFloat(((template.leftSignatureScale || 1) + 0.1).toFixed(2))) })}
                                  className="size-6 bg-slate-200 dark:bg-slate-800 rounded flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-300"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Horizontal Position (X) */}
                            <div>
                              <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                                <span>Horizontal Offset (X)</span>
                                <span>{template.leftSignatureOffsetX || 0}px</span>
                              </div>
                              <input
                                type="range"
                                min="-120"
                                max="120"
                                step="1"
                                value={template.leftSignatureOffsetX || 0}
                                onChange={(e) => setTemplate({ ...template, leftSignatureOffsetX: parseInt(e.target.value, 10) })}
                                className="w-full accent-primary h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>

                            {/* Vertical Position (Y) */}
                            <div>
                              <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                                <span>Vertical Offset (Y)</span>
                                <span>{template.leftSignatureOffsetY || 0}px</span>
                              </div>
                              <input
                                type="range"
                                min="-60"
                                max="60"
                                step="1"
                                value={template.leftSignatureOffsetY || 0}
                                onChange={(e) => setTemplate({ ...template, leftSignatureOffsetY: parseInt(e.target.value, 10) })}
                                className="w-full accent-primary h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <label className="block">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSignatureUpload(e, 'left')}
                            className="hidden"
                          />
                          <div className="cursor-pointer border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary/50 dark:hover:border-primary/50 bg-white/60 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 py-2.5 rounded-lg font-semibold transition-all text-center text-xs flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-md">draw</span>
                            Upload Left Signature Image
                          </div>
                        </label>
                      )}

                      {/* Signatory Name */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                          Signatory Name
                        </label>
                        <input
                          type="text"
                          value={template.leftSignatoryName || ''}
                          onChange={(e) => setTemplate({ ...template, leftSignatoryName: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
                          placeholder="e.g., General Secretary"
                        />
                      </div>

                      {/* Signatory Designation */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                          Signatory Designation
                        </label>
                        <input
                          type="text"
                          value={template.leftSignatoryDesignation || ''}
                          onChange={(e) => setTemplate({ ...template, leftSignatoryDesignation: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
                          placeholder="e.g., IT Leaders Community"
                        />
                      </div>

                      {/* Signatory Company */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                          Signatory Company / Organization
                        </label>
                        <input
                          type="text"
                          value={template.leftSignatoryCompany || ''}
                          onChange={(e) => setTemplate({ ...template, leftSignatoryCompany: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
                          placeholder="e.g., ITLC Kerala"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Signatory Section (Optional) */}
                <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={template.rightSignatoryEnabled !== false}
                        onChange={(e) => setTemplate({ ...template, rightSignatoryEnabled: e.target.checked })}
                        className="size-4 text-primary rounded border-slate-300 dark:border-slate-700 focus:ring-primary"
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        Right Signatory (Optional)
                      </span>
                    </label>
                    {template.rightSignatoryEnabled !== false && template.signatureImage && (
                      <button
                        type="button"
                        onClick={() => setTemplate({ ...template, signatureImage: '', signatureScale: 1, signatureOffsetX: 0, signatureOffsetY: 0 })}
                        className="text-[11px] text-red-500 hover:underline font-semibold"
                      >
                        Remove Signature
                      </button>
                    )}
                  </div>

                  {template.rightSignatoryEnabled !== false && (
                    <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      {/* Right Signature Image */}
                      {template.signatureImage ? (
                        <div className="space-y-3">
                          <div className="relative p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between">
                            <img
                              src={template.signatureImage}
                              alt="Right Signature"
                              className="h-9 max-w-[130px] object-contain"
                            />
                            <label className="cursor-pointer text-xs text-primary font-semibold hover:underline">
                              Change Image
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleSignatureUpload(e, 'right')}
                              />
                            </label>
                          </div>

                          {/* Range Controls & Reset */}
                          <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">open_with</span> Position Controls
                              </span>
                              <button
                                type="button"
                                onClick={() => setTemplate({ ...template, signatureScale: 1, signatureOffsetX: 0, signatureOffsetY: 0 })}
                                className="text-[10px] text-primary hover:underline font-semibold"
                              >
                                Reset
                              </button>
                            </div>

                            {/* Size / Scale Slider */}
                            <div>
                              <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                                <span>Size / Scale</span>
                                <span>{Math.round((template.signatureScale || 1) * 100)}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setTemplate({ ...template, signatureScale: Math.max(0.3, parseFloat(((template.signatureScale || 1) - 0.1).toFixed(2))) })}
                                  className="size-6 bg-slate-200 dark:bg-slate-800 rounded flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-300"
                                >
                                  -
                                </button>
                                <input
                                  type="range"
                                  min="0.3"
                                  max="3.0"
                                  step="0.05"
                                  value={template.signatureScale || 1}
                                  onChange={(e) => setTemplate({ ...template, signatureScale: parseFloat(e.target.value) })}
                                  className="w-full accent-primary h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <button
                                  type="button"
                                  onClick={() => setTemplate({ ...template, signatureScale: Math.min(3.0, parseFloat(((template.signatureScale || 1) + 0.1).toFixed(2))) })}
                                  className="size-6 bg-slate-200 dark:bg-slate-800 rounded flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-300"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Horizontal Position (X) */}
                            <div>
                              <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                                <span>Horizontal Offset (X)</span>
                                <span>{template.signatureOffsetX || 0}px</span>
                              </div>
                              <input
                                type="range"
                                min="-120"
                                max="120"
                                step="1"
                                value={template.signatureOffsetX || 0}
                                onChange={(e) => setTemplate({ ...template, signatureOffsetX: parseInt(e.target.value, 10) })}
                                className="w-full accent-primary h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>

                            {/* Vertical Position (Y) */}
                            <div>
                              <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                                <span>Vertical Offset (Y)</span>
                                <span>{template.signatureOffsetY || 0}px</span>
                              </div>
                              <input
                                type="range"
                                min="-60"
                                max="60"
                                step="1"
                                value={template.signatureOffsetY || 0}
                                onChange={(e) => setTemplate({ ...template, signatureOffsetY: parseInt(e.target.value, 10) })}
                                className="w-full accent-primary h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <label className="block">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSignatureUpload(e, 'right')}
                            className="hidden"
                          />
                          <div className="cursor-pointer border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary/50 dark:hover:border-primary/50 bg-white/60 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 py-2.5 rounded-lg font-semibold transition-all text-center text-xs flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-md">draw</span>
                            Upload Right Signature Image
                          </div>
                        </label>
                      )}

                      {/* Signatory Name */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                          Signatory Name
                        </label>
                        <input
                          type="text"
                          value={template.signatoryName || ''}
                          onChange={(e) => setTemplate({ ...template, signatoryName: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
                          placeholder="e.g., ITLC President"
                        />
                      </div>

                      {/* Signatory Designation */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                          Signatory Designation
                        </label>
                        <input
                          type="text"
                          value={template.signatoryDesignation || ''}
                          onChange={(e) => setTemplate({ ...template, signatoryDesignation: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
                          placeholder="e.g., IT Leaders Community"
                        />
                      </div>

                      {/* Signatory Company */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                          Signatory Company / Organization
                        </label>
                        <input
                          type="text"
                          value={template.signatoryCompany || ''}
                          onChange={(e) => setTemplate({ ...template, signatoryCompany: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
                          placeholder="e.g., ITLC Kerala"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  disabled={saving || !selectedEventId}
                  className="w-full bg-primary hover:bg-primary/95 text-white py-3 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm text-sm"
                >
                  <span className="material-symbols-outlined text-md">save</span>
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </form>
            </div>
          </div>

          {/* Preview Column */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">
              Live Preview
            </h2>
            
            {/* The Certificate Frame */}
            <div className={`w-full aspect-[1.414/1] rounded-xl border-8 ${selectedPreset.borderClass} ${selectedPreset.bgClass} shadow-lg relative p-4 md:p-6 pb-2.5 md:pb-4 flex flex-col justify-between overflow-hidden border-double transition-all`}>
              
              {/* Corner Ornaments */}
              <div className={`absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 ${selectedPreset.borderClass}`}></div>
              <div className={`absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 ${selectedPreset.borderClass}`}></div>
              <div className={`absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 ${selectedPreset.borderClass}`}></div>
              <div className={`absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 ${selectedPreset.borderClass}`}></div>

              {/* Logo / Header (shrink-0) */}
              <div className="flex flex-col items-center text-center shrink-0">
                <div className="flex items-center justify-center gap-4 mb-1 min-h-[40px] md:min-h-[48px]">
                  {template.logos && template.logos.length > 0 ? (
                    template.logos.map((logo, idx) => (
                      <img key={idx} src={logo} alt={`Logo ${idx+1}`} className="h-8 md:h-11 object-contain" />
                    ))
                  ) : (
                    customLogo ? (
                      <img src={customLogo} alt="Logo" className="h-8 md:h-11 object-contain" />
                    ) : (
                      <div className={`text-xl md:text-2xl font-bold ${selectedPreset.accentText}`}>ITLC</div>
                    )
                  )}
                </div>
                <h3 className="text-[9px] md:text-xs font-semibold tracking-widest text-slate-400 uppercase font-sans select-none">
                  {template.headerText}
                </h3>
              </div>

              {/* Certificate Core Content */}
              <div className="text-center flex-1 flex flex-col justify-center my-1.5 md:my-2.5">
                <h2 className={`text-sm md:text-xl font-bold font-serif tracking-wide ${selectedPreset.accentText} uppercase shrink-0`}>
                  {template.title}
                </h2>
                
                <p className="text-[9px] md:text-xs text-slate-400 italic font-serif mt-1 shrink-0 select-none">
                  {template.subTitle}
                </p>

                {/* Attendee Name */}
                <h1 className="text-base md:text-2xl font-extrabold font-serif my-1 md:my-2 text-slate-800 dark:text-slate-100 italic shrink-0 select-none">
                  John Doe
                </h1>

                {/* Body Text Rendering */}
                <div 
                  className={`cert-body-content text-[11px] md:text-sm leading-relaxed max-w-xl mx-auto px-4 ${selectedPreset.primaryText} font-sans`}
                  dangerouslySetInnerHTML={{ __html: renderPreviewText(template.bodyText) }}
                />
              </div>

              {/* Signatories Section (shrink-0) */}
              <div className={`flex ${template.leftSignatoryEnabled && template.rightSignatoryEnabled !== false ? 'justify-between' : template.leftSignatoryEnabled ? 'justify-start' : 'justify-end'} items-end border-t border-slate-200 dark:border-slate-700/50 pt-1.5 md:pt-2 shrink-0`}>
                {/* Left Signatory */}
                {template.leftSignatoryEnabled && (
                  <div className="text-center font-sans max-w-[140px] md:max-w-[190px] shrink-0">
                    <div className="min-h-[28px] md:min-h-[38px] w-full flex items-end justify-center mb-0.5 relative">
                      {template.leftSignatureImage ? (
                        <div
                          onMouseDown={(e) => handleMouseDown(e, 'left')}
                          onTouchStart={(e) => handleTouchStart(e, 'left')}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          style={{
                            transform: `translate(${template.leftSignatureOffsetX || 0}px, ${template.leftSignatureOffsetY || 0}px) scale(${template.leftSignatureScale || 1})`,
                            transformOrigin: 'bottom center',
                            cursor: activeDragTarget === 'left' ? 'grabbing' : 'grab',
                            touchAction: 'none'
                          }}
                          className="relative transition-transform duration-75 select-none p-1 rounded border border-dashed border-primary/40 hover:border-primary group"
                          title="Drag to position left signature"
                        >
                          <img
                            src={template.leftSignatureImage}
                            alt="Left Signature"
                            className="h-7 md:h-9 max-w-[120px] md:max-w-[160px] object-contain pointer-events-none"
                          />
                          <div className="absolute -top-2 -right-2 size-4 bg-primary text-white rounded-full flex items-center justify-center text-[9px] shadow opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-[10px]">open_with</span>
                          </div>
                        </div>
                      ) : (
                        <span className={`font-serif italic text-xs md:text-sm ${selectedPreset.accentText} opacity-80 select-none`}>
                          {template.leftSignatoryName ? (template.leftSignatoryName.substring(0, 1) + '. ' + template.leftSignatoryName.split(' ').pop()) : ''}
                        </span>
                      )}
                    </div>
                    <div className="w-20 md:w-28 border-t border-slate-300 dark:border-slate-600 mx-auto"></div>
                    <h4 className="text-[9px] md:text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 select-none truncate">
                      {template.leftSignatoryName}
                    </h4>
                    <p className="text-[7px] md:text-[9px] text-slate-500 dark:text-slate-400 select-none uppercase tracking-wider truncate">
                      {template.leftSignatoryDesignation}
                    </p>
                    {template.leftSignatoryCompany && (
                      <p className="text-[7px] md:text-[9px] text-slate-500 dark:text-slate-400 font-medium select-none uppercase tracking-wider truncate mt-0.5">
                        {template.leftSignatoryCompany}
                      </p>
                    )}
                  </div>
                )}

                {/* Right Signatory */}
                {template.rightSignatoryEnabled !== false && (
                  <div className="text-center font-sans max-w-[140px] md:max-w-[190px] shrink-0">
                    <div className="min-h-[28px] md:min-h-[38px] w-full flex items-end justify-center mb-0.5 relative">
                      {template.signatureImage ? (
                        <div
                          onMouseDown={(e) => handleMouseDown(e, 'right')}
                          onTouchStart={(e) => handleTouchStart(e, 'right')}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          style={{
                            transform: `translate(${template.signatureOffsetX || 0}px, ${template.signatureOffsetY || 0}px) scale(${template.signatureScale || 1})`,
                            transformOrigin: 'bottom center',
                            cursor: activeDragTarget === 'right' ? 'grabbing' : 'grab',
                            touchAction: 'none'
                          }}
                          className="relative transition-transform duration-75 select-none p-1 rounded border border-dashed border-primary/40 hover:border-primary group"
                          title="Drag to position right signature"
                        >
                          <img
                            src={template.signatureImage}
                            alt="Right Signature"
                            className="h-7 md:h-9 max-w-[120px] md:max-w-[160px] object-contain pointer-events-none"
                          />
                          <div className="absolute -top-2 -right-2 size-4 bg-primary text-white rounded-full flex items-center justify-center text-[9px] shadow opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-[10px]">open_with</span>
                          </div>
                        </div>
                      ) : (
                        <span className={`font-serif italic text-xs md:text-sm ${selectedPreset.accentText} opacity-80 select-none`}>
                          {template.signatoryName ? (template.signatoryName.substring(0, 1) + '. ' + template.signatoryName.split(' ').pop()) : ''}
                        </span>
                      )}
                    </div>
                    <div className="w-20 md:w-28 border-t border-slate-300 dark:border-slate-600 mx-auto"></div>
                    <h4 className="text-[9px] md:text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 select-none truncate">
                      {template.signatoryName}
                    </h4>
                    <p className="text-[7px] md:text-[9px] text-slate-500 dark:text-slate-400 select-none uppercase tracking-wider truncate">
                      {template.signatoryDesignation}
                    </p>
                    {template.signatoryCompany && (
                      <p className="text-[7px] md:text-[9px] text-slate-500 dark:text-slate-400 font-medium select-none uppercase tracking-wider truncate mt-0.5">
                        {template.signatoryCompany}
                      </p>
                    )}
                  </div>
                )}
              </div>

            </div>

            <div className="bg-slate-100 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/40 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 font-sans">
              <p className="font-bold mb-1 flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined text-[14px]">info</span> Placeholders Guide & Touch Controls
              </p>
              Use the following codes in your certificate content to dynamically insert user and event data:
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li><code>{"{{name}}"}</code>: Replaced with the member's or guest's full name.</li>
                <li><code>{"{{event_title}}"}</code>: Replaced with the title of the event.</li>
                <li><code>{"{{date}}"}</code>: Replaced with the date of the event.</li>
                <li><code>{"{{location}}"}</code>: Replaced with the event location.</li>
              </ul>
            </div>

          </div>

        </main>
      )}

      <BottomNav />
    </div>
  )
}
