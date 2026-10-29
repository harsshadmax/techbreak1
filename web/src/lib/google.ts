/** Google Identity Services: loads Google's script on demand and hands back an ID token. */

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

interface CredentialResponse {
  credential: string
}

interface GoogleId {
  initialize: (config: { client_id: string; callback: (r: CredentialResponse) => void; ux_mode?: string }) => void
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

let loading: Promise<GoogleId> | null = null

export function loadGoogle(): Promise<GoogleId> {
  if (window.google) return Promise.resolve(window.google.accounts.id)
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error('Google script unavailable')))
    script.onerror = () => {
      loading = null
      reject(new Error('Could not load Google sign-in'))
    }
    document.head.appendChild(script)
  })
  return loading
}
