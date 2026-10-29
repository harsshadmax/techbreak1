import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/hooks'
import { awardLabel, focusMinutesByDay, monthCells, type CalendarCell, type DayMinutes } from '../lib/logic'
import type { SessionRec, TokenTx } from '../lib/types'
import { Face, PALETTE } from '../ui/Face'
import { ChevronLeftIcon } from '../ui/Icons'
import { Bento, Button, Card, ErrorRetry, Spinner, Tokens } from '../ui/kit'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface TxPage {
  items: TokenTx[]
  nextCursor: string | null
}

export function InsightsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const data = useFetch(async () => {
    const from = new Date(Date.now() - 40 * 86400000).toISOString()
    const [sessions, tx] = await Promise.all([
      api.get<{ items: SessionRec[] }>('/sessions', { from, limit: 200 }),
      api.get<TxPage>('/tokens/transactions', { limit: 30 }),
    ])
    return { sessions: sessions.items, tx }
  })
  const [history, setHistory] = useState<TokenTx[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  useEffect(() => {
    if (!data.data) return
    setHistory(data.data.tx.items)
    setCursor(data.data.tx.nextCursor)
  }, [data.data])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await api.get<TxPage>('/tokens/transactions', { before: cursor, limit: 30 })
      setHistory((h) => [...h, ...page.items])
      setCursor(page.nextCursor)
    } catch (e) {
      setMoreError(errorMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/profile'))

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-5">
      <header className="mb-4 flex items-center gap-2">
        <button type="button" aria-label="Back" onClick={back} className="rounded-full p-2 hover:bg-ink/5">
          <ChevronLeftIcon />
        </button>
        <h1 className="font-display text-3xl font-extrabold">Insights</h1>
      </header>

      {data.loading ? (
        <Spinner />
      ) : data.error || !data.data ? (
        <ErrorRetry message={data.error ?? 'Something went wrong'} onRetry={data.reload} />
      ) : (
        <Content sessions={data.data.sessions} goalMin={user?.settings.dailyFocusGoalMin ?? 0}>
          <section aria-labelledby="history" className="mt-6">
            <h2 id="history" className="mb-2 font-display text-xl font-bold">
              Token history
            </h2>
            {history.length === 0 ? (
              <p className="py-6 text-center">No tokens earned yet. Start a focus session!</p>
            ) : (
              <ul className="divide-y divide-ink/10 rounded-[1.625rem] bg-paper px-4">
                {history.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-3">
                    <span>
                      <span className="block font-bold">{awardLabel(t.reason)}</span>
                      <span className="text-xs text-muted">{new Date(t.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </span>
                    <span className={`font-display text-lg font-extrabold ${t.amount < 0 ? 'text-red-700' : ''}`}>
                      {t.amount > 0 ? '+' : ''}
                      {t.amount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {moreError && (
              <p role="alert" className="mt-2 text-center text-sm font-bold">
                {moreError}
              </p>
            )}
            {cursor && (
              <div className="mt-3 flex justify-center">
                <Button variant="outline" small disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </section>
        </Content>
      )}
    </main>
  )
}

function Content({ sessions, goalMin, children }: { sessions: SessionRec[]; goalMin: number; children: React.ReactNode }) {
  const now = new Date()
  const week = sessions.filter((s) => new Date(s.startedAt).getTime() > Date.now() - 7 * 86400000)
  const focus = week.filter((s) => s.type === 'focus' && s.status === 'completed')
  const minutes = focus.reduce((n, s) => n + s.actualMin, 0)
  const tokens = week.reduce((n, s) => n + s.tokensAwarded, 0)
  const cells = monthCells(now, sessions, now, goalMin)
  return (
    <>
      <Calendar cells={cells} month={now} />
      <h2 className="mt-6 mb-3 font-display text-xl font-bold">Focus minutes, last 7 days</h2>
      <WeekChart days={focusMinutesByDay(sessions, now)} />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Minutes" value={String(minutes)} />
        <Stat label="Sessions" value={String(focus.length)} />
        <Stat label="Tokens" value={<Tokens amount={tokens} />} />
      </div>
      {children}
    </>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="!p-3.5">
      <p className="text-xs font-bold">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </Card>
  )
}

function Calendar({ cells, month }: { cells: (CalendarCell | null)[]; month: Date }) {
  const goalDays = cells.filter((c) => c?.mood === 'goal').length
  const activeDays = cells.filter((c) => c && c.minutes > 0).length
  return (
    <section aria-labelledby="calendar">
      <h2 id="calendar" className="mb-3 font-display text-xl font-bold">
        {MONTHS[month.getMonth()]} {month.getFullYear()}
      </h2>
      <div className="rounded-[1.625rem] bg-paper p-3">
        <div className="mx-auto max-w-md">
          <div className="grid grid-cols-7 gap-1.5 pb-1.5 text-center text-[0.7rem]" aria-hidden="true">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <ul className="grid grid-cols-7 gap-1.5">
            {cells.map((c, i) => (
              <li key={i} className="aspect-square" aria-label={c ? `${c.day.getDate()}: ${c.minutes} focus minutes` : undefined}>
                {c && <DayFace cell={c} />}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Bento color={PALETTE.green} title="Monthly focus summary" className="mt-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-extrabold">{goalDays > 0 ? 'Focused' : 'Getting started'}</p>
            <p className="text-sm">
              {goalDays} goal days · {activeDays} active days
            </p>
          </div>
          <Face mood={goalDays > 0 ? 'happy' : 'calm'} color="#fff" size={64} />
        </div>
      </Bento>
    </section>
  )
}

function DayFace({ cell }: { cell: CalendarCell }) {
  if (cell.mood === 'goal') return <Face shape="squircle" mood="happy" color={PALETTE.green} className="h-full w-full" />
  if (cell.mood === 'some') return <Face shape="squircle" mood="calm" color={PALETTE.yellow} className="h-full w-full" />
  return <div className={`h-full w-full rounded-[0.7rem] ${cell.mood === 'future' ? 'bg-[#F4F2F8]' : 'bg-mist'}`} />
}

function WeekChart({ days }: { days: DayMinutes[] }) {
  const max = Math.max(30, ...days.map((d) => d.minutes)) * 1.15
  return (
    <figure className="rounded-[1.625rem] bg-paper p-4">
      <svg viewBox="0 0 320 170" className="w-full" role="img" aria-label={`Focus minutes per day: ${days.map((d) => `${WEEKDAYS[d.day.getDay()]} ${d.minutes}`).join(', ')}`}>
        {days.map((d, i) => {
          const h = (d.minutes / max) * 130
          const x = 12 + i * 44
          return (
            <g key={i}>
              <rect x={x} y={140 - Math.max(h, 4)} width="30" height={Math.max(h, 4)} rx="8" fill={d.minutes > 0 ? '#111' : '#EDEBF1'} />
              {d.minutes > 0 && (
                <text x={x + 15} y={140 - h - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#111">
                  {d.minutes}
                </text>
              )}
              <text x={x + 15} y="160" textAnchor="middle" fontSize="11" fill="#5B5868">
                {WEEKDAYS[d.day.getDay()]}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
