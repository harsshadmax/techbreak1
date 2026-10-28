/**
 * Local MongoDB replica set without Docker, for development.
 * Uses the same mongod binary as the tests; data persists in server/.data.
 * Usage: npm run db   (then `npm run dev` in another terminal)
 */
import fs from 'node:fs';
import path from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const PORT = Number(process.env.DEV_DB_PORT ?? 27017);
const dbPath = path.resolve(__dirname, '..', '.data');

async function main() {
  fs.mkdirSync(dbPath, { recursive: true });
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, name: 'rs0' },
    instanceOpts: [{ port: PORT, dbPath, storageEngine: 'wiredTiger' }],
  });
  console.log(`MongoDB replica set ready on mongodb://127.0.0.1:${PORT}/techbreak?directConnection=true`);
  console.log(`Data directory: ${dbPath}  (Ctrl+C to stop)`);

  const stop = async () => {
    await replSet.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
