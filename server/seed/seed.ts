/**
 * Seeds the rewards catalog, this week's challenges and a demo user.
 * Safe to re-run: everything is upserted.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { Challenge } from '../src/modules/challenges/challenge.model';
import { Reward, type IReward } from '../src/modules/rewards/reward.model';
import { User } from '../src/modules/users/user.model';
import { weekStartUtc } from '../src/utils/date';

const rewards: Omit<IReward, 'active'>[] = [
  { slug: 'hat-beanie', kind: 'avatar_item', slot: 'hat', name: 'Cozy Beanie', description: 'For chilly focus sessions', cost: 50 },
  { slug: 'hat-headphones', kind: 'avatar_item', slot: 'hat', name: 'Deep-Work Headphones', description: 'Noise: cancelled', cost: 150 },
  { slug: 'hat-crown', kind: 'avatar_item', slot: 'hat', name: 'Focus Crown', description: 'Rule your attention', cost: 500 },
  { slug: 'outfit-hoodie', kind: 'avatar_item', slot: 'outfit', name: 'Calm Hoodie', description: '', cost: 80 },
  { slug: 'outfit-yoga', kind: 'avatar_item', slot: 'outfit', name: 'Yoga Set', description: 'Stretch-break ready', cost: 200 },
  { slug: 'bg-forest', kind: 'avatar_item', slot: 'background', name: 'Quiet Forest', description: '', cost: 120 },
  { slug: 'bg-ocean', kind: 'avatar_item', slot: 'background', name: 'Ocean Horizon', description: '', cost: 250 },
  { slug: 'streak_freeze', kind: 'perk', name: 'Streak Freeze', description: 'Protects your streak for one missed day', cost: 150 },
  { slug: 'donate-tree', kind: 'donation', name: 'Plant a Tree', description: 'Pledge toward a tree-planting partner', cost: 100, cause: 'Reforestation' },
  { slug: 'donate-meal', kind: 'donation', name: 'Share a Meal', description: 'Pledge toward a food bank partner', cost: 200, cause: 'Food security' },
  { slug: 'donate-books', kind: 'donation', name: 'Books for Kids', description: 'Pledge toward a literacy partner', cost: 300, cause: 'Education' },
];

async function main() {
  await mongoose.connect(env.mongoUri);

  for (const r of rewards) await Reward.updateOne({ slug: r.slug }, { $set: { ...r, active: true } }, { upsert: true });
  console.log(`Seeded ${rewards.length} rewards`);

  const startsAt = weekStartUtc();
  const endsAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  const challenges = [
    { title: 'Focus Five', description: 'Log 5 hours of focus this week', metric: 'focus_minutes', target: 300, rewardTokens: 100 },
    { title: 'Break Champion', description: 'Take 10 mindful breaks this week', metric: 'breaks', target: 10, rewardTokens: 60 },
    { title: 'Three-Day Streak', description: 'Hit your daily goal 3 days in a row', metric: 'streak_days', target: 3, rewardTokens: 80 },
  ] as const;
  for (const c of challenges) {
    await Challenge.updateOne({ title: c.title }, { $set: { ...c, startsAt, endsAt, scope: 'global' } }, { upsert: true });
  }
  console.log(`Seeded ${challenges.length} challenges for the week of ${startsAt.toISOString().slice(0, 10)}`);

  const password = process.env.SEED_DEMO_PASSWORD ?? 'techbreak-demo';
  await User.updateOne(
    { email: 'demo@techbreak.test' },
    {
      $setOnInsert: { displayName: 'Demo User', inviteCode: 'DEMO0001', timezone: 'UTC' },
      $set: { passwordHash: await bcrypt.hash(password, 10) },
    },
    { upsert: true },
  );
  console.log('Demo user: demo@techbreak.test (password from SEED_DEMO_PASSWORD)');

  // A second demo account that signs in with a short, easy username and password (login accepts any length).
  await User.updateOne(
    { email: 'iker@techbreak.test' },
    {
      $setOnInsert: { displayName: 'Iker', inviteCode: 'IKER0001', timezone: 'UTC' },
      $set: { username: 'iker', passwordHash: await bcrypt.hash('123456', 10) },
    },
    { upsert: true },
  );
  console.log('Demo user: iker / 123456 (also iker@techbreak.test)');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
