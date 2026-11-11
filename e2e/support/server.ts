// Starts an in-memory MongoDB, seeds a known admin/editor/two sites, then runs the
// production build with `next start`. Playwright's webServer launches this and waits
// for /api/health. Nothing here touches a real database.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { hashPassword } from '@/lib/auth/password';
import { resetEnvCache } from '@/lib/env';
import { ensureIndexes } from '@/scripts/ensure-indexes';
import Site from '@/models/Site';
import User from '@/models/User';
import { ADMIN, E2E_BASE_URL, E2E_JWT_SECRET, E2E_PORT, EDITOR, SITE_A, SITE_B } from './fixtures';

const DB_NAME = 'cognerd_cms_e2e';

function siteDocument(site: typeof SITE_A) {
  return {
    name: site.name,
    slug: site.slug,
    primaryDomain: site.domain,
    publicPaths: {
      blogs: '/blogs',
      whitepapers: '/whitepapers',
      faq: '/faq',
      releaseNotes: '/release-notes',
    },
    publisher: { name: site.name, url: site.domain, logoUrl: '' },
    defaultLocale: 'en',
    mediaPrefix: site.slug,
    status: 'active' as const,
    createdBy: null,
  };
}

async function seed(): Promise<void> {
  await ensureIndexes();
  const [siteA] = await Site.create([siteDocument(SITE_A), siteDocument(SITE_B)]);
  await User.create([
    {
      email: ADMIN.email,
      passwordHash: await hashPassword(ADMIN.password),
      name: ADMIN.name,
      role: 'admin',
      siteIds: [],
      status: 'active',
      createdBy: null,
    },
    {
      email: EDITOR.email,
      passwordHash: await hashPassword(EDITOR.password),
      name: EDITOR.name,
      role: 'editor',
      siteIds: [siteA._id],
      status: 'active',
      createdBy: null,
    },
  ]);
}

async function main(): Promise<void> {
  const binaries = path.join(process.cwd(), '.next', 'test-mongo', 'binaries');
  await mkdir(binaries, { recursive: true });
  const mongo = await MongoMemoryReplSet.create({
    binary: { downloadDir: binaries },
    replSet: { count: 1 },
  });

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production' as const,
    PORT: String(E2E_PORT),
    MONGODB_URI: mongo.getUri(),
    MONGODB_DB_NAME: DB_NAME,
    CMS_JWT_SECRET: E2E_JWT_SECRET,
    NEXT_PUBLIC_CMS_URL: E2E_BASE_URL,
    // `next start` is production mode, which refuses logins without a trusted visitor
    // IP. Trust X-Real-IP here; Playwright sends a fixed value on every request.
    CMS_TRUST_PROXY: 'nginx',
    S3_BUCKET_NAME: '',
    S3_PUBLIC_URL: '',
  };
  Object.assign(process.env, env);
  resetEnvCache();
  await seed();
  await mongoose.disconnect();

  const next = spawn(
    process.execPath,
    [
      path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next'),
      'start',
      '-H',
      '127.0.0.1',
      '-p',
      String(E2E_PORT),
    ],
    { stdio: 'inherit', env },
  );

  const stop = async () => {
    next.kill('SIGTERM');
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  next.on('exit', async (code) => {
    await mongo.stop();
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
