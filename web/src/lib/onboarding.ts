const key = (userId: string) => `tb.onboarded.${userId}`

/** Whether this user finished onboarding on this device. If storage is blocked we don't nag. */
export function isOnboarded(userId: string): boolean {
  try {
    return localStorage.getItem(key(userId)) === '1'
  } catch {
    return true
  }
}

export function markOnboarded(userId: string) {
  try {
    localStorage.setItem(key(userId), '1')
  } catch {
    // Without storage the intro simply shows again next time.
  }
}
