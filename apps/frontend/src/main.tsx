import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import './index.css'
import Navbar from './components/Navbar'
import Browse from './pages/Browse'
import PoliticianProfile from './pages/PoliticianProfile'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import Bookmarks from './pages/Bookmarks'
import Profile from './pages/Profile'
import MapPage from './pages/Map'
import Admin from './pages/Admin'
import NotificationBell from './components/NotificationBell'
import { useAuth } from './context/AuthContext'
import Verified from './pages/Verified'


const queryClient = new QueryClient()

function App() {
  const { user } = useAuth()
  const location = useLocation()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'

  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {user && (
          <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 500 }}>
            <NotificationBell />
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/politicians/:id" element={<PoliticianProfile />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/verified" element={<Verified />} />
        </Routes>
      </div>
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