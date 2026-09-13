'use strict';
const S=window.BusSim,$=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let mode='B',state,timeline,timer=null,beforePlan=null;const node=id=>S.nodes.find(n=>n.id===id),name=id=>node(id)?.name??id;const fmt=t=>`${String(9+Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
function stop(){clearInterval(timer);timer=null;$('play').textContent='▶ 再生'}
function reset(){stop();beforePlan=null;timeline=window.BusTimeline.create(Number($('seed').value)||42,mode);state=timeline.state;$('comparison').hidden=true;$('reservationNotice').textContent='「9:40の実演へ」→ 公園から病院を予約 → 再生。追加予約は登録者の集計に加わります。';$('notice').textContent='再生して滞在が始まると、「あと30分」を試せます。';render()}
function advance(n){state=timeline.advance(n);if(state.time>=180)stop();render()}
function seek(minute){stop();beforePlan=null;state=timeline.seek(minute);render()}
function renderMap(){
const future=timeline.preview(15),past=timeline.past(15);
const before=beforePlan&&state.time>=beforePlan[0].time?beforePlan.filter(s=>s.time>=state.time):null;
$('map').innerHTML=window.CityMap.render(state,{past,future,before});
$('map').querySelectorAll('animateMotion').forEach(animation=>animation.beginElement());
$('routeWindow').textContent=`実績 ${fmt(Math.max(0,state.time-15))}〜${fmt(state.time)} / 予定 ${fmt(state.time)}〜${fmt(Math.min(180,state.time+15))}`;
$('beforeLegend').hidden=!before?.length;
$('planCards').innerHTML=state.buses.map((bus,i)=>{
const stops=[];let at=bus.node;
for(const snapshot of future){const b=snapshot.buses[i];if(b.node!==at){stops.push(`${fmt(snapshot.time)} ${esc(name(b.node))}`);at=b.node;}}
const oldStops=[];let oldAt=before?.[0]?.buses[i]?.node;
for(const snapshot of before||[]){const b=snapshot.buses[i];if(b.node!==oldAt){oldStops.push(`${fmt(snapshot.time)} ${esc(name(b.node))}`);oldAt=b.node;}}
return `<div class="plan-card"><b style="color:${i?'#557daf':'#287959'}">バス${i+1} / 今後15分</b><span>${stops.join(' → ')||'この時間帯の停留所到着予定はありません'}</span>${before?.length?`<small>変更前：${oldStops.join(' → ')||'この時間帯の停留所到着予定なし'}</small>`:''}</div>`;
}).join('');
}
const statuses={pending:'出発前',waiting:'迎え待ち',onboard:'乗車中',staying:'滞在中',done:'完了',missed:'未割当／期限超過'};
function render(){const m=S.metrics(state),registeredTotal=state.people.filter(p=>p.kind==='registered').length;$('modeA').classList.toggle('selected',mode==='A');$('modeB').classList.toggle('selected',mode==='B');$('modeTitle').textContent=mode==='A'?'A 予定のみ':'B 予定＋需要予測';$('clock').textContent=fmt(state.time);$('timeSlider').value=state.time;$('timeSlider').setAttribute('aria-valuetext',fmt(state.time));$('timeSlider').style.setProperty('--elapsed',`${state.time/180*100}%`);$('phase').textContent=state.time>=180?'12:00 最終結果':'途中経過';$('play').disabled=state.time>=180;$('step').disabled=state.time>=180;$('reservationSubmit').disabled=state.time>=180;$('population').textContent=state.people.length;
$('stats').innerHTML=[['登録者の予定達成',m.registered,`/ ${registeredTotal}人`,registeredTotal],['未予約者の移動達成',m.walkin,'/ 5人',5],['総走行距離',Number(m.distance).toFixed(1),'km',false]].map(([label,v,unit,bar])=>`<div class="stat"><div class="stat-label">${label}</div><div class="stat-value"><b>${v}</b><span>${unit}${bar?` · ${Math.round(Number(v)/bar*100)}%`:''}</span></div>${bar?`<div class="bar"><div style="width:${Math.round(Number(v)/bar*100)}%"></div></div>`:''}</div>`).join('');
$('busCards').innerHTML=state.buses.map((b,i)=>`<div class="bus-card"><b style="color:${i?'#557daf':'#287959'}">● バス${i+1}</b>${b.onboard.length} / 4席<br>${b.edge?`${esc(name(b.edge.from))} → ${esc(name(b.edge.to))}`:`${esc(name(b.node))} に停車`}<br><span class="muted" style="margin:0">次の経由地：${(b.route||[]).slice(0,4).map(x=>esc(name(x))).join(' → ')||'待機'}</span></div>`).join('');
$('logs').innerHTML=state.logs.slice(-8).reverse().map(l=>`<div>${esc(typeof l==='string'?l.replace(/^\[(\d+)\]/,(_,t)=>fmt(Number(t))):JSON.stringify(l))}</div>`).join('')||'<div>再生すると運行記録がここに表示されます。</div>';
$('people').innerHTML=state.people.filter(p=>p.kind==='registered').map(p=>`<article class="person"><h3>${esc(p.name||p.id)}</h3><span class="status">${p.unassigned&&['pending','waiting','staying'].includes(p.status)?'未割当':statuses[p.status]||esc(p.status)}</span><p>${(p.oneWay?[p.origin,p.destination]:[p.origin,...p.visits,p.origin]).map(x=>esc(name(x))).join(' → ')}</p><div>${p.oneWay?'到着期限':'帰着期限'} ${fmt(p.deadline)}</div><div>${p.status==='staying'?`次の出発可能 ${fmt(p.readyAt)}`:`現在地 ${esc(p.status==='onboard'?'車内':name(p.node))}`}</div><button data-extend="${esc(p.id)}" ${p.status!=='staying'||state.time>=180?'disabled':''}>あと30分</button></article>`).join('');$('walkins').innerHTML=state.people.filter(p=>p.kind==='walkin').map(p=>`<div class="walkin"><b>${esc(p.name)}</b><span>${p.status==='pending'?'まだ発生していません':`${esc(name(p.origin))} → ${esc(name(p.destination))}`}</span><span class="status">${p.unassigned&&['pending','waiting','staying'].includes(p.status)?'未割当':statuses[p.status]||esc(p.status)}</span></div>`).join('');renderMap()}
$('people').addEventListener('click',e=>{const b=e.target.closest('[data-extend]');if(!b)return;stop();beforePlan=timeline.preview();const r=timeline.extend(b.dataset.extend);state=timeline.state;$('notice').textContent=r.message+(r.ok?'。この時刻から先の運行を再計算します。':'');render()});
$('play').onclick=()=>{if(timer)return stop();$('play').textContent='Ⅱ 一時停止';timer=setInterval(()=>advance(Number($('speed').value)),180)};$('step').onclick=()=>{stop();advance(10)};$('reset').onclick=reset;$('modeA').onclick=()=>{mode='A';reset()};$('modeB').onclick=()=>{mode='B';reset()};
$('compare').onclick=()=>{stop();const seed=Number($('seed').value)||42;const a=S.create(seed,'A'),b=S.create(seed,'B');for(let i=0;i<180;i++){S.step(a);S.step(b)}const am=S.metrics(a),bm=S.metrics(b);const c=$('comparison');c.hidden=false;c.innerHTML=`<div class="panel-head"><b>同じ条件、2つの運行。</b><span class="tag">シード ${seed} / 追加予約・予定変更なし / 12:00</span></div><table><thead><tr><th>評価指標</th><th>A 予定のみ</th><th>B ＋需要予測</th></tr></thead><tbody><tr><td>登録者の予定達成率</td><td>${am.registered*20}%（${am.registered}/5人）</td><td>${bm.registered*20}%（${bm.registered}/5人）</td></tr><tr><td>未予約者の移動達成率</td><td>${am.walkin*20}%（${am.walkin}/5人）</td><td>${bm.walkin*20}%（${bm.walkin}/5人）</td></tr><tr><td>総走行距離</td><td>${Number(am.distance).toFixed(1)} km</td><td>${Number(bm.distance).toFixed(1)} km</td></tr>${S.nodes.map(n=>`<tr><td>${esc(n.name)} 発の未予約・未達人数</td><td>${am.unmet[n.name]??am.unmet[n.id]??0}人</td><td>${bm.unmet[n.name]??bm.unmet[n.id]??0}人</td></tr>`).join('')}</tbody></table><p class="note">B−A：未予約の到着 ${bm.walkin-am.walkin>=0?'+':''}${bm.walkin-am.walkin}人 / 走行距離 ${(bm.distance-am.distance).toFixed(1)} km。現在の地図は比較実行前の状態を保持しています。未達人数には終了時点の乗車中・待機中・未発生を含みます。</p>`;c.scrollIntoView({behavior:'smooth',block:'start'})};
$('reserveOrigin').innerHTML=S.nodes.map(n=>`<option value="${n.id}">${esc(n.name)}</option>`).join('');
$('reserveDestination').innerHTML=$('reserveOrigin').innerHTML;
$('reserveOrigin').value='park';$('reserveDestination').value='hospital';
$('demoSetup').onclick=()=>{mode='B';$('seed').value=42;reset();seek(40);$('reserveOrigin').value='park';$('reserveDestination').value='hospital';$('reservationNotice').textContent='9:40にセットしました。色付き破線を見てから「この移動を予約」を押すと、変更前の予定を灰色で残して比較できます。';};
$('reservationForm').onsubmit=e=>{
e.preventDefault();stop();const previous=timeline.preview();
const result=timeline.reserve({origin:$('reserveOrigin').value,destination:$('reserveDestination').value,readyAt:state.time+3,deadline:180});
state=timeline.state;if(result.ok)beforePlan=previous;
$('reservationNotice').textContent=result.message+(result.ok?'。灰色が予約前、色付き破線が予約後の予定です。再生して迎えを確認してください。':'');render();
};
$('timeSlider').addEventListener('input',e=>seek(e.target.value));
reset();window.demo={get state(){return state},advance,seek,reset};
