import { useState, type FormEvent } from 'react'
import { errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { FaceCollage } from '../ui/Face'
import { GoogleButton } from '../ui/GoogleButton'
import { Button } from '../ui/kit'

const FIELD = 'w-full rounded-2xl bg-lavender px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-ink placeholder:text-muted'

export function LoginPage() {
  const { login, register, loginWithGoogle } = useAuth()
  const [registering, setRegistering] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function validate() {
    const next: Record<string, string> = {}
    if (registering && !name.trim()) next.name = 'Enter a name'
    if (!email.includes('@')) next.email = 'Enter a valid email'
    if (password.length < 8) next.password = 'At least 8 characters'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setBusy(true)
    setServerError(null)
    try {
      if (registering) await register(email.trim(), password, name.trim())
      else await login(email.trim(), password)
    } catch (err) {
      setServerError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function signInWithGoogle(idToken: string) {
    setBusy(true)
    setServerError(null)
    try {
      await loginWithGoogle(idToken)
    } catch (err) {
      setServerError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-8">
      <h1 className="text-center font-display text-[2.4rem] leading-[1.05] font-extrabold">
        {registering ? 'Make it yours' : 'Ready to put the phone down?'}
      </h1>
      <p className="mt-3 text-center text-sm">Earn tokens for focus and mindful breaks, then spend them on your favourite apps.</p>

      <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-3 rounded-[1.9rem] bg-paper p-4.5">
        {registering && (
          <Field label="Display name" error={errors.name}>
            <input className={FIELD} placeholder="Display name" aria-label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        )}
        <Field label="Email" error={errors.email}>
          <input
            className={FIELD}
            type="email"
            placeholder="Email"
            aria-label="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" error={errors.password}>
          <input
            className={FIELD}
            type="password"
            placeholder="Password"
            aria-label="Password"
            autoComplete={registering ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {serverError && (
          <p role="alert" className="text-sm font-bold text-red-700">
            {serverError}
          </p>
        )}
        <Button type="submit" full disabled={busy}>
          {busy ? 'One moment…' : registering ? 'Create account' : 'Sign in'}
        </Button>
        <Button variant="ghost" small full disabled={busy} onClick={() => setRegistering((r) => !r)}>
          {registering ? 'Have an account? Sign in' : 'New here? Create an account'}
        </Button>
        <div className="flex items-center gap-3 text-xs font-bold text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-ink/15" />
          or
          <span className="h-px flex-1 bg-ink/15" />
        </div>
        <GoogleButton disabled={busy} onError={setServerError} onToken={signInWithGoogle} />
      </form>

      <FaceCollage className="mt-4" />
    </main>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      {children}
      {error && (
        <span role="alert" className="mt-1 block px-2 text-sm font-bold text-red-700">
          {error}
        </span>
      )}
    </label>
  )
}
