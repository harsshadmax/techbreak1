import mongoose from 'mongoose';
import { createApp } from './app';
import { env } from './config/env';
import { startJobs } from './jobs';

async function main() {
  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB');

  startJobs();
  createApp().listen(env.port, () => {
    console.log(`TechBreak API listening on http://localhost:${env.port}/api/v1`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
