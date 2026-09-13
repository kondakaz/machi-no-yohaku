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
  // Every graph edge has its own deliberately curved centre line.  Endpoints
  // remain the engine coordinates, so a vehicle can never leave its road.
  var roads = {
    'homeA|station': [[110,105],[190,82],[275,145],[380,220]],
    'homeB|station': [[115,355],[205,385],[300,300],[380,220]],
    'hospital|station': [[380,220],[435,170],[505,160],[580,90]],
    'mall|station': [[380,220],[470,245],[550,300],[640,325]],
    'park|station': [[380,220],[330,285],[320,350],[360,405]],
    'homeA|hospital': [[110,105],[235,45],[410,52],[580,90]],
    'homeB|park': [[115,355],[190,430],[280,450],[360,405]],
    'mall|park': [[360,405],[450,438],[555,410],[640,325]],
    'hospital|mall': [[580,90],[670,150],[690,245],[640,325]]
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
    var out = '<title>オンデマンドバスの街路マップ</title><rect width="760" height="500" fill="#f7f5eb"/>';
    out += '<g opacity=".72"><path d="M20 470 L70 430 L38 382 M700 22 L730 68 L710 114" fill="none" stroke="#dce7d2" stroke-width="28" stroke-linecap="round"/><path d="M20 470 L70 430 L38 382 M700 22 L730 68 L710 114" fill="none" stroke="#fff" stroke-width="19" stroke-linecap="round"/></g>';
    // Demand stays behind the transport network.
    nodeList.forEach(function (n) { var f = state.forecast && state.forecast[n.id]; if (f == null && host.BusSim && host.BusSim.forecast) f = host.BusSim.forecast(n.id, state.time || 0); f = Number(f) || 0; var r = 18 + Math.sqrt(Math.max(0, f)) * 14; out += '<circle cx="' + n.x + '" cy="' + n.y + '" r="' + r.toFixed(1) + '" fill="#bad58d" opacity=".12" stroke="#91ae73" stroke-dasharray="3 5"/><text x="' + n.x + '" y="' + Math.min(486, n.y + r + 12) + '" text-anchor="middle" font-size="9" fill="#8a9f78">予測 ' + f.toFixed(1) + '人</text>'; });
    Object.keys(roads).forEach(function (k) { var p = roads[k]; out += '<polyline points="' + poly(p) + '" fill="none" stroke="#bdc4bd" stroke-width="25" stroke-linejoin="round"/><polyline points="' + poly(p) + '" fill="none" stroke="#ffffff" stroke-width="17" stroke-linejoin="round"/><polyline points="' + poly(p) + '" fill="none" stroke="#e8c97a" stroke-width="1.5" stroke-dasharray="8 7"/>'; });
    out += '<g stroke="#fff" stroke-width="3" opacity=".95"><path d="M365 207v11m5-11v11m5-11v11m5-11v11m5-11v11m5-11v11"/><path d="M395 227l10-5m3 4l10-5m3 4l10-5m3 4l10-5"/><path d="M625 310v12m5-12v12m5-12v12m5-12v12m5-12v12"/></g>';
    // Compact street blocks make the empty parcels read as a lived-in town.
    out += '<defs><g id="cm-house"><rect x="0" y="5" width="17" height="12" rx="1" fill="#f2d7bd" stroke="#bd916f"/><path d="M-2 5L8.5-2 19 5" fill="#d77861" stroke="#aa5b4b"/><rect x="7" y="11" width="4" height="6" fill="#89a4a3"/></g><g id="cm-shop"><rect x="0" y="4" width="22" height="15" rx="1" fill="#e9c96d" stroke="#b78e43"/><path d="M-1 5h24" stroke="#f4eee0" stroke-width="4"/><rect x="4" y="11" width="5" height="8" fill="#82a6ae"/></g></defs>';
    out += '<g opacity=".96"><path d="M62 185h163v84H62zM252 92h184v31H252zM486 190h126v51H486zM404 331h104v43H404z" fill="#e7ecd9" stroke="#c5d1b7" stroke-width="2"/><path d="M70 225h145M145 190v73M265 108h156M495 216h108M415 353h82" fill="none" stroke="#fff" stroke-width="5"/><path d="M70 225h145M145 190v73M265 108h156M495 216h108M415 353h82" fill="none" stroke="#c6cfc3" stroke-width="1"/></g>';
    out += '<g>' + [[76,193],[102,197],[128,192],[157,197],[184,192],[78,235],[105,240],[169,237],[196,241]].map(function (q) { return '<use href="#cm-house" transform="translate(' + q[0] + ' ' + q[1] + ')"/>'; }).join('') + [[266,94],[294,97],[323,92],[353,97],[383,92],[411,96]].map(function (q) { return '<use href="#cm-house" transform="translate(' + q[0] + ' ' + q[1] + ') scale(.82)"/>'; }).join('') + [[496,194],[525,197],[555,193],[583,199],[500,224],[533,222],[567,225]].map(function (q, i) { return '<use href="#' + (i % 3 ? 'cm-house' : 'cm-shop') + '" transform="translate(' + q[0] + ' ' + q[1] + ') scale(.82)"/>'; }).join('') + [[414,334],[440,338],[468,333],[490,341],[415,359],[448,358],[478,361]].map(function (q, i) { return '<use href="#' + (i % 2 ? 'cm-shop' : 'cm-house') + '" transform="translate(' + q[0] + ' ' + q[1] + ') scale(.82)"/>'; }).join('') + '</g>';
    out += '<g fill="#78a965" stroke="#5d8c53" stroke-width="1">' + [[68,177],[216,180],[232,260],[250,127],[438,119],[478,243],[615,235],[400,326],[512,374]].map(function (q) { return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="6"/>'; }).join('') + '</g>';
    // rail station, blocks, hospital, mall and park are compact map landmarks.
    out += '<g opacity=".9"><path d="M333 180 L333 255 M347 180 L347 255" stroke="#59656d" stroke-width="3"/><path d="M326 185 L355 185 M326 202 L355 202 M326 219 L355 219 M326 236 L355 236" stroke="#89939a" stroke-width="2"/></g>';
    out += '<g fill="#d98968" stroke="#a85f4d" stroke-width="1"><path d="M53 92h30v22H53zM87 119h33v20H87zM135 65h31v23h-31zM66 332h30v23H66zM127 382h34v22h-34zM167 347h28v20h-28z"/><path d="M48 92l20-14 20 14M82 119l21-14 21 14M130 65l20-14 20 14M61 332l20-14 20 14M122 382l22-14 22 14M162 347l19-13 19 13" fill="#d46f58"/></g>';
    out += '<g transform="translate(300 245)"><rect x="-29" y="-18" width="44" height="27" rx="3" fill="#dce9e8" stroke="#788f91"/><path d="M-24 2h34" stroke="#77958e" stroke-width="3"/><text x="-7" y="-5" text-anchor="middle" font-size="8" fill="#40584a">STATION</text></g><g transform="translate(620 57)"><rect x="-27" y="-20" width="54" height="40" rx="4" fill="#f3f7f7" stroke="#a8b9b7"/><path d="M-5-13v26M-13 0h26" stroke="#dd625c" stroke-width="7"/></g><g transform="translate(690 358)"><rect x="-34" y="-23" width="68" height="46" rx="5" fill="#edc66b" stroke="#bd9442"/><path d="M-25-8h50M-25 4h50" stroke="#fff0bd" stroke-width="5"/></g>';
    out += '<g transform="translate(360 405)"><path d="M-49 28 Q-10-14 43 22" fill="none" stroke="#d9bd89" stroke-width="7"/>' + [-34,-9,19,42].map(function (x, i) { return '<circle cx="' + x + '" cy="' + (-8 - (i % 2) * 9) + '" r="13" fill="#78a965"/><rect x="' + (x - 2) + '" y="2" width="4" height="13" fill="#856a43"/>'; }).join('') + '</g>';
    // Reference lines draw at exact road positions, then the bus covers the current point.
    [{ list: options.past, stroke: '#9ab2a8', width: 2, dash: '' }, { list: options.before, stroke: '#8f9695', width: 3, dash: '7 6' }, { list: options.future, stroke: null, width: 4, dash: '9 6' }].forEach(function (layer) { (state.buses || []).forEach(function (b, i) { var pts = trace(layer.list, b, i); if (pts.length > 1) out += '<polyline points="' + pts.map(function (q) { return q.x.toFixed(1) + ',' + q.y.toFixed(1); }).join(' ') + '" fill="none" stroke="' + (layer.stroke || colors[i % colors.length]) + '" stroke-width="' + layer.width + '" stroke-opacity=".72" stroke-dasharray="' + layer.dash + '" stroke-linecap="round"/>'; }); });
    nodeList.forEach(function (n) { out += '<g transform="translate(' + n.x + ' ' + n.y + ')"><circle r="13" fill="#fff" stroke="#638b71" stroke-width="3"/><circle r="4" fill="#497b61"/><text y="-21" text-anchor="middle" font-size="12" font-weight="700" fill="#40584a">' + esc(n.name) + '</text></g>'; });
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
