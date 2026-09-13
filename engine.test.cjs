const assert = require('node:assert/strict');
const BusSim = require('./engine.js');

function run(seed, mode, minutes = 180, observe) {
  const state = BusSim.create(seed, mode);
  for (let i = 0; i < minutes; i++) {
    BusSim.step(state);
    if (observe) observe(state);
  }
  return state;
}

function assertCompletedTripsAreReal(state) {
  for (const p of state.people) {
    if (p.kind === 'walkin' && p.status === 'done') {
      assert.equal(p.node, p.destination, `${p.id} arrives at its declared destination`);
      assert.deepEqual(p.completedVisits, [p.destination]);
      assert.ok(p.boardedAt <= p.waitUntil, `${p.id} boarded within its 30-minute wait limit`);
      assert.ok(p.completedAt <= 180, `${p.id} arrives before 12:00`);
    }
    if (p.kind === 'registered' && p.status === 'done') {
      assert.equal(p.node, p.origin, `${p.id} only completes after returning home`);
      assert.deepEqual(p.completedVisits, p.visits, `${p.id} reached every declared visit in order`);
      assert.equal(p.completedStays.length, p.visits.length, `${p.id} completed every stay`);
      p.completedStays.forEach((stay, index) => assert.ok(stay.minutes >= p.stays[index], `${p.id} stayed at visit ${index + 1}`));
      assert.ok(p.completedAt <= p.deadline && p.completedAt <= 180, `${p.id} returns by its fixed deadline`);
    }
  }
}

// Same seed is entirely reproducible, including plans and route state.
for (const seed of [1, 42, 'demo-seed']) {
  const a = run(seed, 'B'); const b = run(seed, 'B');
  assert.deepEqual(a.people, b.people);
  assert.deepEqual(BusSim.metrics(a), BusSim.metrics(b));
}
assert.equal(BusSim.forecast('homeA', 30), BusSim.forecast('homeA', 30));
assert.ok(BusSim.forecast('mall', 60) >= 0);

// Physical invariants, future-only route, and truthful completion across seeds.
for (const seed of [1, 2, 3, 42, 99]) {
  const s = run(seed, 'B', 180, state => {
    for (const b of state.buses) {
      assert.ok(b.onboard.length <= 4, 'capacity is never exceeded');
      if (b.edge) assert.equal(b.route[0], b.edge.to, 'route begins with the next future stop, not history');
    }
    for (const p of state.people.filter(p => p.status === 'onboard')) assert.ok(state.buses.some(b => b.onboard.includes(p.id)));
  });
  assertCompletedTripsAreReal(s);
  for (const check of s.boardingChecks.filter(check => check.accepted)) {
    const before = new Map(check.before.map(stop => [stop.personId, stop.time]));
    for (const stop of check.after) if (before.has(stop.personId)) {
      assert.ok(stop.time <= before.get(stop.personId), 'accepted walk-in never delays an existing onboard arrival');
    }
  }
  assert.equal(typeof BusSim.metrics(s).distance, 'number');
  assert.equal(Object.keys(BusSim.metrics(s).unmet).length, 6);
}

// At t=1, B must protect the imminent registered reservations instead of freely chasing a forecast.
const protectedState = BusSim.create(42, 'B');
BusSim.step(protectedState);
const imminent = protectedState.people.find(p => p.id === 'r2');
assert.equal(imminent.planBus, 'bus2');
assert.equal(protectedState.buses.find(b => b.id === 'bus2').edge.to, imminent.node, 'bus2 heads to its future reservation, not a forecast stop');

// Once a pickup is locked, actual boarding must happen no later than pickupAt.
const lockedState = BusSim.create(42, 'B');
for (let i = 0; i < 180; i++) {
  const before = structuredClone(lockedState);
  BusSim.step(lockedState);
  for (const p of lockedState.people.filter(p => p.kind === 'registered' && p.status === 'onboard')) {
    const old = before.people.find(q => q.id === p.id);
    if (old.status !== 'onboard' && old.locked) assert.ok(lockedState.time <= old.pickupAt, `${p.id} honors locked pickupAt`);
  }
}

// Extension never changes the contractual deadline; all later stays/visits remain explicit.
const s = BusSim.create(7, 'A');
let target;
for (let i = 0; i < 140 && !target; i++) {
  BusSim.step(s);
  target = s.people.find(p => p.kind === 'registered' && p.status === 'staying' && p.readyAt - s.time > 10);
}
assert.ok(target, 'a registered person reaches a real stay with an editable future leg');
const beforeReady = target.readyAt, beforeDeadline = target.deadline;
assert.deepEqual(BusSim.extend(s, target.id), { ok: true, message: target.name + ' の滞在を30分延長しました' });
assert.equal(target.readyAt, beforeReady + 30);
assert.equal(target.deadline, beforeDeadline, 'extension must not relax the deadline');
assert.equal(BusSim.extend(s, 'w1').ok, false);

// Exactly 180 minutes are simulated; later calls are no-ops.
const ended = run(42, 'B');
const snapshot = JSON.stringify(ended);
for (let i = 0; i < 5; i++) BusSim.step(ended);
assert.equal(ended.time, 180);
assert.equal(JSON.stringify(ended), snapshot);

console.log('BusSim engine tests passed');
