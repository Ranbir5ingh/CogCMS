/**
 * Starts a single-node MongoDB replica set using the same mongodb-memory-server
 * binary the test suite uses. Useful when Docker or a system `mongod` is not
 * available. Leave this process running while you seed and develop.
 *
 *   node scripts/dev-replset.mjs
 *   # or: npm run dev:mongo
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const root = path.join(process.cwd(), '.next', 'dev-mongo');
const downloadDir = path.join(root, 'binaries');
const dbPath = path.join(root, 'data');

await mkdir(downloadDir, { recursive: true });
await mkdir(dbPath, { recursive: true });

console.log('Starting a local MongoDB replica set (mongodb-memory-server)…');
if (!process.env.MONGOMS_DOWNLOAD_DIR) {
  console.log(`Binary cache: ${downloadDir}`);
}

const server = await MongoMemoryReplSet.create({
  binary: { downloadDir },
  instanceOpts: [{ dbPath }],
  replSet: { count: 1, name: 'rs0' },
});

const uri = server.getUri();
console.log(`
MongoDB replica set is ready.

In another terminal, export these (or put them in .env):

  MONGODB_URI=${uri}
  MONGODB_DB_NAME=cms_public_demo

Then:

  npm run seed:admin
  npm run ensure:indexes
  npm run seed:demo        # optional, local cms_public_demo only
  npm run dev              # http://localhost:3003/admin/login

Press Ctrl+C to stop the replica set. Data lives in ${dbPath}
and is reused the next time you run this script, as long as that
directory is left intact.
`);

const stop = async () => {
  console.log('\nStopping the replica set…');
  await server.stop();
  process.exit(0);
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// Keep the event loop alive; MongoMemoryReplSet already does, but be explicit.
await new Promise(() => {});
