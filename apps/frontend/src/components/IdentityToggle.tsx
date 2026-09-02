import { useAuth } from '../context/AuthContext'
import { proleTag } from '../lib/format'

interface Props {
  anonymous: boolean
  onChange: (v: boolean) => void
  locked?: boolean
}

/** "Post as @username" ←→ "Post as Prole #XXXX" */
export default function IdentityToggle({ anonymous, onChange, locked = false }: Props) {
  const { user } = useAuth()
  if (!user) return null
  const prole = proleTag(user.prole_number)

  return (
    <div className="identity-box">
      <button
        type="button"
        className={`switch${anonymous ? ' is-on' : ''}`}
        onClick={() => !locked && onChange(!anonymous)}
        aria-pressed={anonymous}
        disabled={locked}
        style={locked ? { cursor: 'default' } : undefined}
      >
        <span className={`switch__label${!anonymous ? ' is-current' : ''}`}>@{user.username}</span>
        <span className="switch__track"><span className="switch__knob" /></span>
        <span className={`switch__label${anonymous ? ' is-current' : ''}`}>{prole}</span>
      </button>
      {anonymous ? (
        <div className="notice">Posting anonymously. Your identity is protected from other Proles.</div>
      ) : (
        <div className="help">Posting as @{user.username}. Switch to post as {prole}.</div>
      )}
    </div>
  )
}
