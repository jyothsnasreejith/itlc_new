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
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-4 md:px-6 lg:px-8 pb-6 md:pb-8 pt-2 md:pt-3">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        {navItems.map((item) => {
          const isActive = item.match(location.pathname)
          return (
            <button
              key={item.key}
              onClick={() => handleNavigation(item.path)}
              className={`flex flex-col items-center gap-1 md:gap-1.5 transition-colors min-w-[60px] md:min-w-[80px] ${
                isActive
                  ? 'text-primary'
                  : 'text-slate-400 dark:text-slate-500 hover:text-primary'
              }`}
            >
              <span className={`material-symbols-outlined text-xl md:text-2xl ${isActive ? 'fill-icon' : ''}`}>
                {item.icon}
              </span>
              <p className="text-xs md:text-sm font-medium">{item.label}</p>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
