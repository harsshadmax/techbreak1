export type FaceShape = 'circle' | 'squircle' | 'bolt' | 'blob' | 'tri'
export type FaceMood = 'happy' | 'sleepy' | 'surprised' | 'angry' | 'wink' | 'calm'

export const FACE_SHAPES: FaceShape[] = ['circle', 'squircle', 'bolt', 'blob', 'tri']
export const FACE_MOODS: FaceMood[] = ['happy', 'sleepy', 'surprised', 'angry', 'wink', 'calm']

export const PALETTE = {
  ink: '#111111',
  orange: '#FFB38A',
  purple: '#CDB8FF',
  green: '#B9F5A3',
  yellow: '#FFE06B',
  pink: '#FF9EDB',
  blue: '#9CC4FF',
  coral: '#FF8B84',
}

const SHAPES: Record<FaceShape, string> = {
  circle: 'M50 0a50 50 0 1 0 0 100a50 50 0 1 0 0-100z',
  squircle: 'M30 0h40q30 0 30 30v40q0 30-30 30H30Q0 100 0 70V30Q0 0 30 0z',
  blob: 'M0 100Q0 15 50 15Q100 15 100 100z',
  tri: 'M50 5Q62 5 95 82Q100 95 85 95L15 95Q0 95 5 82Q38 5 50 5z',
  bolt: 'M55 0L10 58L42 58L30 100L92 38L58 38z',
}

/** Where the face sits on each shape; tapered shapes carry it lower. */
const CENTER_Y: Record<FaceShape, number> = { circle: 50, squircle: 50, bolt: 50, blob: 62, tri: 62 }

interface FaceProps {
  shape?: FaceShape
  mood?: FaceMood
  color?: string
  size?: number
  className?: string
}

/** A cartoon face on a coloured shape, used instead of icons for personality. Decorative. */
export function Face({ shape = 'circle', mood = 'happy', color = PALETTE.green, size = 56, className }: FaceProps) {
  const cy = CENTER_Y[shape]
  const ex = 17
  const ey = cy - 6
  const arc = (x: number, y: number, up: boolean) => `M${x - 8} ${y}A8 5 0 0 ${up ? 1 : 0} ${x + 8} ${y}`
  const smile = (y: number, w: number, h: number) => `M${50 - w / 2} ${y}A${w / 2} ${h} 0 0 0 ${50 + w / 2} ${y}`
  const frown = (y: number, w: number, h: number) => `M${50 - w / 2} ${y}A${w / 2} ${h} 0 0 1 ${50 + w / 2} ${y}`
  const L = 50 - ex
  const R = 50 + ex

  let features: React.ReactNode
  switch (mood) {
    case 'happy':
      features = (
        <>
          <path d={arc(L, ey, true)} />
          <path d={arc(R, ey, true)} />
          <path d={smile(cy + 8, 30, 10)} />
        </>
      )
      break
    case 'sleepy':
      features = (
        <>
          <path d={arc(L, ey, false)} />
          <path d={arc(R, ey, false)} />
          <path d={frown(cy + 16, 18, 5)} />
        </>
      )
      break
    case 'surprised':
      features = (
        <>
          <circle cx={L} cy={ey} r="3.5" fill={PALETTE.ink} stroke="none" />
          <circle cx={R} cy={ey} r="3.5" fill={PALETTE.ink} stroke="none" />
          <ellipse cx="50" cy={cy + 14} rx="6" ry="8" />
        </>
      )
      break
    case 'angry':
      features = (
        <>
          <path d={`M${L - 7} ${ey - 7}L${L + 7} ${ey - 2}M${R + 7} ${ey - 7}L${R - 7} ${ey - 2}`} />
          <circle cx={L} cy={ey + 3} r="3" fill={PALETTE.ink} stroke="none" />
          <circle cx={R} cy={ey + 3} r="3" fill={PALETTE.ink} stroke="none" />
          <path d={frown(cy + 20, 26, 7)} />
        </>
      )
      break
    case 'wink':
      features = (
        <>
          <path d={arc(L, ey, true)} />
          <circle cx={R} cy={ey} r="3.5" fill={PALETTE.ink} stroke="none" />
          <path d={smile(cy + 8, 30, 10)} />
        </>
      )
      break
    case 'calm':
      features = (
        <>
          <path d={arc(L, ey, false)} />
          <path d={arc(R, ey, false)} />
          <path d={smile(cy + 8, 24, 7)} />
        </>
      )
      break
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
      <path d={SHAPES[shape]} fill={color} />
      <g fill="none" stroke={PALETTE.ink} strokeWidth="4.5" strokeLinecap="round">
        {features}
      </g>
    </svg>
  )
}

/** Collage of colourful faces for the welcome screen. */
export function FaceCollage({ className }: { className?: string }) {
  const items: { x: number; y: number; s: number; shape: FaceShape; mood: FaceMood; color: string }[] = [
    { x: 10, y: 40, s: 130, shape: 'circle', mood: 'calm', color: PALETTE.green },
    { x: 150, y: 0, s: 140, shape: 'circle', mood: 'surprised', color: PALETTE.purple },
    { x: 290, y: 60, s: 120, shape: 'squircle', mood: 'angry', color: PALETTE.orange },
    { x: -20, y: 160, s: 120, shape: 'circle', mood: 'wink', color: PALETTE.pink },
    { x: 120, y: 130, s: 120, shape: 'bolt', mood: 'happy', color: PALETTE.yellow },
    { x: 40, y: 230, s: 130, shape: 'blob', mood: 'sleepy', color: PALETTE.blue },
    { x: 230, y: 210, s: 150, shape: 'tri', mood: 'surprised', color: PALETTE.coral },
  ]
  return (
    <div className={`relative mx-auto aspect-[400/330] w-full max-w-md overflow-hidden ${className ?? ''}`} aria-hidden="true">
      {items.map((it, i) => (
        <div key={i} className="absolute" style={{ left: `${(it.x / 400) * 100}%`, top: `${(it.y / 330) * 100}%`, width: `${(it.s / 400) * 100}%` }}>
          <Face shape={it.shape} mood={it.mood} color={it.color} size={100} className="h-auto w-full" />
        </div>
      ))}
    </div>
  )
}
