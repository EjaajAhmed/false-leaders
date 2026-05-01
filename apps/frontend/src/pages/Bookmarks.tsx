import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { getBookmarks, getGrafts, createGraft, deleteGraft, moveBookmark, removeBookmark } from '../api/politicians'
import { useAuth } from '../context/AuthContext'

export default function Bookmarks() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedGraft, setSelectedGraft] = useState<string | 'all' | 'unsorted'>('all')
  const [newGraftName, setNewGraftName] = useState('')
  const [newGraftDesc, setNewGraftDesc] = useState('')
  const [showNewGraft, setShowNewGraft] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverGraft, setDragOverGraft] = useState<string | null>(null)

  const { data: bookmarks } = useQuery({ queryKey: ['bookmarks'], queryFn: getBookmarks, enabled: !!user })
  const { data: grafts } = useQuery({ queryKey: ['grafts'], queryFn: getGrafts, enabled: !!user })

  const createGraftMutation = useMutation({
    mutationFn: createGraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grafts'] })
      setNewGraftName('')
      setNewGraftDesc('')
      setShowNewGraft(false)
    }
  })

  const deleteGraftMutation = useMutation({
    mutationFn: deleteGraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grafts'] })
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
      setSelectedGraft('all')
    }
  })

  const moveMutation = useMutation({
    mutationFn: moveBookmark,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
      queryClient.invalidateQueries({ queryKey: ['grafts'] })
    }
  })

  const removeMutation = useMutation({
    mutationFn: removeBookmark,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
  })

  useEffect(() => {
    if (!user) navigate('/login')
  }, [user, navigate])

  if (!user) return null

  const handleDragStart = (e: React.DragEvent, bookmarkId: string) => {
    setDraggingId(bookmarkId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, graftId: string | null) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverGraft(graftId ?? 'unsorted')
  }

  const handleDrop = (e: React.DragEvent, graftId: string | null) => {
    e.preventDefault()
    if (draggingId) moveMutation.mutate({ id: draggingId, graft_id: graftId })
    setDraggingId(null)
    setDragOverGraft(null)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverGraft(null)
  }

  const allBookmarks = bookmarks || []
  const unsorted = allBookmarks.filter((b: any) => !b.graft_id)
  const inGraft = (graftId: string) => allBookmarks.filter((b: any) => b.graft_id === graftId)

  const displayedBookmarks = selectedGraft === 'all'
    ? allBookmarks
    : selectedGraft === 'unsorted'
    ? unsorted
    : inGraft(selectedGraft)

  const graftDropStyle = (graftId: string | null) => ({
    transition: 'all 0.15s',
    background: dragOverGraft === (graftId ?? 'unsorted') ? 'rgba(201,168,76,0.08)' : 'none',
    borderRadius: '8px'
  })

  return (
    <div style={{ maxWidth: '960px', margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ margin: '0 0 0.25rem' }}>Bookmarks</h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Drag politicians into grafts to organise them.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '2rem' }}>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>Grafts</p>
            <button
              onClick={() => setShowNewGraft(!showNewGraft)}
              style={{ fontSize: '0.8rem', border: 'none', background: 'none', cursor: 'pointer', color: '#555' }}
            >
              + New
            </button>
          </div>

          {showNewGraft && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid #eee', borderRadius: '8px' }}>
              <input
                placeholder="Graft name"
                value={newGraftName}
                onChange={e => setNewGraftName(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '0.5rem', boxSizing: 'border-box', fontSize: '0.85rem' }}
              />
              <input
                placeholder="Description (optional)"
                value={newGraftDesc}
                onChange={e => setNewGraftDesc(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '0.5rem', boxSizing: 'border-box', fontSize: '0.85rem' }}
              />
              <button
                onClick={() => createGraftMutation.mutate({ name: newGraftName, description: newGraftDesc })}
                disabled={!newGraftName.trim()}
                style={{ width: '100%', padding: '0.4rem', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Create
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <button
              onClick={() => setSelectedGraft('all')}
              style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '6px', border: 'none', background: selectedGraft === 'all' ? '#f3f3f3' : 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: selectedGraft === 'all' ? 500 : 400 }}
            >
              All saved ({allBookmarks.length})
            </button>

            <div
              style={graftDropStyle(null)}
              onDragOver={e => handleDragOver(e, null)}
              onDrop={e => handleDrop(e, null)}
              onDragLeave={() => setDragOverGraft(null)}
            >
              <button
                onClick={() => setSelectedGraft('unsorted')}
                style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '6px', border: 'none', background: selectedGraft === 'unsorted' ? '#f3f3f3' : 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: selectedGraft === 'unsorted' ? 500 : 400 }}
              >
                Unsorted ({unsorted.length})
              </button>
            </div>

            {grafts?.map((g: any) => (
              <div
                key={g.id}
                style={graftDropStyle(g.id)}
                onDragOver={e => handleDragOver(e, g.id)}
                onDrop={e => handleDrop(e, g.id)}
                onDragLeave={() => setDragOverGraft(null)}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={() => setSelectedGraft(g.id)}
                    style={{ flex: 1, textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '6px', border: 'none', background: selectedGraft === g.id ? '#f3f3f3' : 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: selectedGraft === g.id ? 500 : 400 }}
                  >
                    {g.name}
                    <span style={{ color: '#aaa', fontSize: '0.8rem', marginLeft: '0.4rem' }}>
                      {inGraft(g.id).length}
                    </span>
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${g.name}"?`)) deleteGraftMutation.mutate(g.id) }}
                    style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: '0.75rem', color: '#bbb', marginTop: '1rem', lineHeight: '1.5' }}>
            Drag a politician card onto a graft to move it there.
          </p>
        </div>

        <div>
          {selectedGraft !== 'all' && selectedGraft !== 'unsorted' && grafts && (
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem' }}>
                {grafts.find((g: any) => g.id === selectedGraft)?.name}
              </h2>
              <p style={{ margin: 0, color: '#888', fontSize: '0.85rem' }}>
                {grafts.find((g: any) => g.id === selectedGraft)?.description}
              </p>
            </div>
          )}

          {displayedBookmarks.length === 0 && (
            <div style={{ padding: '2rem', border: '2px dashed #eee', borderRadius: '10px', textAlign: 'center', color: '#aaa' }}>
              {selectedGraft === 'unsorted' ? 'No unsorted politicians.' : 'Nothing here yet.'}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {displayedBookmarks.map((b: any) => (
              <div
                key={b.id}
                draggable
                onDragStart={e => handleDragStart(e, b.id)}
                onDragEnd={handleDragEnd}
                style={{
                  padding: '0.875rem 1rem',
                  border: '1px solid #eee',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'grab',
                  opacity: draggingId === b.id ? 0.4 : 1,
                  transition: 'opacity 0.15s',
                  background: 'white'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  <span style={{ color: '#ccc', fontSize: '1rem', flexShrink: 0 }}>⠿</span>
                  <div style={{ minWidth: 0 }}>
                    <Link to={`/politicians/${b.politician_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <p style={{ margin: 0, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</p>
                    </Link>
                    <p style={{ margin: '0.1rem 0 0', color: '#888', fontSize: '0.8rem' }}>
                      {b.party} — {b.region}
                      {b.graft_name && <span style={{ marginLeft: '0.5rem', color: '#bbb' }}>· {b.graft_name}</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeMutation.mutate(b.id)}
                  style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: '1rem', flexShrink: 0, marginLeft: '0.5rem' }}
                  title="Remove bookmark"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}