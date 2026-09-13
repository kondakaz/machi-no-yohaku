const assert=require('node:assert/strict');const S=require('./demo/engine.js'),M=require('./demo/city-map.js');
for(const [a,b,d] of S.edges)for(const [from,to] of [[a,b],[b,a]]){
 const start=S.nodes.find(n=>n.id===from),end=S.nodes.find(n=>n.id===to);
 const first=M.position({node:from,edge:{from,to,elapsed:0,duration:d}});
 const last=M.position({node:from,edge:{from,to,elapsed:d,duration:d}});
 assert.ok(Math.hypot(first.x-start.x,first.y-start.y)<.001,`${from}->${to} starts at its own stop`);
 assert.ok(Math.hypot(last.x-end.x,last.y-end.y)<.001,`${from}->${to} ends at its destination`);
 for(let i=0;i<d;i++){
  const p=M.position({node:from,edge:{from,to,elapsed:i,duration:d}});
  const q=M.position({node:to,edge:{from:to,to:from,elapsed:d-i,duration:d}});
  assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<.001,'both directions follow the same road');
 }
}
const s=S.create(42,'B');S.step(s);s.people.find(p=>p.id==='r1').name='<script>unsafe</script>';
assert.ok(!M.render(s,{}).includes('<script>unsafe</script>'),'names are escaped');
console.log('City map tests passed: all road endpoints/directions, escaped names');
