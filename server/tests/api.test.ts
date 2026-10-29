import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { Reward } from '../src/modules/rewards/reward.model';
import { Session } from '../src/modules/sessions/session.model';
import { TokenTransaction } from '../src/modules/tokens/transaction.model';
import { User } from '../src/modules/users/user.model';

let replSet: MongoMemoryReplSet;
const app = createApp();

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await mongoose.connection.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

async function signUp(email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'correct-horse', displayName: email.split('@')[0], timezone: 'Asia/Kolkata' })
    .expect(201);
  return { token: res.body.accessToken as string, refreshToken: res.body.refreshToken as string, userId: res.body.user.id as string };
}

/** Pretend a session started `minutes` ago, since the server only trusts its own clock. */
async function backdate(sessionId: string, minutes: number) {
  await Session.updateOne({ _id: sessionId }, { $set: { startedAt: new Date(Date.now() - minutes * 60000) } });
}

describe('auth', () => {
  it('rejects requests without a token', async () => {
    await request(app).get('/api/v1/me').expect(401);
  });

  it('logs in, rotates refresh tokens and rejects reuse', async () => {
    await signUp('rotate@techbreak.test');
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'rotate@techbreak.test', password: 'correct-horse' }).expect(200);
    const first = login.body.refreshToken;
    const rotated = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(200);
    expect(rotated.body.refreshToken).not.toBe(first);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email: 'rotate@techbreak.test', password: 'wrong' }).expect(401);
  });
});

describe('focus → earn → redeem', () => {
  it('awards tokens once, hits the goal, and spends on a reward', async () => {
    const { token, userId } = await signUp('flow@techbreak.test');
    const auth = { Authorization: `Bearer ${token}` };

    await request(app).put('/api/v1/goals/today').set(auth).send({ focusTargetMin: 20 }).expect(200);

    const started = await request(app).post('/api/v1/sessions').set(auth).send({ type: 'focus', plannedMin: 25 }).expect(201);
    const sessionId = started.body.session.id;
    await backdate(sessionId, 30);

    const done = await request(app).post(`/api/v1/sessions/${sessionId}/complete`).set(auth).expect(200);
    expect(done.body.alreadyCompleted).toBe(false);
    expect(done.body.awards).toEqual([
      { amount: 25, reason: 'focus_complete' },
      { amount: 5, reason: 'clean_bonus' },
      { amount: 30, reason: 'goal_achieved' },
      { amount: 5, reason: 'streak_bonus' },
    ]);

    // Completing again must not pay twice.
    const again = await request(app).post(`/api/v1/sessions/${sessionId}/complete`).set(auth).expect(200);
    expect(again.body.alreadyCompleted).toBe(true);

    const me = await request(app).get('/api/v1/me').set(auth).expect(200);
    expect(me.body.user.tokenBalance).toBe(65);
    expect(me.body.user.streak.current).toBe(1);
    expect(me.body.user.passwordHash).toBeUndefined();

    // A break right after the focus session earns a small bonus.
    const brk = await request(app).post('/api/v1/sessions').set(auth).send({ type: 'break', breakKind: 'breathing', plannedMin: 3, afterSessionId: sessionId }).expect(201);
    await Session.updateOne({ _id: brk.body.session.id }, { $set: { startedAt: new Date(Date.now() - 3 * 60000) } });
    await Session.updateOne({ _id: sessionId }, { $set: { endedAt: new Date(Date.now() - 4 * 60000) } });
    const brkDone = await request(app).post(`/api/v1/sessions/${brk.body.session.id}/complete`).set(auth).expect(200);
    expect(brkDone.body.awards).toEqual([{ amount: 5, reason: 'break_complete' }]);

    const beanie = await Reward.create({ slug: 'test-beanie', kind: 'avatar_item', slot: 'hat', name: 'Beanie', cost: 50 });
    const crown = await Reward.create({ slug: 'test-crown', kind: 'avatar_item', slot: 'hat', name: 'Crown', cost: 500 });

    const redeemed = await request(app).post(`/api/v1/rewards/${beanie.id}/redeem`).set(auth).expect(200);
    expect(redeemed.body.user.tokenBalance).toBe(20);
    await request(app).post(`/api/v1/rewards/${beanie.id}/redeem`).set(auth).expect(409);
    await request(app).post(`/api/v1/rewards/${crown.id}/redeem`).set(auth).expect(402);

    await request(app).put('/api/v1/me/avatar').set(auth).send({ slot: 'hat', rewardId: beanie.id }).expect(200);
    await request(app).put('/api/v1/me/avatar').set(auth).send({ slot: 'hat', rewardId: crown.id }).expect(403);

    // Ledger reconciles with the cached balance.
    const rows = await TokenTransaction.find({ userId });
    const user = await User.findById(userId);
    expect(rows.reduce((n, r) => n + r.amount, 0)).toBe(user!.tokenBalance);
  });

  it('pays nothing for an abandoned session', async () => {
    const { token } = await signUp('quitter@techbreak.test');
    const auth = { Authorization: `Bearer ${token}` };
    const started = await request(app).post('/api/v1/sessions').set(auth).send({ type: 'focus', plannedMin: 25 }).expect(201);
    await request(app).post(`/api/v1/sessions/${started.body.session.id}/abandon`).set(auth).expect(200);
    await request(app).post(`/api/v1/sessions/${started.body.session.id}/complete`).set(auth).expect(409);
  });
});

