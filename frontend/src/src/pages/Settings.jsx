import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import BottomNav from '../components/BottomNav'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const navigate = useNavigate()
  const [customLogo, setCustomLogo] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#4F46E5')

  useEffect(() => {
    // Load saved settings from localStorage first
    const savedLogo = localStorage.getItem('customLogo')
    const savedColor = localStorage.getItem('primaryColor')
    if (savedLogo) setCustomLogo(savedLogo)
    if (savedColor) setPrimaryColor(savedColor)

    // Fallback: load logo from shared app settings
    loadSharedLogo()
  }, [])

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
    // Update CSS variable for primary color
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
            className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
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
                    className="text-red-500 hover:text-red-600 text-sm font-semibold"
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
                  className="w-full bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors text-left"
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
