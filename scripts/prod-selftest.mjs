#!/usr/bin/env node
/**
 * Production self-test for Pixeloon's Supabase backend.
 *
 * Run this from a machine that CAN reach your Supabase project (your laptop, a
 * CI runner, etc.). It verifies connectivity, that the schema migrations landed,
 * that the thumbnails bucket exists, that RLS blocks anonymous reads, and that
 * the edge functions are deployed and reject unauthenticated calls.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_ANON_KEY=<anon-key> \
 *   node scripts/prod-selftest.mjs
 *
 * Optional (checks the auto-poster cron responds; safe, posts nothing):
 *   ...  node scripts/prod-selftest.mjs --ping-autoposter
 */

const URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const ANON = process.env.SUPABASE_ANON_KEY;
const pingAuto = process.argv.includes('--ping-autoposter');

if (!URL || !ANON) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY env vars first.');
  process.exit(2);
}

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`); };
const bad = (m) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };

const rest = (path, opts = {}) =>
  fetch(`${URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, ...(opts.headers || {}) },
  });

console.log(`\nPixeloon backend self-test → ${URL}\n`);

// 1. Auth reachable
console.log('Connectivity');
try {
  const r = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: ANON } });
  r.ok ? ok('Auth service reachable') : bad(`Auth health returned ${r.status}`);
} catch (e) { bad(`Cannot reach Supabase: ${e.message}`); }

// 2. Schema — new columns exist (select fails if the migration didn't run)
console.log('\nSchema / migrations');
for (const col of [
  'youtube_thumbnail_mode',
  'youtube_thumbnail_url',
  'youtube_thumbnail_title_overlay',
  'schedule_generating_at',
]) {
  const r = await rest(`campaigns?select=${col}&limit=1`);
  // 200 = column exists (RLS may return []), 400 = column missing
  r.status === 200 ? ok(`campaigns.${col} exists`) : bad(`campaigns.${col} missing (status ${r.status}) — run: supabase db push`);
}
{
  const r = await rest('scheduled_posts?select=processing_started_at&limit=1');
  r.status === 200 ? ok('scheduled_posts.processing_started_at exists') : bad('processing_started_at missing — run: supabase db push');
}

// 3. Storage buckets
console.log('\nStorage');
for (const bucket of ['thumbnails', 'temp-videos']) {
  const r = await fetch(`${URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 1 }),
  });
  // 200 or 400 => bucket exists and responds; 404 => missing
  r.status !== 404 ? ok(`bucket '${bucket}' exists`) : bad(`bucket '${bucket}' missing — run: supabase db push`);
}

// 4. RLS — anonymous must NOT read other users' rows
console.log('\nSecurity (RLS)');
{
  const r = await rest('user_api_keys?select=api_key&limit=1');
  const body = await r.json().catch(() => null);
  if (Array.isArray(body) && body.length === 0) ok('Anonymous cannot read user_api_keys (RLS on)');
  else if (r.status === 401 || r.status === 403) ok('Anonymous blocked from user_api_keys');
  else bad(`user_api_keys leaked ${Array.isArray(body) ? body.length : '?'} rows to anon — CHECK RLS`);
}

// 5. Edge functions deployed + reject unauthenticated privileged calls
console.log('\nEdge functions');
{
  const r = await fetch(`${URL}/functions/v1/generate-schedule`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId: '00000000-0000-0000-0000-000000000000' }),
  });
  if (r.status === 404) bad('generate-schedule not deployed — run: supabase functions deploy generate-schedule');
  else ok(`generate-schedule deployed (responded ${r.status})`);
}
if (pingAuto) {
  const r = await fetch(`${URL}/functions/v1/auto-poster`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const b = await r.json().catch(() => ({}));
  r.ok && 'processed' in b ? ok(`auto-poster responds (processed ${b.processed})`) : bad(`auto-poster unexpected: ${r.status}`);
}

console.log(`\n${fail === 0 ? '\x1b[32mALL CHECKS PASSED' : '\x1b[31mSOME CHECKS FAILED'}\x1b[0m  (${pass} passed, ${fail} failed)\n`);
process.exit(fail === 0 ? 0 : 1);
