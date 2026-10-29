import { useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID, loadGoogle } from '../lib/google'

interface Props {
  onToken: (idToken: string) => void
  onError: (message: string) => void
  disabled?: boolean
}

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
)

/**
 * "Continue with Google". When a client ID is configured this renders Google's own button;
 * otherwise it shows the same option and explains that sign-in isn't set up yet.
 */
export function GoogleButton({ onToken, onError, disabled }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const callbacks = useRef({ onToken, onError })
  callbacks.current = { onToken, onError }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let live = true
    loadGoogle()
      .then((google) => {
        if (!live || !host.current) return
        google.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => callbacks.current.onToken(r.credential) })
        google.renderButton(host.current, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: host.current.offsetWidth || 320 })
        setReady(true)
      })
      .catch((e: Error) => live && callbacks.current.onError(e.message))
    return () => {
      live = false
    }
  }, [])

  if (!GOOGLE_CLIENT_ID) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onError('Google sign-in is not set up yet. Ask the app owner to add a Google client ID.')}
        className="flex min-h-[3.4rem] w-full items-center justify-center gap-3 rounded-full border-[1.5px] border-ink bg-paper px-4 font-bold whitespace-nowrap hover:bg-mist"
      >
        <GoogleG /> Continue with Google
      </button>
    )
  }

  return (
    <div className={`relative min-h-[3.4rem] w-full ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <div ref={host} className="flex w-full justify-center" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-full border-[1.5px] border-ink/30 bg-paper font-bold text-ink/50">
          <GoogleG /> Continue with Google
        </div>
      )}
    </div>
  )
}
