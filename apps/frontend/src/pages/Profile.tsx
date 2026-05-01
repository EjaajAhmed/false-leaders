import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { changeUsername } from '../api/auth'
import { getGrafts } from '../api/politicians'

export default function Profile() {
  const { user, loginUser, logout } = useAuth()
  const navigate = useNavigate()
  const [newUsername, setNewUsername] = useState('')
  const [usernameSuccess, setUsernameSuccess] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [showUsernameForm, setShowUsernameForm] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const { data: grafts } = useQuery({
    queryKey: ['grafts'],
    queryFn: getGrafts,
    enabled: !!user
  })

  const usernameMutation = useMutation({
    mutationFn: changeUsername,
    onSuccess: (data) => {
      loginUser({ ...user!, username: data.username }, localStorage.getItem('token')!)
      setUsernameSuccess(true)
      setUsernameError('')
      setNewUsername('')
      setShowUsernameForm(false)
      setTimeout(() => setUsernameSuccess(false), 3000)
    },
    onError: (err: any) => {
      setUsernameError(err.response?.data?.error || 'Failed to update username')
    }
  })

  useEffect(() => {
    if (!user) navigate('/login')
  }, [user, navigate])

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '0 1rem' }}>

      <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '12px', marginBottom: '1.5rem' }}>
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</p>
        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem' }}>@{user.username}</h1>
        <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>{user.email}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>

        <Link to="/bookmarks" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', border: '1px solid #eee', borderRadius: '10px', cursor: 'pointer' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 500 }}>Bookmarks</p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: '#888' }}>
                {grafts?.length || 0} graft{grafts?.length !== 1 ? 's' : ''}
              </p>
            </div>
            <span style={{ color: '#ccc', fontSize: '1.2rem' }}>›</span>
          </div>
        </Link>

        <div
          onClick={() => setShowUsernameForm(!showUsernameForm)}
          style={{ padding: '1rem 1.25rem', border: '1px solid #eee', borderRadius: '10px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 500 }}>Change username</p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: '#888' }}>Currently @{user.username}</p>
            </div>
            <span style={{ color: '#ccc', fontSize: '1.2rem' }}>{showUsernameForm ? '˅' : '›'}</span>
          </div>

          {showUsernameForm && (
            <div style={{ marginTop: '1rem' }} onClick={e => e.stopPropagation()}>
              {usernameError && <p style={{ color: '#c0392b', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>{usernameError}</p>}
              {usernameSuccess && <p style={{ color: '#1e7e34', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>Username updated!</p>}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  placeholder="New username"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem' }}
                />
                <button
                  onClick={() => newUsername.trim() && usernameMutation.mutate(newUsername.trim())}
                  disabled={!newUsername.trim() || usernameMutation.isPending}
                  style={{ padding: '0.5rem 1rem', background: '#111', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  {usernameMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
        {!showLogoutConfirm ? (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{ padding: '0.6rem 1.25rem', border: '1px solid #eee', borderRadius: '8px', background: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '0.9rem' }}
          >
            Log out
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>Are you sure?</p>
            <button
              onClick={handleLogout}
              style={{ padding: '0.5rem 1rem', background: '#c0392b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Yes, log out
            </button>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              style={{ padding: '0.5rem 1rem', border: '1px solid #eee', background: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}