describe('social', () => {
  it('adds friends by invite code and ranks them', async () => {
    const a = await signUp('ana@techbreak.test');
    const b = await signUp('ben@techbreak.test');
    const benMe = await request(app).get('/api/v1/me').set({ Authorization: `Bearer ${b.token}` });
    await request(app).post('/api/v1/friends').set({ Authorization: `Bearer ${a.token}` }).send({ inviteCode: benMe.body.user.inviteCode }).expect(201);

    const s = await request(app).post('/api/v1/sessions').set({ Authorization: `Bearer ${b.token}` }).send({ type: 'focus', plannedMin: 40 });
    await backdate(s.body.session.id, 40);
    await request(app).post(`/api/v1/sessions/${s.body.session.id}/complete`).set({ Authorization: `Bearer ${b.token}` }).expect(200);

    const board = await request(app).get('/api/v1/leaderboard?scope=friends').set({ Authorization: `Bearer ${a.token}` }).expect(200);
    expect(board.body.entries[0]).toMatchObject({ displayName: 'ben', focusMin: 40, rank: 1 });
  });
});

describe('hourly rollover job', () => {
  it('resets a broken streak and pays the screen-limit bonus for yesterday', async () => {
    const { runHourly } = await import('../src/jobs');
    const { Goal } = await import('../src/modules/goals/goal.model');
    const { userId } = await signUp('rollover@techbreak.test');
    const now = new Date('2026-10-28T12:00:00Z'); // 17:30 in Asia/Kolkata
    await User.updateOne({ _id: userId }, { $set: { streak: { current: 5, longest: 5, lastActiveDate: '2026-10-25', freezes: 0 } } });
    await Goal.create({ userId, date: '2026-10-27', focusTargetMin: 120, screenLimitMin: 240, screenUsedMin: 200 });

    await runHourly(now);
    await runHourly(now); // second run in the same local day is a no-op

    const user = await User.findById(userId);
    expect(user!.streak.current).toBe(0);
    expect(user!.tokenBalance).toBe(20);
    expect(user!.lastRolloverDate).toBe('2026-10-28');
  });
});

describe('app unlocks', () => {
  it('spends tokens for a timed unlock and blocks double unlocks', async () => {
    const { token, userId } = await signUp('apps@techbreak.test');
    const auth = { Authorization: `Bearer ${token}` };

    await request(app).post('/api/v1/apps/instagram/unlock').set(auth).expect(402);
    await request(app).post('/api/v1/apps/nope/unlock').set(auth).expect(404);

    await User.updateOne({ _id: userId }, { $set: { tokenBalance: 100 } });
    await TokenTransaction.create({ userId, amount: 100, type: 'earn', reason: 'focus_complete', day: '2026-10-30', balanceAfter: 100 });

    const unlocked = await request(app).post('/api/v1/apps/instagram/unlock').set(auth).expect(201);
    expect(unlocked.body.user.tokenBalance).toBe(70);
    const msLeft = new Date(unlocked.body.unlock.expiresAt).getTime() - Date.now();
    expect(msLeft).toBeGreaterThan(14 * 60000);
    expect(msLeft).toBeLessThanOrEqual(15 * 60000);

    await request(app).post('/api/v1/apps/instagram/unlock').set(auth).expect(409);

    const list = await request(app).get('/api/v1/apps').set(auth).expect(200);
    const insta = list.body.items.find((a: { id: string }) => a.id === 'instagram');
    const snap = list.body.items.find((a: { id: string }) => a.id === 'snapchat');
    expect(insta.unlockedUntil).not.toBeNull();
    expect(snap.unlockedUntil).toBeNull();

    const rows = await TokenTransaction.find({ userId });
    expect(rows.reduce((n, r) => n + r.amount, 0)).toBe(70);
  });
});
