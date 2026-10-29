export interface Streak {
  current: number
  longest: number
  freezes: number
}

export interface User {
  id: string
  email: string
  displayName: string
  tokenBalance: number
  xp: number
  level: number
  streak: Streak
  inviteCode: string
  timezone: string
  settings: { dailyFocusGoalMin: number }
  avatar: { base: string; equipped: Record<string, string> }
}

export interface Goal {
  focusTargetMin: number
  focusDoneMin: number
  achieved: boolean
  screenLimitMin: number
  screenUsedMin: number
}

export interface Award {
  amount: number
  reason: string
}

export interface Reward {
  id: string
  slug: string
  kind: 'avatar_item' | 'perk' | 'donation'
  name: string
  description: string
  cost: number
  slot?: string
}

export interface Challenge {
  id: string
  title: string
  description: string
  target: number
  rewardTokens: number
}

export interface ChallengeProgress {
  progress: number
  completed: boolean
  claimedAt?: string | null
}

export interface ChallengeEntry {
  challenge: Challenge
  progress: ChallengeProgress | null
}

export interface LeaderboardEntry {
  rank: number
  displayName: string
  focusMin: number
  level: number
  isMe: boolean
}

export interface SessionRec {
  type: string
  status: string
  actualMin: number
  startedAt: string
  tokensAwarded: number
}

export interface TokenTx {
  id: string
  amount: number
  reason: string
  createdAt: string
}

export interface UnlockApp {
  id: string
  name: string
  category: 'social' | 'streaming'
  cost: number
  minutes: number
  unlockedUntil: string | null
}

export interface DashboardData {
  user: User
  goal: Goal
  challenges: ChallengeEntry[]
}
