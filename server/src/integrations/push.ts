import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../config/env';
import { User } from '../modules/users/user.model';

function messaging() {
  if (!env.firebaseServiceAccount) return null;
  if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(env.firebaseServiceAccount)) });
  return getMessaging();
}

/** Send a push to all of a user's devices. Logs instead when Firebase isn't configured. */
export async function sendPush(userId: string, title: string, body: string): Promise<void> {
  const user = await User.findById(userId, { fcmTokens: 1 });
  if (!user?.fcmTokens.length) return;

  const fcm = messaging();
  if (!fcm) {
    console.log(`[push:dry-run] ${userId}: ${title} — ${body}`);
    return;
  }

  const result = await fcm.sendEachForMulticast({ tokens: user.fcmTokens, notification: { title, body } });
  // Drop tokens Firebase says are no longer valid.
  const dead = result.responses
    .map((r, i) => (r.error?.code === 'messaging/registration-token-not-registered' ? user.fcmTokens[i] : null))
    .filter((t): t is string => t !== null);
  if (dead.length) await User.updateOne({ _id: userId }, { $pull: { fcmTokens: { $in: dead } } });
}
