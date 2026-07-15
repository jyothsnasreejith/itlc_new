import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import { Editor } from '@tinymce/tinymce-react'

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [customLogo, setCustomLogo] = useState('')

  // Template Form Fields
  const [template, setTemplate] = useState({
    title: 'Certificate of Participation',
    headerText: 'IT Leaders Community Kerala',
    subTitle: 'This is proudly presented to',
    bodyText: 'This is proudly presented to {{name}} in recognition of their active participation in the event {{event_title}} held on {{date}} at {{location}}.',
    signatoryName: 'ITLC President',
    signatoryDesignation: 'IT Leaders Community',
    bgStyle: 'classic-gold',
    logos: []
  })


  useEffect(() => {
    // Load custom logo
    const savedLogo = localStorage.getItem('customLogo')
    if (savedLogo) {
      setCustomLogo(savedLogo)
    } else {
      supabase.from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'custom_logo')
        .maybeSingle()
        .then(({ data }) => {
          if (data?.setting_value) setCustomLogo(data.setting_value)
        })
    }

    fetchEvents()
    loadTemplate()
  }, [])

  async function fetchEvents() {
    try {
      setLoading(true)
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
      setLoading(false)
    }
  }

  async function loadTemplate() {
    try {
      const { data, error: err } = await supabase
        .from('app_settings')
        .select('*')
        .eq('setting_key', 'cert_template_global')
        .maybeSingle()

      if (err) throw err

      if (data && data.setting_value) {
        const parsed = JSON.parse(data.setting_value)
        setTemplate({
          title: parsed.title || 'Certificate of Participation',
          headerText: parsed.headerText || 'IT Leaders Community Kerala',
          subTitle: parsed.subTitle || 'This is proudly presented to',
          bodyText: parsed.bodyText || 'This is proudly presented to {{name}} in recognition of their active participation in the event {{event_title}} held on {{date}} at {{location}}.',
          signatoryName: parsed.signatoryName || 'ITLC President',
          signatoryDesignation: parsed.signatoryDesignation || 'IT Leaders Community',
          bgStyle: parsed.bgStyle || 'classic-gold',
          logos: parsed.logos || []
        })
      } else {
        // Reset to default
        setTemplate({
          title: 'Certificate of Participation',
          headerText: 'IT Leaders Community Kerala',
          subTitle: 'This is proudly presented to',
          bodyText: 'This is proudly presented to {{name}} in recognition of their active participation in the event {{event_title}} held on {{date}} at {{location}}.',
          signatoryName: 'ITLC President',
          signatoryDesignation: 'IT Leaders Community',
          bgStyle: 'classic-gold',
          logos: []
        })
      }
      setSuccess('')
      setError('')
    } catch (err) {
      console.error('Error loading template:', err)
      setError('Failed to load global certificate template.')
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { error: err } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'cert_template_global',
          setting_value: JSON.stringify(template),
          description: 'Global certificate template settings applied to all events'
        })

      if (err) throw err
      setSuccess('Certificate template saved successfully!')
    } catch (err) {
      console.error('Error saving template:', err)
      setError('Failed to save certificate template. ' + err.message)
    } finally {
      setSaving(false)
    }
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      <style>{`
        .tox-notifications-container, .tox-statusbar__branding {
          display: none !important;
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

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <p className="text-slate-500">Loading events...</p>
        </div>
      ) : (
        <main className="p-4 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Editor Column */}
          <div className="lg:col-span-5 space-y-6">
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
                          const file = e.target.files[0]
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
                          e.target.value = '' // Clear input
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

                 {/* Body Text */}
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
                        height: 250,
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

                {/* Signatory Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Signatory Name
                  </label>
                  <input
                    type="text"
                    value={template.signatoryName}
                    onChange={(e) => setTemplate({ ...template, signatoryName: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
                    placeholder="ITLC President"
                    required
                  />
                </div>

                {/* Signatory Designation */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Signatory Designation
                  </label>
                  <input
                    type="text"
                    value={template.signatoryDesignation}
                    onChange={(e) => setTemplate({ ...template, signatoryDesignation: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
                    placeholder="IT Leaders Community"
                    required
                  />
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
            <div className={`w-full aspect-[1.414/1] rounded-xl border-8 ${selectedPreset.borderClass} ${selectedPreset.bgClass} shadow-lg relative p-8 md:p-12 flex flex-col justify-between overflow-hidden border-double transition-all`}>
              
              {/* Corner Ornaments */}
              <div className={`absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 ${selectedPreset.borderClass}`}></div>
              <div className={`absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 ${selectedPreset.borderClass}`}></div>
              <div className={`absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 ${selectedPreset.borderClass}`}></div>
              <div className={`absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 ${selectedPreset.borderClass}`}></div>

              {/* Logo / Header */}
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center gap-4 mb-2 min-h-[48px]">
                  {template.logos && template.logos.length > 0 ? (
                    template.logos.map((logo, idx) => (
                      <img key={idx} src={logo} alt={`Logo ${idx+1}`} className="h-10 md:h-12 object-contain" />
                    ))
                  ) : (
                    customLogo ? (
                      <img src={customLogo} alt="Logo" className="h-10 md:h-12 object-contain" />
                    ) : (
                      <div className={`text-2xl font-bold ${selectedPreset.accentText}`}>ITLC</div>
                    )
                  )}
                </div>
                <h3 className={`text-[10px] md:text-xs font-semibold tracking-widest text-slate-400 uppercase font-sans select-none`}>
                  {template.headerText}
                </h3>
              </div>

              {/* Certificate Core Content */}
              <div className="text-center flex-1 flex flex-col justify-center my-4 md:my-6">
                <h2 className={`text-md md:text-2xl font-bold font-serif tracking-wide ${selectedPreset.accentText} uppercase`}>
                  {template.title}
                </h2>
                
                <p className="text-[10px] md:text-xs text-slate-400 italic font-serif mt-2 select-none">
                  {template.subTitle}
                </p>

                {/* Attendee Name */}
                <h1 className="text-lg md:text-3xl font-extrabold font-serif my-2 text-slate-800 dark:text-slate-100 italic select-none">
                  John Doe
                </h1>

                {/* Body Text Rendering */}
                <div 
                  className={`text-[10px] md:text-[13px] leading-relaxed max-w-xl mx-auto px-4 ${selectedPreset.primaryText} font-sans`}
                  dangerouslySetInnerHTML={{ __html: renderPreviewText(template.bodyText) }}
                />
              </div>

              {/* Signatories & Badges */}
              <div className="flex justify-between items-end border-t border-slate-200 dark:border-slate-700/50 pt-4">
                
                {/* Gold Seal / Ribbon */}
                <div className="flex items-center gap-2 select-none">
                  <div className={`size-10 md:size-12 rounded-full border-4 ${selectedPreset.borderClass} flex items-center justify-center relative shrink-0`}>
                    <div className={`absolute size-7 md:size-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 opacity-90 flex items-center justify-center text-[7px] font-bold text-white shadow-inner font-serif`}>
                      ITLC
                    </div>
                  </div>
                  <div className="text-left font-sans">
                    <p className="text-[8px] text-slate-400 uppercase tracking-widest font-semibold">Verification</p>
                    <p className="text-[9px] text-slate-600 dark:text-slate-300 font-bold font-mono">CERT-SAMPLE-QR</p>
                  </div>
                </div>

                {/* Signatory Section */}
                <div className="text-center font-sans max-w-[150px] md:max-w-[200px]">
                  <div className="h-6 w-full flex items-end justify-center mb-1">
                    {/* Simulated Signature */}
                    <span className={`font-serif italic text-sm ${selectedPreset.accentText} opacity-80 select-none`}>
                      {template.signatoryName.substring(0, 1) + '. ' + template.signatoryName.split(' ').pop()}
                    </span>
                  </div>
                  <div className="w-24 md:w-32 border-t border-slate-300 dark:border-slate-600 mx-auto"></div>
                  <h4 className="text-[10px] font-bold text-slate-800 dark:text-slate-200 mt-1 select-none truncate">
                    {template.signatoryName}
                  </h4>
                  <p className="text-[8px] text-slate-400 select-none uppercase tracking-wider truncate">
                    {template.signatoryDesignation}
                  </p>
                </div>

              </div>

            </div>

            <div className="bg-slate-100 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/40 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 font-sans">
              <p className="font-bold mb-1 flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined text-[14px]">info</span> Placeholders Guide
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
