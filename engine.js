/* BusSim: dependency-free, deterministic demo simulation.
 * Simplification: routing uses a fixed road graph and greedy insertion scoring;
 * it is deliberately not an optimiser. A road-minute is 0.45 km for display.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BusSim = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var nodes = [
    { id: 'station', name: '駅', x: 380, y: 220 },
    { id: 'homeA', name: '住宅地A', x: 110, y: 105 },
    { id: 'homeB', name: '住宅地B', x: 115, y: 355 },
    { id: 'hospital', name: '病院', x: 580, y: 90 },
    { id: 'mall', name: '商業施設', x: 640, y: 325 },
    { id: 'park', name: '公園', x: 360, y: 405 }
  ];
  // [from, to, road minutes]. Roads are usable in both directions.
  var edges = [
    ['station', 'homeA', 8], ['station', 'homeB', 8], ['station', 'hospital', 7],
    ['station', 'mall', 7], ['station', 'park', 6], ['homeA', 'hospital', 8],
    ['homeB', 'park', 7], ['park', 'mall', 7], ['hospital', 'mall', 8]
  ];
  var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });
  var graph = {};
  nodes.forEach(function (n) { graph[n.id] = []; });
  edges.forEach(function (e) { graph[e[0]].push([e[1], e[2]]); graph[e[1]].push([e[0], e[2]]); });

  function rng(seed) { // Mulberry32, accepting strings too.
    var h = 1779033703;
    String(seed == null ? 1 : seed).split('').forEach(function (c) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); });
    return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }
  function path(from, to) {
    var dist = {}, prev = {}, open = [from];
    nodes.forEach(function (n) { dist[n.id] = Infinity; }); dist[from] = 0;
    while (open.length) {
      open.sort(function (a, b) { return dist[a] - dist[b]; });
      var u = open.shift(); if (u === to) break;
      graph[u].forEach(function (e) { var v = e[0], d = dist[u] + e[1]; if (d < dist[v]) { dist[v] = d; prev[v] = u; if (open.indexOf(v) < 0) open.push(v); } });
    }
    var result = [to]; while (result[0] !== from) { if (!prev[result[0]]) return { nodes: [from], minutes: Infinity }; result.unshift(prev[result[0]]); }
    return { nodes: result, minutes: dist[to] };
  }
  function legMinutes(a, b) { return path(a, b).minutes; }
  function personDestination(p) {
    if (p.kind === 'walkin' || p.oneWay) return p.destination;
    return p.returning ? p.origin : p.visits[p.visitIndex];
  }
  function log(s, text) { s.logs.push('[' + String(s.time).padStart(3, '0') + '] ' + text); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function makeRegistered() {
    return [
      ['r1', '佐藤さん', 'homeA', ['hospital'], [25], 0, 130],
      ['r2', '鈴木さん', 'homeB', ['mall', 'park'], [30, 20], 4, 155],
      ['r3', '田中さん', 'homeA', ['station'], [15], 12, 110],
      ['r4', '高橋さん', 'homeB', ['hospital'], [35], 18, 165],
      ['r5', '伊藤さん', 'homeA', ['mall', 'station'], [20, 15], 25, 175]
    ].map(function (x) { return { id: x[0], name: x[1], kind: 'registered', origin: x[2], destination: x[3][0], node: x[2], status: 'pending', readyAt: x[5], deadline: x[6], visits: x[3], stays: x[4], visitIndex: 0, returning: false, planBus: null, locked: false, completedVisits: [], completedStays: [] }; });
  }
  function makeWalkins(random) {
    var origins = ['homeA', 'homeB', 'hospital', 'mall', 'park'];
    return origins.map(function (origin, i) {
      var choices = nodes.map(function (n) { return n.id; }).filter(function (id) { return id !== origin; });
      return { id: 'w' + (i + 1), name: '未予約' + (i + 1), kind: 'walkin', origin: origin, destination: choices[Math.floor(random() * choices.length)], node: origin, status: 'pending', readyAt: 15 + Math.floor(random() * 125), deadline: 0, visits: [], stays: [], visitIndex: 0, planBus: null, locked: false, completedVisits: [], completedStays: [] };
    });
  }
  function create(seed, mode) {
    var random = rng(seed);
    var s = { time: 0, mode: mode === 'A' ? 'A' : 'B', seed: seed == null ? 1 : seed,
      buses: [{ id: 'bus1', node: 'station', edge: null, onboard: [], route: [], distance: 0 }, { id: 'bus2', node: 'station', edge: null, onboard: [], route: [], distance: 0 }],
      people: makeRegistered().concat(makeWalkins(random)), logs: [], boardingChecks: [], capacity: 4, finished: false };
    log(s, '条件生成: mode ' + s.mode + ', seed ' + s.seed);
    return s;
  }
  function forecastIn(state, nodeId, time) {
    // Expected *new* arrivals in [time,time+30), never looks at actual people.
    var i = nodes.map(function (n) { return n.id; }).indexOf(nodeId);
    var wave = Math.floor(time / 30);
    var raw = ((i * 7 + wave * 5) % 9) / 3;
    return Math.round(raw * 10) / 10;
  }
  function forecast(nodeId, time) {
    // Public forecast is intentionally independent of actual waiting people.
    return forecastIn(null, nodeId, time);
  }
  function personById(s, id) { return s.people.filter(function (p) { return p.id === id; })[0]; }
  function waitingAt(s, node, registeredOnly) { return s.people.filter(function (p) { return p.status === 'waiting' && p.node === node && (!registeredOnly || p.kind === 'registered'); }); }
  function pickBusFor(s, p) {
    // Greedy insertion score: current immutable edge/onboard work is retained;
    // candidate pickup is appended after it, and the earliest feasible bus wins.
    var best = null;
    s.buses.forEach(function (b) {
      var anchor = b.edge ? b.edge.to : b.node, extra = legMinutes(anchor, p.node) + legMinutes(p.node, personDestination(p));
      var locked = b.edge ? (b.edge.duration - b.edge.elapsed) : 0;
      // Earlier planned legs form the insertion baseline. This is intentionally
      // greedy, but prevents all future reservations from collapsing on bus1.
      var planned = s.people.filter(function (q) { return q !== p && q.kind === 'registered' && q.planBus === b.id && ['pending', 'staying', 'waiting'].indexOf(q.status) >= 0; })
        .reduce(function (sum, q) { return sum + legMinutes(anchor, q.node) + legMinutes(q.node, personDestination(q)); }, 0);
      var score = locked + planned + extra + b.onboard.length * 3;
      if (!best || score < best.score || (score === best.score && b.id < best.bus.id)) best = { bus: b, score: score };
    });
    return best && best.score <= Math.max(0, p.deadline - s.time) ? best.bus : null;
  }
  function scheduleReservations(s) {
    // Simplification declared: each bus confirms only its *next* pickup.
    // Later registered legs remain soft plans, avoiding mutually impossible
    // simultaneous promises while still preserving the next 10-minute booking.
    s.buses.forEach(function (b) {
      var held = b.confirmedPickupId && personById(s, b.confirmedPickupId);
      if (!held || ['pending', 'staying', 'waiting'].indexOf(held.status) < 0) b.confirmedPickupId = null;
    });
    var active = s.people.filter(function (p) { return p.kind === 'registered' && ['pending', 'staying', 'waiting'].indexOf(p.status) >= 0; })
      .sort(function (a, b) { return a.readyAt - b.readyAt || a.id.localeCompare(b.id); });
    active.forEach(function (p) { if (!p.locked) { var soft = pickBusFor(s, p); if (soft) p.planBus = soft.id; } });
    s.buses.forEach(function (b) {
      if (b.confirmedPickupId) return;
      var candidates = active.filter(function (p) { return !p.locked && !p.unassigned && p.planBus === b.id && p.readyAt - s.time <= 10; });
      if (!candidates.length) return;
      var p = candidates[0], pickup = estimatePickupAt(s, b, p);
      if (pickup <= 180 && pickup <= p.deadline - legMinutes(p.node, personDestination(p))) {
        p.locked = true; p.pickupAt = pickup; b.confirmedPickupId = p.id;
      } else { p.planBus = null; p.unassigned = true; log(s, p.name + ' は確定便に挿入できず未割当'); }
    });
  }
  function activatePeople(s) {
    s.people.forEach(function (p) {
      if (p.status === 'pending' && s.time >= p.readyAt) {
        p.status = 'waiting';
        // For a walk-in this is a boarding cutoff, not an arrival deadline.
        if (p.kind === 'walkin') { p.waitUntil = s.time + 30; p.deadline = p.waitUntil; }
        log(s, p.name + ' が ' + byId[p.node].name + ' で待機開始');
      }
      if (p.status === 'staying' && s.time >= p.readyAt) {
        p.completedStays.push({ node: p.node, minutes: s.time - p.stayStartedAt });
        p.status = 'waiting';
        if (p.visitIndex >= p.visits.length) { p.returning = true; p.destination = p.origin; }
        else p.destination = personDestination(p);
        log(s, p.name + ' の次の移動が可能');
      }
      if (p.status === 'waiting' && s.time > (p.kind === 'walkin' ? p.waitUntil : p.deadline)) { p.status = 'missed'; log(s, p.name + ' は' + (p.kind === 'walkin' ? '待機時間切れ' : '期限超過')); }
    });
  }
  function busAnchor(s, b) {
    if (!b.edge) return { node: b.node, time: s.time };
    return { node: b.edge.to, time: s.time + (b.edge.duration - b.edge.elapsed) };
  }
  function projectedDropoffs(s, b, candidate) {
    var riders = b.onboard.map(function (id) { return personById(s, id); }).filter(Boolean);
    if (candidate) riders.push(candidate);
    var anchor = busAnchor(s, b), at = anchor.node, time = anchor.time, result = [];
    while (riders.length) {
      riders.sort(function (a, c) { return legMinutes(at, personDestination(a)) - legMinutes(at, personDestination(c)); });
      var p = riders.shift(), d = legMinutes(at, personDestination(p)); time += d; at = personDestination(p); result.push({ person: p, time: time, node: at });
    }
    return { time: time, node: at, stops: result };
  }
  function estimatePickupAt(s, b, p) {
    var projection = projectedDropoffs(s, b, null);
    return Math.max(p.readyAt, projection.time + legMinutes(projection.node, p.node));
  }
  function canBoard(s, b, p) {
    if (b.onboard.length >= s.capacity) return false;
    var before = projectedDropoffs(s, b, null), projection = projectedDropoffs(s, b, p), ok = true;
    var beforeTimes = {}; before.stops.forEach(function (stop) { beforeTimes[stop.person.id] = stop.time; });
    projection.stops.forEach(function (stop) {
      if (stop.time > 180) ok = false;
      if (stop.person.kind === 'registered' && stop.time > stop.person.deadline) ok = false;
      // A walk-in is accepted only when no existing onboard person's committed
      // arrival gets later; its 30-minute limit was checked before boarding.
      if (beforeTimes[stop.person.id] != null && stop.time > beforeTimes[stop.person.id]) ok = false;
    });
    // Do not accept a walk-in when it would make a confirmed pickup impossible.
    s.people.filter(function (q) { return q !== p && q.id === b.confirmedPickupId && q.kind === 'registered' && ['pending', 'staying', 'waiting'].indexOf(q.status) >= 0; }).forEach(function (q) {
      var pickup = projection.time + legMinutes(projection.node, q.node);
      if (pickup > q.pickupAt || pickup > 180) ok = false;
    });
    if (p.kind === 'walkin') s.boardingChecks.push({ time: s.time, busId: b.id, personId: p.id, accepted: ok,
      before: before.stops.map(function (stop) { return { personId: stop.person.id, time: stop.time }; }),
      after: projection.stops.map(function (stop) { return { personId: stop.person.id, time: stop.time }; }) });
    return ok;
  }
  function arrive(s, b) {
    var leaving = b.onboard.slice();
    leaving.forEach(function (id) {
      var p = personById(s, id);
      if (p && personDestination(p) === b.node) {
        b.onboard.splice(b.onboard.indexOf(id), 1); p.node = b.node;
        if (p.kind === 'walkin' || p.oneWay) { p.completedVisits.push(b.node); p.status = s.time <= 180 && (p.kind === 'walkin' || s.time <= p.deadline) ? 'done' : 'missed'; if (p.status === 'done') p.completedAt = s.time; log(s, p.name + (p.status === 'done' ? ' が目的地に到着' : ' が12時超過')); }
        else if (!p.returning) {
          p.completedVisits.push(b.node); p.visitIndex++; p.status = 'staying'; p.stayStartedAt = s.time; p.readyAt = s.time + (p.stays[p.visitIndex - 1] || 0); p.planBus = null; p.pickupAt = null; p.locked = false;
          log(s, p.name + ' が ' + byId[b.node].name + ' で滞在開始');
        } else { p.status = s.time <= 180 && s.time <= p.deadline ? 'done' : 'missed'; if (p.status === 'done') p.completedAt = s.time; log(s, p.name + (p.status === 'done' ? ' が帰着・達成' : ' が期限超過')); }
      }
    });
    // This is the only point a walk-in is visible to a bus: no remote dispatch on it.
    waitingAt(s, b.node, false).sort(function (a, c) { return (a.kind === 'registered' ? 0 : 1) - (c.kind === 'registered' ? 0 : 1) || a.id.localeCompare(c.id); }).forEach(function (p) {
      if (b.onboard.length < s.capacity && (p.kind === 'walkin' || p.planBus === b.id || !p.locked) && canBoard(s, b, p)) { b.onboard.push(p.id); p.status = 'onboard'; p.boardedAt = s.time; p.planBus = b.id; log(s, p.name + ' が ' + b.id + ' に乗車'); }
    });
  }
  function startEdge(s, b, to) {
    if (!to || to === b.node) return;
    var route = path(b.node, to); if (route.nodes.length < 2) return;
    // route is strictly the future itinerary, never a travel history.
    b.route = route.nodes.slice(1);
    var next = b.route[0], duration = graph[b.node].filter(function (e) { return e[0] === next; })[0][1];
    b.edge = { from: b.node, to: next, elapsed: 0, duration: duration };
  }
  function canForecastDetour(s, b, target) {
    var anchor = busAnchor(s, b), time = anchor.time + legMinutes(anchor.node, target), at = target;
    var commitments = s.people.filter(function (p) { return p.id === b.confirmedPickupId || (p.kind === 'registered' && p.planBus === b.id && ['pending', 'staying'].indexOf(p.status) >= 0); }).sort(function (a, c) { return a.readyAt - c.readyAt; }).slice(0, 1);
    for (var i = 0; i < commitments.length; i++) {
      var p = commitments[i]; time += legMinutes(at, p.node); at = p.node;
      // Unlocked future requests are still planning constraints; only their
      // final pickup timestamp may be recalculated. Locked ones use pickupAt.
      if (time > (p.pickupAt == null ? p.readyAt : p.pickupAt)) return false;
      if (time < p.readyAt) time = p.readyAt;
    }
    return time <= 180;
  }
  function chooseMove(s, b) {
    arrive(s, b);
    var aboard = b.onboard.map(function (id) { return personById(s, id); }).filter(Boolean);
    if (aboard.length) { aboard.sort(function (a, c) { return legMinutes(b.node, personDestination(a)) - legMinutes(b.node, personDestination(c)); }); startEdge(s, b, personDestination(aboard[0])); return; }
    var confirmed = b.confirmedPickupId && personById(s, b.confirmedPickupId);
    if (confirmed && ['pending', 'staying', 'waiting'].indexOf(confirmed.status) >= 0) { if (b.node !== confirmed.node) startEdge(s, b, confirmed.node); return; }
    var reservations = s.people.filter(function (p) { return p.kind === 'registered' && p.status === 'waiting' && p.planBus === b.id; });
    reservations.sort(function (a, c) { return legMinutes(b.node, a.node) - legMinutes(b.node, c.node) || a.deadline - c.deadline; });
    if (reservations.length) { startEdge(s, b, reservations[0].node); return; }
    if (s.mode === 'B') {
      var target = null, score = 0;
      nodes.forEach(function (n) { var d = legMinutes(b.node, n.id), value = forecastIn(s, n.id, s.time + d) - d * 0.09; if (n.id !== b.node && canForecastDetour(s, b, n.id) && value > score) { score = value; target = n.id; } });
      if (target) { log(s, b.id + ' が予測需要へ回送'); startEdge(s, b, target); }
    } else if (b.node !== 'station') startEdge(s, b, 'station');
  }
  function step(s) {
    if (!s || !s.buses || !s.people) throw new Error('BusSim state is required');
    if (s.finished || s.time >= 180) { s.finished = true; return s; }
    s.time++;
    activatePeople(s);
    scheduleReservations(s);
    s.buses.forEach(function (b) {
      if (b.edge) { b.edge.elapsed++; b.distance += 0.45; if (b.edge.elapsed >= b.edge.duration) { b.node = b.edge.to; if (b.route[0] === b.node) b.route.shift(); b.edge = null; log(s, b.id + ' が ' + byId[b.node].name + ' に到着'); } }
      if (!b.edge) chooseMove(s, b);
    });
    if (s.time >= 180) { s.finished = true; log(s, '12時: シミュレーション終了'); }
    return s;
  }
  function extend(s, personId) {
    var p = s.people.filter(function (q) { return q.id === personId; })[0];
    if (!p) return { ok: false, message: '利用者が見つかりません' };
    if (p.kind !== 'registered' || p.status !== 'staying') return { ok: false, message: '滞在中の登録者のみ延長できます' };
    if (p.locked || p.readyAt - s.time <= 10) return { ok: false, message: '10分以内の確定便は変更できません' };
    p.readyAt += 30; p.planBus = null; p.pickupAt = null;
    // Existing bus edges/onboard movements stay fixed; only this later leg is recomputed.
    log(s, p.name + ' の滞在を30分延長（後続便を再計算）');
    return { ok: true, message: p.name + ' の滞在を30分延長しました' };
  }
  function addReservation(s, request) {
    if (!request || !byId[request.origin] || !byId[request.destination] || request.origin === request.destination)
      return { ok: false, message: '異なる出発地と目的地を選んでください' };
    var ready = Number(request.readyAt), deadline = Number(request.deadline);
    if (s.time >= 180 || !Number.isInteger(ready) || !Number.isInteger(deadline) || ready < s.time + 1 || deadline > 180 || deadline < ready + legMinutes(request.origin, request.destination))
      return { ok: false, message: '出発は現在より1分以上先、到着期限は移動時間を含め12時までに設定してください' };
    var serial = s.people.filter(function(p) { return p.oneWay; }).length + 1;
    var id = 'extra' + serial;
    s.people.push({ id: id, name: '追加予約' + serial, kind: 'registered', oneWay: true,
      origin: request.origin, destination: request.destination, node: request.origin,
      status: 'pending', readyAt: ready, deadline: deadline, visits: [], stays: [],
      visitIndex: 0, returning: false, planBus: null, locked: false,
      completedVisits: [], completedStays: [] });
    log(s, '追加予約' + serial + ': ' + byId[request.origin].name + ' → ' + byId[request.destination].name + '（片道）を登録');
    return { ok: true, id: id, message: '追加予約' + serial + ' を登録しました。次の配車から反映します' };
  }
  function metrics(s) {
    var registered = s.people.filter(function (p) { return p.kind === 'registered' && p.status === 'done'; }).length;
    var walkin = s.people.filter(function (p) { return p.kind === 'walkin' && p.status === 'done'; }).length;
    var unmet = {}; nodes.forEach(function (n) { unmet[n.name] = 0; });
    s.people.filter(function (p) { return p.kind === 'walkin' && p.status !== 'done'; }).forEach(function (p) { unmet[byId[p.origin].name]++; });
    return { registered: registered, walkin: walkin, distance: Math.round(s.buses.reduce(function (sum, b) { return sum + b.distance; }, 0) * 10) / 10, unmet: unmet };
  }
  return { nodes: clone(nodes), edges: clone(edges), create: create, step: step, extend: extend, metrics: metrics, forecast: forecast, addReservation: addReservation };
}));
