import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// Public Lightweight Pages
const OnamEventRegistration = lazy(() => import('./pages/OnamEventRegistration'))
const EventDetailsRegistration = lazy(() => import('./pages/EventDetailsRegistration'))
const EventAttendingPoster = lazy(() => import('./pages/EventAttendingPoster'))
const UnifiedEventRegistration = lazy(() => import('./pages/UnifiedEventRegistration'))
const EventRegistrationConfirmation = lazy(() => import('./pages/EventRegistrationConfirmation'))
const SubmissionThanks = lazy(() => import('./pages/SubmissionThanks'))
const EventSelfCheckIn = lazy(() => import('./pages/EventSelfCheckIn'))

// Admin/Manager Pages (Lazy loaded)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MembershipRegistrationForm = lazy(() => import('./pages/MembershipRegistrationForm'))
const EventsList = lazy(() => import('./pages/EventsList'))
const AdminCreateNewEvent = lazy(() => import('./pages/AdminCreateNewEvent'))
const AdminEditEvent = lazy(() => import('./pages/AdminEditEvent'))
const AdminEventRegistrations = lazy(() => import('./pages/AdminEventRegistrations'))
const AdminMembershipRequests = lazy(() => import('./pages/AdminMembershipRequests'))
const DigitalMemberIdCard = lazy(() => import('./pages/DigitalMemberIdCard'))
const EventAttendanceScanner = lazy(() => import('./pages/EventAttendanceScanner'))
const AdminEventCheckInQR = lazy(() => import('./pages/AdminEventCheckInQR'))
const AdminEventAttendance = lazy(() => import('./pages/AdminEventAttendance'))
const MemberProfileActivityLog = lazy(() => import('./pages/MemberProfileActivityLog'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))
const EventManagerDashboard = lazy(() => import('./pages/EventManagerDashboard'))
const AdminCertificateTemplates = lazy(() => import('./pages/AdminCertificateTemplates'))
const EventManagerAttendance = lazy(() => import('./pages/EventManagerAttendance'))
const PublicProfileUpdate = lazy(() => import('./pages/PublicProfileUpdate'))
const AdminUserManagement = lazy(() => import('./pages/AdminUserManagement'))
const AdminSpinWheel = lazy(() => import('./pages/AdminSpinWheel'))
const AdminSpinWheelFullscreen = lazy(() => import('./pages/AdminSpinWheelFullscreen'))

function RootRedirect() {
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const isLoggedIn = !!user
  
  if (isLoggedIn) {
    if (user?.role === 'event_manager') {
      return <Navigate to="/manager/dashboard" replace />
    }
    return <Navigate to="/admin/dashboard" replace />
  }
  
  return <Login />
}

function AdminProtectedRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const isAdmin = user?.role === 'admin'

  if (!isAdmin) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid #cbd5e1', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    }>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<RootRedirect />} />

        {/* Public event registration/invite flow & poster routes */}
        <Route path="/onam-registration" element={<OnamEventRegistration />} />
        <Route path="/public/onam-registration" element={<OnamEventRegistration />} />
        <Route path="/event/:id" element={<EventDetailsRegistration />} />
        <Route path="/public/event/:id" element={<EventDetailsRegistration />} />
        <Route path="/event/:id/poster" element={<EventAttendingPoster />} />
        <Route path="/public/event/:id/poster" element={<EventAttendingPoster />} />
        <Route path="/unified-event-registration/:eventId" element={<UnifiedEventRegistration />} />
        <Route path="/event-registration/:eventId" element={<EventRegistrationConfirmation />} />
        <Route path="/thanks" element={<SubmissionThanks />} />
        <Route path="/attend/:eventId" element={<EventSelfCheckIn />} />
        
        {/* Admin-only routes */}
        <Route path="/events" element={<AdminProtectedRoute><EventsList /></AdminProtectedRoute>} />
        <Route path="/membership-registration" element={<AdminProtectedRoute><MembershipRegistrationForm /></AdminProtectedRoute>} />
        <Route path="/public/membership" element={<MembershipRegistrationForm />} />
        <Route path="/public/profile-update" element={<PublicProfileUpdate />} />
        <Route path="/update-profile" element={<AdminProtectedRoute><PublicProfileUpdate /></AdminProtectedRoute>} />
        <Route path="/admin/dashboard" element={<AdminProtectedRoute><Dashboard /></AdminProtectedRoute>} />
        <Route path="/admin/create-event" element={<AdminProtectedRoute><AdminCreateNewEvent /></AdminProtectedRoute>} />
        <Route path="/admin/edit-event/:id" element={<AdminProtectedRoute><AdminEditEvent /></AdminProtectedRoute>} />
        <Route path="/admin/event-registrations/:id" element={<AdminProtectedRoute><AdminEventRegistrations /></AdminProtectedRoute>} />
        <Route path="/admin/membership-requests" element={<AdminProtectedRoute><AdminMembershipRequests /></AdminProtectedRoute>} />
        <Route path="/admin/users" element={<AdminProtectedRoute><AdminUserManagement /></AdminProtectedRoute>} />
        <Route path="/admin/spin-wheel" element={<AdminProtectedRoute><AdminSpinWheel /></AdminProtectedRoute>} />
        <Route path="/admin/spin-wheel/fullscreen" element={<AdminProtectedRoute><AdminSpinWheelFullscreen /></AdminProtectedRoute>} />
        <Route path="/manager/dashboard" element={<AdminProtectedRoute><EventManagerDashboard /></AdminProtectedRoute>} />
        <Route path="/manager/attendance/:eventId" element={<AdminProtectedRoute><EventManagerAttendance /></AdminProtectedRoute>} />
        <Route path="/member/id-card" element={<AdminProtectedRoute><DigitalMemberIdCard /></AdminProtectedRoute>} />
        <Route path="/scanner/:eventId" element={<AdminProtectedRoute><EventAttendanceScanner /></AdminProtectedRoute>} />
        <Route path="/admin/event-checkin-qr/:id" element={<AdminProtectedRoute><AdminEventCheckInQR /></AdminProtectedRoute>} />
        <Route path="/admin/event-attendance/:id" element={<AdminProtectedRoute><AdminEventAttendance /></AdminProtectedRoute>} />
        <Route path="/member/profile/:id" element={<AdminProtectedRoute><MemberProfileActivityLog /></AdminProtectedRoute>} />
        <Route path="/member/:id" element={<AdminProtectedRoute><MemberProfileActivityLog /></AdminProtectedRoute>} />
        <Route path="/settings" element={<AdminProtectedRoute><Settings /></AdminProtectedRoute>} />
        <Route path="/admin/certificate-templates" element={<AdminProtectedRoute><AdminCertificateTemplates /></AdminProtectedRoute>} />
      </Routes>
    </Suspense>
  )
}

export default App
