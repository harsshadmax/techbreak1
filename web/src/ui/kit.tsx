import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { awardLabel, awardTotal, baseEmoji, equippedVisuals } from '../lib/logic'
import { useRewardCatalog } from '../lib/hooks'
import type { Award, User } from '../lib/types'
import { Face, type FaceMood, type FaceShape } from './Face'
import { CoinIcon } from './Icons'

type Variant = 'primary' | 'outline' | 'ghost' | 'light'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink/85 disabled:bg-ink/40',
  light: 'bg-white text-ink hover:bg-white/80 disabled:text-ink/40',
  outline: 'border-[1.5px] border-ink text-ink hover:bg-ink/5 disabled:border-ink/30 disabled:text-ink/40',
  ghost: 'text-ink hover:bg-ink/5 disabled:text-ink/40',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  small?: boolean
  full?: boolean
}

export function Button({ variant = 'primary', small, full, className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors ${
        small ? 'min-h-10 px-4 text-sm' : 'min-h-[3.4rem] px-6 text-base'
      } ${full ? 'w-full' : ''} ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}

interface BentoProps {
  color: string
  title?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}

/** A rounded pastel tile in the bento grid. */
export function Bento({ color, title, icon, children, className = '' }: BentoProps) {
  return (
    <section className={`rounded-[1.625rem] p-4 ${className}`} style={{ background: color }}>
      {title && (
        <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold">
          {icon}
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

/** White rounded card. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[1.625rem] bg-paper p-4 ${className}`}>{children}</div>
}

interface FaceChipProps {
  label: string
  shape?: FaceShape
  mood?: FaceMood
  color: string
  selected?: boolean
  onClick?: () => void
}

/** Small rounded chip with a face, like the mood chips in the reference. */
export function FaceChip({ label, shape, mood, color, selected, onClick }: FaceChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 font-bold transition-colors ${
        selected ? 'bg-ink text-white' : 'bg-paper text-ink hover:bg-white/70'
      }`}
    >
      <Face shape={shape} mood={mood} color={color} size={34} />
      {label}
    </button>
  )
}

/** Coin plus amount; the number pops when it changes. */
export function Tokens({ amount, className = '' }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${className}`}>
      <CoinIcon className="h-[1.1em] w-[1.1em] text-[#E08A00]" />
      <span key={amount} className="animate-pop tabular-nums">
        {amount}
      </span>
    </span>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={`flex justify-center py-16 ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink/15 border-t-ink" />
    </div>
  )
}

export function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
      <Face mood="sleepy" color="#CDB8FF" size={72} />
      <p className="font-bold">{message}</p>
      <Button variant="outline" small onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <h1 className="font-display text-[2rem] leading-[1.05] font-extrabold">{children}</h1>
      {right}
    </header>
  )
}

export function TokenPill({ amount }: { amount: number }) {
  return (
    <div className="rounded-full bg-paper px-3.5 py-2 text-sm">
      <Tokens amount={amount} />
    </div>
  )
}

interface SheetProps {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
  tint?: string
}

/** Bottom sheet dialog. Escape and the backdrop close it; focus moves into it while open. */
export function Sheet({ open, onClose, label, children, tint = '#FFFFFF' }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="animate-rise w-full max-w-lg rounded-t-[2rem] p-6 pb-8 outline-none"
        style={{ background: tint }}
      >
        {children}
      </div>
    </div>
  )
}

export function AwardList({ awards }: { awards: Award[] }) {
  if (awards.length === 0) {
    return <p className="text-center text-sm">No tokens this time. Sessions need at least 10 minutes and few interruptions.</p>
  }
  return (
    <div>
      <div className="text-center font-display text-6xl font-extrabold">+{awardTotal(awards)}</div>
      <ul className="mt-3">
        {awards.map((a, i) => (
          <li key={i} className="flex justify-between border-t border-ink/15 py-2">
            <span>{awardLabel(a.reason)}</span>
            <span className="font-bold">+{a.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The user's fox with equipped hat, outfit and background. */
export function Avatar({ user, size = 48 }: { user: User; size?: number }) {
  const catalog = useRewardCatalog()
  const slugById = Object.fromEntries(catalog.map((r) => [r.id, r.slug]))
  const visuals = equippedVisuals(user.avatar.equipped, slugById)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${user.displayName}'s avatar`}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full bg-purple"
        style={{ fontSize: size * 0.55, background: visuals.background?.color }}
      >
        {baseEmoji(user.avatar.base)}
      </div>
      {visuals.hat?.emoji && (
        <span className="absolute left-1/2 -translate-x-1/2" style={{ top: -size * 0.22, fontSize: size * 0.5 }}>
          {visuals.hat.emoji}
        </span>
      )}
      {visuals.outfit?.emoji && (
        <span className="absolute -right-1 -bottom-1" style={{ fontSize: size * 0.38 }}>
          {visuals.outfit.emoji}
        </span>
      )}
    </div>
  )
}
