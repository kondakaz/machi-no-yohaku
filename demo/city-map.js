/* CityMap: dependency-free illustrated map for the BusSim demo. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CityMap = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var nodes = {
    station: { id: 'station', name: '駅', x: 380, y: 220 },
    homeA: { id: 'homeA', name: '住宅地A', x: 110, y: 105 },
    homeB: { id: 'homeB', name: '住宅地B', x: 115, y: 355 },
    hospital: { id: 'hospital', name: '病院', x: 580, y: 90 },
    mall: { id: 'mall', name: '商業施設', x: 640, y: 325 },
    park: { id: 'park', name: '公園', x: 360, y: 405 }
  };
  var nodeList = Object.keys(nodes).map(function (id) { return nodes[id]; });
  var host = typeof globalThis !== 'undefined' ? globalThis : {};
  // Orthogonal main streets; narrow background lanes are scenery only.
  var roads = {
    'homeA|station': [[110,105],[110,160],[380,160],[380,220]],
    'homeB|station': [[115,355],[115,280],[380,280],[380,220]],
    'hospital|station': [[380,220],[500,220],[500,90],[580,90]],
    'mall|station': [[380,220],[640,220],[640,325]],
    'park|station': [[380,220],[380,350],[360,350],[360,405]],
    'homeA|hospital': [[110,105],[110,90],[580,90]],
    'homeB|park': [[115,355],[115,405],[360,405]],
    'mall|park': [[360,405],[640,405],[640,325]],
    'hospital|mall': [[580,90],[640,90],[640,325]]
  };
  var colors = ['#287959', '#557daf'];
  var previous = {};

  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function key(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  function points(a, b) {
    var p = roads[key(a, b)] || [[nodes[a].x, nodes[a].y], [nodes[b].x, nodes[b].y]];
    // Keys are sorted for lookup only; their authored point direction is not.
    return p[0][0] === nodes[a].x && p[0][1] === nodes[a].y ? p : p.slice().reverse();
  }
  function lineLength(p) { var n = 0, i; for (i = 1; i < p.length; i++) n += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return n; }
  function onLine(p, fraction) {
    var total = lineLength(p), target = Math.max(0, Math.min(1, Number(fraction) || 0)) * total, seen = 0, i, d, t;
    for (i = 1; i < p.length; i++) { d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (seen + d >= target || i === p.length - 1) { t = d ? (target - seen) / d : 0; return { x: p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, y: p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t, angle: Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0]) * 180 / Math.PI }; } seen += d; }
    return { x: p[0][0], y: p[0][1], angle: 0 };
  }
  function position(bus) {
    var edge = bus && bus.edge;
    if (!edge) { var n = nodes[bus && bus.node] || nodes.station; return { x: n.x, y: n.y, angle: 0 }; }
    return onLine(points(edge.from, edge.to), (Number(edge.elapsed) || 0) / Math.max(1, Number(edge.duration) || 1));
  }
  function poly(p) { return p.map(function (q) { return q[0] + ',' + q[1]; }).join(' '); }
  function roadPath(p) { return 'M' + p.map(function (q, i) { return (i ? ' L' : '') + q[0] + ' ' + q[1]; }).join(''); }
  function offsetPoint(n, i) { var a = -Math.PI / 2 + i * 0.72, r = 28 + Math.floor(i / 3) * 13; return { x: n.x + Math.cos(a) * r, y: n.y + Math.sin(a) * r }; }
  function stateBus(s, id, fallback) { return (s && s.buses || []).filter(function (b) { return b.id === id; })[0] || (s && s.buses || [])[fallback]; }
  function edgeFraction(edge) { return (Number(edge.elapsed) || 0) / Math.max(1, Number(edge.duration) || 1); }
  function roadSlice(edge, from, to) {
    var p = points(edge.from, edge.to), total = lineLength(p), start = edgeFraction(edge), end = edgeFraction(to.edge || edge), seen = 0, d, result = [from], i;
    for (i = 1; i < p.length; i++) { d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); seen += d; if (seen / total > start && seen / total < end) result.push({ x: p[i][0], y: p[i][1] }); }
    result.push(to); return result;
  }
  function trace(states, bus, index) {
    var snapshots = (states || []).map(function (s) { return stateBus(s, bus.id, index); }).filter(Boolean), result = [], i, a, b, ap, bp, segment;
    for (i = 0; i < snapshots.length; i++) {
      if (!i) { result.push(position(snapshots[i])); continue; }
      a = snapshots[i - 1]; b = snapshots[i]; ap = position(a); bp = position(b);
      if (a.edge && b.edge && a.edge.from === b.edge.from && a.edge.to === b.edge.to) segment = roadSlice(a.edge, ap, { x: bp.x, y: bp.y, edge: b.edge });
      else if (a.edge && (!b.edge || b.edge.from === a.edge.to)) segment = roadSlice(a.edge, ap, { x: nodes[a.edge.to].x, y: nodes[a.edge.to].y, edge: { elapsed: a.edge.duration, duration: a.edge.duration } }).concat(b.edge ? roadSlice(b.edge, { x: nodes[b.edge.from].x, y: nodes[b.edge.from].y }, { x: bp.x, y: bp.y, edge: b.edge }).slice(1) : []);
      else segment = [ap, bp];
      result = result.concat(segment.slice(1));
    }
    return result;
  }
  function motionOnRoad(oldBus, bus, oldPos, pos) {
    var a = oldBus && oldBus.edge, b = bus && bus.edge;
    if (!a || !b || a.from !== b.from || a.to !== b.to) return null;
    return roadSlice(a, oldPos, { x: pos.x, y: pos.y, edge: b }).map(function (q, i) { return (i ? ' L' : 'M') + q.x.toFixed(2) + ' ' + q.y.toFixed(2); }).join('');
  }
  function busGlyph(bus, i, pos, animate) {
    var color = colors[i % colors.length], label = bus.number || String(i + 1), riders = (bus.onboard || []).length;
    var motion = animate ? '<animateMotion begin="indefinite" dur="0.16s" path="' + esc(animate) + '" fill="freeze"/>' : '';
    return '<g' + (animate ? '' : ' transform="translate(' + pos.x.toFixed(2) + ' ' + pos.y.toFixed(2) + ')"') + ' aria-label="バス' + esc(label) + ' 乗車' + riders + '人">' + motion + '<g transform="rotate(' + pos.angle.toFixed(1) + ')">' +
      '<rect x="-18" y="-10" width="36" height="20" rx="5" fill="' + color + '" stroke="#fff" stroke-width="2"/>' +
      '<rect x="-10" y="-7" width="15" height="6" rx="1.5" fill="#d8eef0"/><rect x="7" y="-7" width="6" height="6" rx="1.5" fill="#d8eef0"/>' +
      '<circle cx="-10" cy="11" r="3" fill="#263b42"/><circle cx="10" cy="11" r="3" fill="#263b42"/>' +
      '<text x="0" y="5" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">' + esc(label) + ' · ' + riders + '</text></g></g>';
  }
  function render(state, options) {
    state = state || { buses: [], people: [], time: 0 }; options = options || {};
    var out = '<title>京都の碁盤の目をイメージした架空の街。バスは主要道路を走行します。</title><rect width="760" height="500" fill="#ecebe5"/>';
    var streets = [];
    [40,110,180,245,310,380,440,500,570,640,733].forEach(function(x){streets.push([[x,0],[x,500]]);});
    [35,90,160,220,280,350,405,465].forEach(function(y){streets.push([[0,y],[760,y]]);});
    var allRoads=streets.concat(Object.keys(roads).map(function(k){return roads[k];}));
    function nearRoad(x,y){return allRoads.some(function(p){return p.slice(1).some(function(q,i){var a=p[i];return x>=Math.min(a[0],q[0])-14&&x<=Math.max(a[0],q[0])+14&&y>=Math.min(a[1],q[1])-14&&y<=Math.max(a[1],q[1])+14;});});}
    // Small roof footprints fill real street blocks, leaving roads and landmarks clear.
    for(var x=8;x<752;x+=19)for(var y=8;y<493;y+=18){
      if(nearRoad(x+7,y+6)||x>665&&x<716||x>315&&x<425&&y>360&&y<450||x>180&&x<300&&y>30&&y<85)continue;
      var tone=['#d7d2c8','#ded9ce','#cecfc8','#e0d5c7'][(x*3+y)%4];
      out+='<rect x="'+x+'" y="'+y+'" width="14" height="12" rx="1" fill="'+tone+'" stroke="#c5c3ba" stroke-width=".5"/><path d="M'+(x+2)+' '+(y+3)+'h10" stroke="#efede7" stroke-width="1"/>';
    }
    streets.forEach(function(p){out+='<path d="'+roadPath(p)+'" fill="none" stroke="#d9d8d0" stroke-width="9"/><path d="'+roadPath(p)+'" fill="none" stroke="#faf9f4" stroke-width="7"/>';});
    out+='<path d="M694-20 Q674 150 694 260 T690 520" fill="none" stroke="#c9dcc5" stroke-width="44"/><path d="M694-20 Q674 150 694 260 T690 520" fill="none" stroke="#a8d1d9" stroke-width="28"/><path d="M693 0Q677 150 695 260T689 500" fill="none" stroke="#c6e3e8" stroke-width="2"/>';
    [90,220,350,465].forEach(function(y){out+='<path d="M662 '+y+'h57" stroke="#b5bab4" stroke-width="13"/><path d="M661 '+y+'h59" stroke="#f9f8f1" stroke-width="9"/>';});
    Object.keys(roads).forEach(function(k){out+='<path d="'+roadPath(roads[k])+'" fill="none" stroke="#cdcfc8" stroke-width="18" stroke-linejoin="round"/>';});
    Object.keys(roads).forEach(function(k){out+='<path d="'+roadPath(roads[k])+'" fill="none" stroke="#fffefa" stroke-width="14" stroke-linejoin="round"/>';});
    // Crosswalks and avenue labels anchor the transport layer in a city street map.
    [110,380,500,640].forEach(function(x){[90,220,280,405].forEach(function(y){out+='<path d="M'+(x-5)+' '+(y+13)+'h10m-10 3h10m-10 3h10" stroke="#bec5bf" stroke-width="1.5"/>';});});
    out+='<g font-size="8" fill="#92958b" letter-spacing="2"><text x="220" y="86">北山通</text><text x="270" y="216">御池通</text><text x="170" y="276">四条通</text><text x="450" y="401">七条通</text><text x="705" y="260" transform="rotate(90 705 260)">鴨川をイメージした川</text><text x="450" y="148">中京エリア</text><text x="170" y="338">下京エリア</text></g>';
    out+='<g><rect x="190" y="43" width="107" height="36" rx="4" fill="#d6dec7"/><rect x="216" y="49" width="53" height="21" fill="#b9a999"/><path d="M208 53h68M216 47h53" stroke="#85766a" stroke-width="4"/><text x="243" y="77" text-anchor="middle" font-size="7" fill="#646f59">寺町の寺院</text></g>';
    out+='<rect x="319" y="365" width="102" height="82" rx="6" fill="#d2dfc0"/><path d="M325 435L411 377M325 377L411 435" stroke="#ede5c9" stroke-width="4"/>';
    for(var i=0;i<12;i++){var tx=327+(i%4)*27,ty=373+Math.floor(i/4)*32;out+='<circle cx="'+tx+'" cy="'+ty+'" r="5" fill="#a3bd8d"/>';}
    out+='<g><rect x="518" y="44" width="76" height="30" rx="3" fill="#e1e5e4" stroke="#b4c0be"/><path d="M554 49v18m-9-9h18" stroke="#c17e79" stroke-width="4"/><rect x="585" y="293" width="39" height="42" rx="2" fill="#dfd0b5" stroke="#b9ac96"/><path d="M591 300h27m-27 8h27m-27 8h27" stroke="#f7ead2" stroke-width="4"/></g>';
    out+='<path d="M20 244H465" stroke="#bbc1ba" stroke-width="8"/><path d="M20 244H465" stroke="#f5f4ed" stroke-width="5" stroke-dasharray="2 4"/><rect x="326" y="234" width="87" height="20" rx="3" fill="#abbab7"/><text x="369" y="247" text-anchor="middle" font-size="9" fill="white">まちの中央駅</text>';
    nodeList.forEach(function(n){var f=host.BusSim?host.BusSim.forecast(n.id,state.time||0):0;var r=18+Math.sqrt(Math.max(0,f))*14;out+='<circle cx="'+n.x+'" cy="'+n.y+'" r="'+r+'" fill="#86b96d" fill-opacity=".10" stroke="#80a66e" stroke-opacity=".5" stroke-dasharray="3 5"/>';});
    out+='<g transform="translate(16 16)"><rect width="143" height="23" rx="5" fill="white" fill-opacity=".94"/><text x="10" y="15" font-size="9" fill="#65716a">京都風の架空マップ · 北 ↑</text></g>';
    // Reference lines draw at exact road positions, then the bus covers the current point.
    [{ list: options.past, stroke: '#9ab2a8', width: 2, dash: '' }, { list: options.before, stroke: '#8f9695', width: 3, dash: '7 6' }, { list: options.future, stroke: null, width: 4, dash: '9 6' }].forEach(function (layer) { (state.buses || []).forEach(function (b, i) { var pts = trace(layer.list, b, i); if (pts.length > 1) out += '<polyline points="' + pts.map(function (q) { return q.x.toFixed(1) + ',' + q.y.toFixed(1); }).join(' ') + '" fill="none" stroke="' + (layer.stroke || colors[i % colors.length]) + '" stroke-width="' + layer.width + '" stroke-opacity=".72" stroke-dasharray="' + layer.dash + '" stroke-linecap="round"/>'; }); });
    nodeList.forEach(function (n) { out += '<g transform="translate(' + n.x + ' ' + n.y + ')"><circle r="13" fill="#fff" stroke="#638b71" stroke-width="3"/><circle r="4" fill="#497b61"/><text y="-21" text-anchor="middle" font-size="12" font-weight="700" fill="#40584a" stroke="#fff" stroke-width="3" paint-order="stroke">' + esc(n.name) + '</text></g>'; });
    nodeList.forEach(function (n) {
      var waiting=(state.people||[]).filter(function(p){return p.status==='waiting'&&p.node===n.id;});
      var x=n.x>500?n.x-112:n.x+20,y=Math.max(20,Math.min(n.y+16,482-waiting.length*21));
      waiting.forEach(function(p,i){
        var reserved=p.kind==='registered',color=reserved?'#5279ad':'#bd8639';
        out+='<g class="map-waiter" data-person="'+esc(p.id)+'" transform="translate('+x+' '+(y+i*21)+')"><rect width="94" height="19" rx="6" fill="'+(reserved?'#edf3ff':'#fff3df')+'" stroke="'+(reserved?'#a5bddb':'#e1bc85')+'"/><circle cx="10" cy="5" r="3" fill="'+color+'"/><path d="M6 15v-4q4-5 8 0v4" fill="'+color+'"/><text x="19" y="13" font-size="11" fill="'+color+'">'+esc(reserved?p.name:'未予約で待機')+'</text></g>';
      });
    });
    (state.buses || []).forEach(function (b, i) { var pos = position(b), old = previous[b.id], animate = '', draw = pos; var dt = old && Number(state.time) - Number(old.time); if (old && dt >= 1 && dt <= 3 && Math.hypot(pos.x - old.pos.x, pos.y - old.pos.y) < 180) { animate = motionOnRoad(old.bus, b, old.pos, pos); if (animate) draw = old.pos; } out += busGlyph(b, i, draw, animate); previous[b.id] = { time: state.time, pos: pos, bus: { edge: b.edge && { from: b.edge.from, to: b.edge.to, elapsed: b.edge.elapsed, duration: b.edge.duration } } }; });
    (state.people || []).filter(function (p) { return p.status === 'onboard' && Number(state.time) - Number(p.boardedAt) <= 2; }).forEach(function (p, i) { var b = (state.buses || []).filter(function (q) { return (q.onboard || []).indexOf(p.id) >= 0; })[0]; if (b) { var q = position(b); out += '<g transform="translate(' + (q.x + 18) + ' ' + (q.y - 24 - i * 16) + ')"><rect width="54" height="14" rx="7" fill="#fff" stroke="#8bb895"/><text x="27" y="10" text-anchor="middle" font-size="8" fill="#3e7655">乗車しました</text></g>'; } });
    return out;
  }
  return { render: render, position: position };
}));
