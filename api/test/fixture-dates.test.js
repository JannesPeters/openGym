import test from 'node:test';
import assert from 'node:assert/strict';
import { daysAgo, sampleState } from './helpers.mjs';
import { build, MAX_WEEKS, reviewWindow } from '../coach/core/payload.js';

for (const now of [
  '2026-10-12T12:00:00Z',
  '2026-10-13T12:00:00Z',
  '2026-10-19T12:00:00Z',
  '2027-01-01T12:00:00Z',
  '2028-03-01T12:00:00Z'
]) {
  test(`sample history stays recent and the 12-week cutoff holds on ${now.slice(0, 10)}`, t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(now) });
    const state = sampleState();
    const payload = build(state, { handle: 'h'.repeat(16), kind: 'review' });
    assert.equal(payload.window.workouts.length, 1);
    assert.equal(payload.window.workouts[0].d, daysAgo(2));
    assert.deepEqual(payload.bodyweight, { goal: 80, series: [{ d: daysAgo(2), w: 78.5 }] });
    assert.equal(build(state, { handle: 'h'.repeat(16), kind: 'debrief' }).session.d, daysAgo(2));

    assert.equal(MAX_WEEKS, 12);
    state.workouts = [85, 84, 83].map(days => ({ id: `w${days}`, d: daysAgo(days) }));
    assert.deepEqual(reviewWindow(state).map(workout => workout.id), ['w84', 'w83']);
    assert.deepEqual(reviewWindow(state, daysAgo(83)).map(workout => workout.id), ['w83']);
  });
}

test('a fixed historical workout still ages out exactly after twelve weeks', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-12T12:00:00Z') });
  const state = sampleState({ workouts: [{ id: 'historical', d: '2026-07-20' }] });
  assert.deepEqual(reviewWindow(state).map(workout => workout.id), ['historical']);
  t.mock.timers.setTime(new Date('2026-10-13T12:00:00Z').getTime());
  assert.deepEqual(reviewWindow(state), []);
});

test('relative fixture dates cross year and leap-day boundaries without changing explicit history', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2028-03-01T12:00:00Z') });
  assert.equal(daysAgo(1), '2028-02-29');
  assert.equal(daysAgo(2), '2028-02-28');
  assert.equal(daysAgo(2, new Date('2027-01-01T12:00:00Z')), '2026-12-30');
  const history = [{ id: 'historical', d: '2026-07-20' }];
  assert.deepEqual(sampleState({ workouts: history }).workouts, history);
});
