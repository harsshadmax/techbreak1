import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from './api'
import type { Reward } from './types'

export interface Fetched<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => Promise<void>
}

/** Runs [load] on mount and whenever [deps] change; reload() refetches without flashing the spinner. */
export function useFetch<T>(load: () => Promise<T>, deps: unknown[] = []): Fetched<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const loadRef = useRef(load)
  loadRef.current = load

  const run = useCallback(async () => {
    try {
      setData(await loadRef.current())
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading, reload: run }
}

/** Ticks once a second so countdowns re-render. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

let catalogPromise: Promise<Reward[]> | null = null

/** The reward catalog, fetched once per page load; used to turn equipped reward ids into avatar items. */
export function useRewardCatalog(enabled = true): Reward[] {
  const [rewards, setRewards] = useState<Reward[]>([])
  useEffect(() => {
    if (!enabled) return
    catalogPromise ??= api.get<{ items: Reward[] }>('/rewards').then((r) => r.items)
    let live = true
    catalogPromise.then((items) => live && setRewards(items)).catch(() => (catalogPromise = null))
    return () => {
      live = false
    }
  }, [enabled])
  return rewards
}
