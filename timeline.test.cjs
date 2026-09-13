const assert=require('node:assert/strict');
const T=require('./demo/timeline.js'),S=require('./demo/engine.js');
for(const mode of ['A','B']){
 const reference=S.create(42,mode),snapshots=[structuredClone(reference)];
 for(let t=0;t<180;t++){S.step(reference);snapshots.push(structuredClone(reference));}
 const timeline=T.create(42,mode);
 for(const minute of [180,0,1,20,90,45,179,180,0])assert.deepEqual(timeline.seek(minute),snapshots[minute]);
 assert.equal(timeline.seek(-8).time,0);assert.equal(timeline.seek(200).time,180);
}
const edited=T.create(42,'B');edited.seek(20);
assert.equal(edited.extend('r1').ok,true);
const at20=structuredClone(edited.state),final=structuredClone(edited.seek(180));
assert.deepEqual(edited.seek(20),at20,'scrubbing preserves edits at their original minute');
assert.deepEqual(edited.seek(180),final,'replaying does not apply an extension twice');
edited.seek(35);assert.equal(edited.extend('r1').ok,true);edited.seek(180);
edited.seek(20);assert.equal(edited.extend('r1').ok,true);
const fresh=T.create(42,'B');fresh.seek(20);fresh.extend('r1');fresh.extend('r1');
assert.deepEqual(edited.seek(180),fresh.seek(180),'editing the past replaces the previous future');
const original=structuredClone(edited.state);assert.equal(edited.extend('w1').ok,false);assert.deepEqual(edited.state,original);
console.log('Timeline tests passed: seek, replay, preserved edits, branching, bounds');
