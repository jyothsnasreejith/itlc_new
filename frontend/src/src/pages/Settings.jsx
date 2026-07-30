import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import BottomNav from '../components/BottomNav'
import { supabase } from '../lib/supabase'
import { eventService } from '../services/eventService'

export default function Settings() {
  const navigate = useNavigate()
  const [customLogo, setCustomLogo] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#4F46E5')

  // Event Poster Template Management States
  const [eventsList, setEventsList] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [posterPreview, setPosterPreview] = useState('')
  const [copiedPosterLink, setCopiedPosterLink] = useState(false)

  useEffect(() => {
    // Load saved settings from localStorage first
    const savedLogo = localStorage.getItem('customLogo')
    const savedColor = localStorage.getItem('primaryColor')
    if (savedLogo) setCustomLogo(savedLogo)
    if (savedColor) setPrimaryColor(savedColor)

    // Fallback: load logo from shared app settings
    loadSharedLogo()
    fetchEventsList()
  }, [])

  const fetchEventsList = async () => {
    try {
      const data = await eventService.getEvents()
      if (data && data.length > 0) {
        setEventsList(data)
        setSelectedEventId(String(data[0].id))
      }
    } catch (e) {
      console.error('Error fetching events in settings:', e)
      try {
        const { data } = await supabase.from('events').select('*')
        if (data && data.length > 0) {
          setEventsList(data)
          setSelectedEventId(String(data[0].id))
        }
      } catch (err) {
        console.error('Fallback fetch error:', err)
      }
    }
  }

  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEvent(null)
      setPosterPreview('')
      return
    }
    const evt = eventsList.find((e) => String(e.id) === String(selectedEventId))
    if (evt) {
      setSelectedEvent(evt)
      setPosterPreview(evt.poster_template || evt.image || '')
    }
  }, [selectedEventId, eventsList])

  const handlePosterUpload = (e) => {
    const file = e.target.files[0]
    if (!file || !selectedEventId) return
    const reader = new FileReader()
    reader.onloadend = async () => {
      const posterUrl = reader.result
      setPosterPreview(posterUrl)

      // Update local state
      setEventsList((prev) =>
        prev.map((ev) => (String(ev.id) === String(selectedEventId) ? { ...ev, poster_template: posterUrl } : ev))
      )

      // Save to Supabase events table
      try {
        const { error } = await supabase
          .from('events')
          .update({ poster_template: posterUrl })
          .eq('id', selectedEventId)

        if (error) {
          await supabase.from('events').update({ image: posterUrl }).eq('id', selectedEventId)
        }
      } catch (err) {
        console.error('Error saving poster template:', err)
      }
    }
    reader.readAsDataURL(file)
  }

  const copyPosterLink = () => {
    if (!selectedEventId) return
    const link = `${window.location.origin}/public/event/${selectedEventId}/poster`
    navigator.clipboard.writeText(link)
    setCopiedPosterLink(true)
    setTimeout(() => setCopiedPosterLink(false), 2500)
  }

  const loadSharedLogo = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'custom_logo')
        .maybeSingle()

      if (data?.setting_value && !localStorage.getItem('customLogo')) {
        setCustomLogo(data.setting_value)
        localStorage.setItem('customLogo', data.setting_value)
      }
    } catch (error) {
      console.error('Error loading shared logo:', error)
    }
  }

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const logoUrl = reader.result
        setCustomLogo(logoUrl)
        localStorage.setItem('customLogo', logoUrl)
        supabase
          .from('app_settings')
          .upsert(
            {
              setting_key: 'custom_logo',
              setting_value: String(logoUrl),
              description: 'Organization logo shown across public and admin pages',
            },
            { onConflict: 'setting_key' }
          )
          .then(({ error }) => {
            if (error) console.error('Error saving shared logo:', error)
          })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleColorChange = (color) => {
    setPrimaryColor(color)
    localStorage.setItem('primaryColor', color)
    document.documentElement.style.setProperty('--color-primary', color)
  }

  const removeLogo = () => {
    setCustomLogo('')
    localStorage.removeItem('customLogo')
    supabase
      .from('app_settings')
      .delete()
      .eq('setting_key', 'custom_logo')
      .then(({ error }) => {
        if (error) console.error('Error removing shared logo:', error)
      })
  }

  const settingsGroups = [
    {
      title: 'Admin',
      items: [
        {
          icon: 'add_circle',
          label: 'Create Event',
          description: 'Add a new event',
          path: '/admin/create-event',
          color: 'primary'
        },
        {
          icon: 'approval',
          label: 'Membership Requests',
          description: 'Review pending members',
          path: '/admin/membership-requests',
          color: 'blue'
        },
        {
          icon: 'supervisor_account',
          label: 'User Management',
          description: 'Manage admin & manager users',
          path: '/admin/users',
          color: 'red'
        },
        {
          icon: 'workspace_premium',
          label: 'Certificate Templates',
          description: 'Configure event certificate templates',
          path: '/admin/certificate-templates',
          color: 'amber'
        }
      ]
    },
    {
      title: 'Management',
      items: [
        {
          icon: 'calendar_view_month',
          label: 'All Events',
          description: 'View all events',
          path: '/events',
          color: 'purple'
        },
        {
          icon: 'person_add',
          label: 'Add Member',
          description: 'Register new member',
          path: '/membership-registration',
          color: 'green'
        }
      ]
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: 'dark_mode',
          label: 'Theme',
          description: 'Light / Dark mode',
          action: 'theme',
          color: 'slate'
        },
        {
          icon: 'notifications',
          label: 'Notifications',
          description: 'Manage notifications',
          action: 'notifications',
          color: 'amber'
        }
      ]
    }
  ]

  const handleItemClick = (item) => {
    if (item.path) {
      navigate(item.path)
    } else if (item.action === 'theme') {
      const html = document.documentElement
      if (html.classList.contains('dark')) {
        html.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      } else {
        html.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your preferences</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">close</span>
          </button>
        </div>
      </header>

      <main className="p-4 space-y-8">
        {/* Customization Section */}
        <section>
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 px-2">
            Customization
          </h2>
          <div className="space-y-4">
            {/* Logo Upload */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-4 mb-4">
                <div className="size-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-purple-500 text-2xl">
                    image
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white">Custom Logo</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Upload your organization logo</p>
                </div>
              </div>
              
              {customLogo && (
                <div className="mb-4 flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <img src={customLogo} alt="Custom Logo" className="h-12 w-12 object-contain rounded" />
                  <span className="text-sm text-slate-600 dark:text-slate-400 flex-1">Current logo</span>
                  <button
                    onClick={removeLogo}
                    className="text-red-500 hover:text-red-600 text-sm font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}

              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <div className="cursor-pointer bg-primary hover:bg-primary/90 text-white text-center py-2.5 px-4 rounded-lg font-semibold transition-colors text-sm">
                  {customLogo ? 'Change Logo' : 'Upload Logo'}
                </div>
              </label>
            </div>

            {/* Event Poster Template Management */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-indigo-500 text-2xl">style</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white">Event "I Am Attending" Poster Template</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Upload custom PNG poster templates & copy shareable delegate poster links
                  </p>
                </div>
              </div>

              {/* Select Event Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Select Event
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg p-2.5 focus:outline-none focus:border-primary font-semibold cursor-pointer"
                >
                  <option value="">-- Choose an Event --</option>
                  {eventsList.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.title} ({evt.date})
                    </option>
                  ))}
                </select>
              </div>

              {selectedEvent && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                  {/* Current Poster Preview */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Current Poster Template Frame</span>
                    <div className="h-44 w-full bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2 relative overflow-hidden">
                      {posterPreview ? (
                        <img src={posterPreview} alt="Poster Template" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <p className="text-xs text-slate-400 text-center px-4">No custom template uploaded yet. Upload a PNG frame template below.</p>
                      )}
                    </div>
                  </div>

                  {/* Upload Poster Template Input */}
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePosterUpload}
                      className="hidden"
                    />
                    <div className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white text-center py-2.5 px-4 rounded-lg font-semibold transition-colors text-sm flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-base">cloud_upload</span>
                      <span>{posterPreview ? 'Change Poster PNG Template' : 'Upload Poster PNG Template'}</span>
                    </div>
                  </label>

                  {/* Shareable Public Link & Action Buttons */}
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">Public Poster Creator Share Link</span>
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/public/event/${selectedEvent.id}/poster`}
                        className="flex-1 bg-white dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md p-2.5 select-all focus:outline-none min-w-0"
                      />
                      <button
                        onClick={copyPosterLink}
                        className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">{copiedPosterLink ? 'check' : 'content_copy'}</span>
                        <span>{copiedPosterLink ? 'Copied!' : 'Copy Link'}</span>
                      </button>
                      <button
                        onClick={() => window.open(`/public/event/${selectedEvent.id}/poster`, '_blank')}
                        className="px-3.5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-white text-xs font-bold rounded-md transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                        title="Preview Generator in New Tab"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        <span>Open</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Color Theme */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-4 mb-4">
                <div className="size-12 rounded-xl bg-pink-500/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-pink-500 text-2xl">
                    palette
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white">Primary Color</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Choose your brand color</p>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {[
                  { color: '#4F46E5', name: 'Indigo' },
                  { color: '#7C3AED', name: 'Purple' },
                  { color: '#DC2626', name: 'Red' },
                  { color: '#059669', name: 'Green' },
                  { color: '#EA580C', name: 'Orange' },
                  { color: '#0891B2', name: 'Cyan' },
                  { color: '#2563EB', name: 'Blue' },
                  { color: '#DB2777', name: 'Pink' },
                  { color: '#65A30D', name: 'Lime' },
                  { color: '#0F172A', name: 'Slate' }
                ].map((item) => (
                  <button
                    key={item.color}
                    onClick={() => handleColorChange(item.color)}
                    className={`aspect-square rounded-xl border-4 transition-all hover:scale-110 ${
                      primaryColor === item.color 
                        ? 'border-slate-900 dark:border-white scale-110' 
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                    style={{ backgroundColor: item.color }}
                    title={item.name}
                  />
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Current color:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded border border-slate-300 dark:border-slate-600" style={{ backgroundColor: primaryColor }}></div>
                    <span className="text-slate-900 dark:text-white font-mono font-semibold">{primaryColor}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {settingsGroups.map((group, groupIndex) => (
          <section key={groupIndex}>
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 px-2">
              {group.title}
            </h2>
            <div className="space-y-2">
              {group.items.map((item, itemIndex) => (
                <button
                  key={itemIndex}
                  onClick={() => handleItemClick(item)}
                  className="w-full bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className={`size-12 rounded-xl bg-${item.color}-500/10 flex items-center justify-center shrink-0`}>
                      <span className={`material-symbols-outlined text-${item.color}-500 text-2xl`}>
                        {item.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white">{item.label}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-400">
                      chevron_right
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}

        {/* App Info */}
        <section className="pt-8">
          <div className="text-center space-y-2">
            <div className="inline-block bg-primary/10 dark:bg-primary/20 rounded-full p-3 mb-2">
              <span className="material-symbols-outlined text-primary text-3xl">event</span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">IT Leaders Event Registration</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Version 1.0.0</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">© 2026 IT Leaders Community</p>
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
