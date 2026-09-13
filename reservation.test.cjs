const assert=require('node:assert/strict');
const T=require('./demo/timeline.js'),S=require('./demo/engine.js');
const t=T.create(42,'B');t.seek(40);
const saved=structuredClone(t.state),before=t.preview();
assert.deepEqual(t.state,saved,'preview must not change live state');
for(const p of t.state.people.filter(p=>p.kind==='walkin'&&p.status!=='onboard')){p.destination='station';p.readyAt=41;p.node='station';}
assert.deepEqual(t.preview(),before,'future and remote waiting walkers cannot leak into the plan');
t.seek(40);
const priorBuses=structuredClone(t.state.buses);
const result=t.reserve({origin:'park',destination:'hospital',readyAt:43,deadline:180});
assert.equal(result.ok,true);assert.deepEqual(t.state.buses,priorBuses,'new reservation never teleports or rewrites a current edge');
const M=require('./demo/city-map.js');
const route=frames=>frames.map(s=>s.buses.map(b=>M.position(b)));
assert.notDeepEqual(route(t.preview()),route(before),'demo booking changes the next 15 minute route');
const after=structuredClone(t.state);
t.seek(0);assert.deepEqual(t.seek(40),after,'reservation remains at its booked time after rewind');
for(let i=41;i<=180;i++){t.seek(i);for(const b of t.state.buses)assert.ok(b.onboard.length<=4);}
const p=t.state.people.find(p=>p.id===result.id);
assert.equal(p.status,'done');assert.equal(p.node,'hospital');assert.ok(p.boardedAt>=43);assert.ok(p.completedAt<=180);
const invalid=S.create(42,'B');const untouched=structuredClone(invalid);
assert.equal(S.addReservation(invalid,{origin:'park',destination:'park',readyAt:3,deadline:180}).ok,false);
assert.equal(S.addReservation(invalid,{origin:'park',destination:'hospital',readyAt:175,deadline:180}).ok,false);
assert.deepEqual(invalid,untouched);
console.log('Reservation tests passed: plan change, no future leakage, physical boarding/arrival, replay, validation');
// A requested later pickup must affect dispatch and never board before that time.
const later=T.create(42,'B');later.seek(40);
const laterResult=later.reserve({origin:'park',destination:'hospital',readyAt:70,deadline:180});
assert.equal(laterResult.ok,true);
for(let minute=41;minute<70;minute++){
  later.seek(minute);
  assert.equal(later.state.people.find(p=>p.id===laterResult.id).status,'pending');
  assert.ok(later.state.buses.every(b=>!b.onboard.includes(laterResult.id)));
}
later.seek(180);
const laterPassenger=later.state.people.find(p=>p.id===laterResult.id);
assert.equal(laterPassenger.status,'done');assert.ok(laterPassenger.boardedAt>=70);
const past=T.create(42,'B');past.seek(40);
const unchanged=structuredClone(past.state);
assert.equal(past.reserve({origin:'park',destination:'hospital',readyAt:39,deadline:180}).ok,false);
assert.deepEqual(past.state,unchanged);
console.log('Requested pickup time tests passed: later pickup, no early boarding, past time rejected');
