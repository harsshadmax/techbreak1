import { useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/hooks'
import { useToast } from '../lib/toast'
import type { Reward, User } from '../lib/types'
import { Button, Card, ErrorRetry, PageTitle, Sheet, Spinner, Tokens, TokenPill } from '../ui/kit'

type Kind = Reward['kind']
const TABS: { kind: Kind; label: string }[] = [
  { kind: 'avatar_item', label: 'Avatar' },
  { kind: 'perk', label: 'Perks' },
  { kind: 'donation', label: 'Donate' },
]

interface InventoryItem {
  rewardId: { id: string }
}

export function RewardsPage() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [kind, setKind] = useState<Kind>('avatar_item')
  const [pending, setPending] = useState<Reward | null>(null)
  const [busy, setBusy] = useState(false)

  const data = useFetch(async () => {
    const [rewards, inventory] = await Promise.all([api.get<{ items: Reward[] }>('/rewards'), api.get<{ items: InventoryItem[] }>('/inventory')])
    return { rewards: rewards.items, owned: new Set(inventory.items.map((i) => i.rewardId.id)) }
  })

  if (data.loading) return <Spinner />
  if (data.error || !data.data || !user) return <ErrorRetry message={data.error ?? 'Something went wrong'} onRetry={data.reload} />

  const equipped = new Set(Object.values(user.avatar.equipped))
  const list = data.data.rewards.filter((r) => r.kind === kind)

  async function redeem(reward: Reward) {
    setBusy(true)
    try {
      const res = await api.post<{ user: User }>(`/rewards/${reward.id}/redeem`)
      setUser(res.user)
      setPending(null)
      toast(`${reward.name}: done!`)
      await data.reload()
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function equip(reward: Reward) {
    try {
      const res = await api.put<{ user: User }>('/me/avatar', { slot: reward.slot, rewardId: reward.id })
      setUser(res.user)
      toast(`Equipped ${reward.name}`)
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  return (
    <>
      <PageTitle right={<TokenPill amount={user.tokenBalance} />}>Rewards hub</PageTitle>

      <div role="tablist" aria-label="Reward types" className="mb-4 flex gap-1 rounded-full bg-paper p-1">
        {TABS.map((t) => (
          <button
            key={t.kind}
            role="tab"
            type="button"
            aria-selected={kind === t.kind}
            onClick={() => setKind(t.kind)}
            className={`min-h-10 flex-1 rounded-full font-bold transition-colors ${kind === t.kind ? 'bg-ink text-white' : 'hover:bg-mist'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="py-10 text-center">Nothing here yet. Run the server seed script.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.map((r) => {
            const owned = r.kind === 'avatar_item' && data.data!.owned.has(r.id)
            const detail = [r.slot, r.description].filter(Boolean).join(' · ')
            return (
              <li key={r.id}>
                <Card className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{r.name}</p>
                    {detail && <p className="text-sm text-muted">{detail}</p>}
                  </div>
                  {owned ? (
                    equipped.has(r.id) ? (
                      <span className="rounded-full bg-green px-3.5 py-2 text-sm font-bold">Equipped</span>
                    ) : (
                      <Button variant="outline" small onClick={() => equip(r)}>
                        Equip
                      </Button>
                    )
                  ) : (
                    <Button small disabled={user.tokenBalance < r.cost} onClick={() => setPending(r)} aria-label={`${r.kind === 'donation' ? 'Pledge' : 'Buy'} ${r.name} for ${r.cost} tokens`}>
                      <Tokens amount={r.cost} />
                    </Button>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={pending !== null} onClose={() => setPending(null)} label="Confirm purchase">
        {pending && (
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-2xl font-extrabold">
              {pending.kind === 'donation' ? 'Pledge' : 'Buy'} {pending.name}?
            </h2>
            <p>This costs {pending.cost} tokens.</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <Button variant="outline" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button disabled={busy} onClick={() => redeem(pending)}>
                {pending.kind === 'donation' ? 'Pledge' : 'Buy'}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}
