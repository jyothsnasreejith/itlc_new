import { useLocation, useNavigate } from 'react-router-dom'

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = [
    {
      path: '/',
      icon: 'dashboard',
      label: 'Dashboard',
      key: 'dashboard',
      match: (pathname) => pathname === '/'
    },
    {
      path: '/events',
      icon: 'calendar_today',
      label: 'Events',
      key: 'events',
      match: (pathname) => pathname === '/events' || pathname.includes('/event/')
    },
    {
      path: '/admin/membership-requests',
      icon: 'group',
      label: 'Members',
      key: 'members',
      match: (pathname) => pathname.includes('/membership-requests') || pathname.includes('/member/profile')
    },
    {
      path: '/admin/spin-wheel',
      icon: 'casino',
      label: 'Lucky Draw',
      key: 'spin-wheel',
      match: (pathname) => pathname.includes('/spin-wheel')
    },
    {
      path: '/settings',
      icon: 'settings',
      label: 'Settings',
      key: 'settings',
      match: (pathname) => pathname.includes('/settings')
    }
  ]

  const handleNavigation = (path) => {
    navigate(path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-2 sm:px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg">
      <div className="flex justify-around items-center max-w-md md:max-w-4xl mx-auto">
        {navItems.map((item) => {
          const isActive = item.match(location.pathname)
          return (
            <button
              key={item.key}
              onClick={() => handleNavigation(item.path)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[56px] ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className={`material-symbols-outlined text-2xl transition-transform ${isActive ? 'fill-icon scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[11px] leading-tight tracking-tight mt-0.5">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
