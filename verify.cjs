const assert=require('node:assert/strict');const S=require('./demo/engine.js');
let walkinArrivals=0,extensions=0,results=[];
for(let seed=1;seed<=30;seed++)for(const mode of ['A','B']){
 const s=S.create(seed,mode),again=S.create(seed,mode);const stayed=new Map();
 for(let t=0;t<180;t++){
  const prev=structuredClone(s);S.step(s);S.step(again);
  for(const b of s.buses){const old=prev.buses.find(x=>x.id===b.id);assert.ok(b.onboard.length<=4);assert.equal(new Set(b.onboard).size,b.onboard.length);if(old.node!==b.node){assert.ok(old.edge,'a node change requires prior road travel');assert.equal(old.edge.to,b.node);assert.ok(old.edge.elapsed+1>=old.edge.duration)}for(const id of b.onboard)assert.equal(s.people.find(p=>p.id===id).status,'onboard')}
  for(const p of s.people){const old=prev.people.find(x=>x.id===p.id);if(p.status==='done'&&old.status!=='done'){assert.equal(p.node,p.kind==='walkin'?p.destination:p.origin,'completion requires true destination');if(p.kind==='walkin'){walkinArrivals++;assert.ok(old.status==='onboard'||prev.buses.some(b=>b.onboard.includes(p.id)))}else assert.ok((stayed.get(p.id)||0)>=p.visits.length,'every visit includes a stay')}
   if(p.status==='staying'&&old.status!=='staying')stayed.set(p.id,(stayed.get(p.id)||0)+1);
   if(old.status==='staying'&&s.time<old.readyAt)assert.equal(p.status,'staying','must remain for full stay');
   if(p.status==='onboard')assert.equal(s.buses.filter(b=>b.onboard.includes(p.id)).length,1);
  }
 }
 assert.deepEqual(S.metrics(s),S.metrics(again));const before=structuredClone(s);S.step(s);assert.deepEqual(s,before,'end time is immutable');results.push({seed,mode,...S.metrics(s)});
 const e=S.create(seed,mode);for(let t=0;t<160;t++){S.step(e);const p=e.people.find(p=>p.status==='staying'&&p.readyAt-e.time>10);if(p){const ready=p.readyAt,deadline=p.deadline;const response=S.extend(e,p.id);if(response.ok){assert.equal(p.readyAt,ready+30);assert.equal(p.deadline,deadline);extensions++}break}}
}
assert.ok(walkinArrivals>0,'actual walkins arrive');assert.ok(extensions>0,'extensions work');console.log(JSON.stringify({runs:results.length,walkinArrivals,extensions,sample:results.slice(0,4)},null,2));
