import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation, Navigate, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import './index.css'
import Navbar from './components/Navbar'
import NotificationBell from './components/NotificationBell'
import Home from './pages/Home'
import Browse from './pages/Browse'
import Leader from './pages/Leader'
import Feed from './pages/Feed'
import Leaderboard from './pages/Leaderboard'
import MapPage from './pages/Map'
import Bookmarks from './pages/Bookmarks'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import Forum from './pages/Forum'
import Thread from './pages/Thread'
import Login from './pages/Login'
import Register from './pages/Register'
import Verified from './pages/Verified'
import PendingVerification from './pages/PendingVerification'
import MobileAuthLanding from './pages/MobileAuthLanding'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

function PendingVerificationWrapper() {
  const location = useLocation()
  return <PendingVerification email={location.state?.email} />
}

function LegacyLeaderRedirect() {
  const { id } = useParams()
  return <Navigate to={`/leaders/${id}`} replace />
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }) }, [pathname])
  return null
}

function App() {
  const { user } = useAuth()
  const location = useLocation()
  const isAuthPage = ['/login', '/register', '/pending-verification', '/welcome'].includes(location.pathname)
    || location.pathname.startsWith('/verified')

  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pending-verification" element={<PendingVerificationWrapper />} />
        <Route path="/verified" element={<Verified />} />
        <Route path="/welcome" element={<MobileAuthLanding />} />
      </Routes>
    )
  }

  return (
    <div className="app-shell">
      <ScrollToTop />
      <Navbar />
      <div className="app-main">
        {user && (
          <div className="topbar">
            <NotificationBell />
          </div>
        )}
        {/* Keyed on pathname so every navigation replays the declassify transition */}
        <div key={location.pathname} className="declassify">
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/leaders/:id" element={<Leader />} />
            <Route path="/politicians/:id" element={<LegacyLeaderRedirect />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/forum" element={<Forum />} />
            <Route path="/forum/:id" element={<Thread />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="page page--narrow" style={{ paddingTop: '6rem' }}>
      <p className="eyebrow">404</p>
      <h1 style={{ fontSize: '2.5rem', margin: '0.5rem 0 1rem' }}>Nothing here.</h1>
      <p className="muted">Either it never existed, or it was removed.</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
