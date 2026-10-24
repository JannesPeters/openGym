import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { migrateExerciseGroups } from '../coach/core/exercise-groups.js';

test('one account migration is validated, backed up once, and refuses stale clients without changing data', async t => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-groups-'));
  const secret = crypto.randomBytes(32).toString('hex');
  const uid = 'group-user';
  fs.writeFileSync(path.join(data, 'secret'), secret);
  fs.writeFileSync(path.join(data, 'db.json'), JSON.stringify({ users: [{ id: uid, name: 'Test' }], creds: [], subs: [], invites: [] }));
  const legacy = { routines: [{ id: 'r', name: 'Push', ex: [{
    id: '0025', slotId: 'slot', groupName: 'Press', sets: 3, reps: 5, weight: 60,
    alternatives: [{ id: '0289', sets: 2, reps: 8, weight: 30 }],
  }] }], workouts: [{ id: 'old', entries: [{ id: '0025', sets: [{ w: 60, r: 5, done: true }] }] }], _rev: 1 };
  const file = path.join(data, `state-${uid}.json`);
  const original = JSON.stringify(legacy, null, 2);
  fs.writeFileSync(file, original);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DATA_DIR: data, PORT: '0', RP_ID: 'localhost', ORIGIN: 'http://localhost:8080' },
  });
  let log = '';
  child.stdout.on('data', value => { log += value; });
  child.stderr.on('data', value => { log += value; });
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(data, { recursive: true, force: true }); });
  const port = await boundPort(child, () => log);
  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).stateVersion, 2, 'API capability is observable without account credentials');
  const payload = `${uid}:${Date.now() + 86400000}:0`;
  const cookie = payload + '.' + crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const headers = { Cookie: `gymsid=${cookie}`, 'Content-Type': 'application/json' };
  const upgradedHeaders = { ...headers, 'X-OpenGym-State-Version': '2' };
  const get = (route = '/api/data', modern = true) => fetch(`http://127.0.0.1:${port}${route}`, { headers: modern ? upgradedHeaders : headers });
  const put = (state, modern = true, baseRev = JSON.parse(fs.readFileSync(file))._rev) => fetch(`http://127.0.0.1:${port}/api/data`, {
    method: 'PUT', headers: modern ? upgradedHeaders : headers, body: JSON.stringify({ state, baseRev, stamped: true }),
  });
  const read = await (await get()).json();
  assert.equal(read.stateVersion, 2);
  const converted = migrateExerciseGroups(read.state);
  assert.equal(fs.readFileSync(file, 'utf8'), original, 'dry-run conversion does not write');
  const bad = structuredClone(converted);
  bad.exerciseGroups = [];
  assert.equal((await put(bad)).status, 400);
  assert.equal((await put({ ...legacy, stateVersion: 2, exerciseGroups: [] })).status, 400, 'version 2 cannot write the inline schema');
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.equal(fs.existsSync(file + '.pre-groups-v1.json'), false);
  fs.mkdirSync(file + '.pre-groups-v1.json');
  assert.equal((await put(converted)).status, 500, 'a failed backup aborts conversion');
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  fs.rmdirSync(file + '.pre-groups-v1.json');
  assert.equal((await put(converted)).status, 200);
  assert.equal(fs.readFileSync(file + '.pre-groups-v1.json', 'utf8'), original);
  const persisted = JSON.parse(fs.readFileSync(file));
  assert.equal(persisted.stateVersion, 2);
  assert.deepEqual(persisted.workouts, legacy.workouts);
  const beforeRefusal = fs.readFileSync(file, 'utf8');
  assert.equal((await get('/api/data', false)).status, 426);
  assert.equal((await get('/api/data/rev', false)).status, 426);
  assert.equal((await put(legacy, false)).status, 426);
  assert.equal((await put(legacy)).status, 426);
  assert.equal((await put({ ...converted, stateVersion: 999 })).status, 426);
  assert.equal(fs.readFileSync(file, 'utf8'), beforeRefusal);
  const latest = (await (await get()).json()).state;
  latest.exerciseGroups[0].name = 'Renamed';
  assert.equal((await put(latest)).status, 200);
  assert.equal(fs.readFileSync(file + '.pre-groups-v1.json', 'utf8'), original, 'later edits never overwrite recovery');
  assert.equal((await put(converted, true, 1)).status, 409, 'concurrent migration cannot overwrite the upgraded account');
});
