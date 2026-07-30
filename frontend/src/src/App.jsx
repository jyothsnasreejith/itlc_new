import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import MembershipRegistrationForm from './pages/MembershipRegistrationForm'
import EventsList from './pages/EventsList'
import EventDetailsRegistration from './pages/EventDetailsRegistration'
import EventRegistrationConfirmation from './pages/EventRegistrationConfirmation'
import UnifiedEventRegistration from './pages/UnifiedEventRegistration'
import AdminCreateNewEvent from './pages/AdminCreateNewEvent'
import AdminEditEvent from './pages/AdminEditEvent'
import AdminEventRegistrations from './pages/AdminEventRegistrations'
import AdminMembershipRequests from './pages/AdminMembershipRequests'
import DigitalMemberIdCard from './pages/DigitalMemberIdCard'
import EventAttendanceScanner from './pages/EventAttendanceScanner'
import EventSelfCheckIn from './pages/EventSelfCheckIn'
import AdminEventCheckInQR from './pages/AdminEventCheckInQR'
import AdminEventAttendance from './pages/AdminEventAttendance'
import MemberProfileActivityLog from './pages/MemberProfileActivityLog'
import Settings from './pages/Settings'
import Login from './pages/Login'
import EventManagerDashboard from './pages/EventManagerDashboard'
import AdminCertificateTemplates from './pages/AdminCertificateTemplates'
import EventManagerAttendance from './pages/EventManagerAttendance'
import PublicProfileUpdate from './pages/PublicProfileUpdate'
import AdminUserManagement from './pages/AdminUserManagement'
import SubmissionThanks from './pages/SubmissionThanks'
import AdminSpinWheel from './pages/AdminSpinWheel'
import AdminSpinWheelFullscreen from './pages/AdminSpinWheelFullscreen'
import EventAttendingPoster from './pages/EventAttendingPoster'

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
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<RootRedirect />} />

      {/* Public event registration/invite flow & poster routes */}
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
  )
}

export default App
