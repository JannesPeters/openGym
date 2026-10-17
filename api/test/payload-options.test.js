import test from 'node:test';
import assert from 'node:assert/strict';
import { build, cleanPlan } from '../coach/core/payload.js';

const state = () => ({
  unit: 'kg', routines: [{
    id: 'push', name: 'Push', prog: 'linear', ex: [{
      id: '0289', sets: 3, reps: 8, weight: 20, slotId: 'slot',
      alternatives: [{ id: '0576', sets: 2, reps: 12, weight: 45, note: 'private option note' }]
    }]
  }],
  week: {}, workouts: [], coach: { profile: { equipment: ['dumbbell'] } }
});

test('the cleaned plan describes one optional slot with independent, allowlisted targets', () => {
  const plan = cleanPlan(state());
  const slot = plan.routines[0].ex[0];
  assert.equal(plan.routines[0].ex.length, 1);
  assert.equal(slot.chooseOne, true);
  assert.equal(slot.weight, 20);
  assert.deepEqual(slot.alternatives[0], {
    id: '0576', name: 'lever chest press', sets: 2, mode: 'reps', reps: 12, weight: 45
  });
  assert.equal(JSON.stringify(plan).includes('private option note'), false);
  assert.equal(slot.slotId, undefined);
});

test('alternative history uses its own target and its library entry survives equipment filtering', () => {
  const s = state();
  s.workouts = Array.from({ length: 3 }, (_, i) => ({
    id: `w${i}`, d: new Date().toISOString().slice(0, 10), entries: [{
      id: '0576', sets: [{ w: 45, r: 12, done: true }, { w: 45, r: 12, done: true }]
    }]
  }));
  const payload = build(s, { handle: 'h'.repeat(16), kind: 'review' });
  assert.equal(payload.aggregates.exercises.find(e => e.id === '0576').lastOk, true);
  assert.ok(payload.library.some(e => e.id === '0576'));
  assert.equal(payload.plan.routines[0].ex.length, 1);
});
