// frontend/src/views/visitor/js/dijkstra-pathfinding.js

const API = import.meta.env.VITE_API_BASE_URL;

// ------------------------------- fetch ---------------------------------
async function tryJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch roads (optional).
 * Tolerant:
 * - GeoJSON features
 * - DB polyline objects
 * - arrays, {data:...}, {features:...}
 */
export async function fetchRoadPlots() {
  try {
    const url = `${API}/plot/road-plots`;
    const data = await tryJson(url);

    const list =
      (Array.isArray(data?.features) && data.features) ||
      (Array.isArray(data?.data?.features) && data.data.features) ||
      (Array.isArray(data?.data) && data.data) ||
      (Array.isArray(data) && data) ||
      [];

    return list.map((f) => {
      if (f?.geometry) return f;
      if (f?.type && f?.coordinates) {
        return { type: "Feature", geometry: f, properties: {} };
      }
      return f;
    });
  } catch (err) {
    console.error("[RoadPlots] fetch error:", err);
    return [];
  }
}

// ------------------------------ geometry -------------------------------
export function haversineMetersObj(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  return haversineMetersObj({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
}

export const fmtDistance = (m) =>
  m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

/** project P onto infinite line AB; returns {t in R, point:{lat,lng}} */
function projectPoint(A, B, P) {
  const ax = A.lng,
    ay = A.lat;
  const bx = B.lng,
    by = B.lat;
  const px = P.lng,
    py = P.lat;
  const vx = bx - ax,
    vy = by - ay;
  const wx = px - ax,
    wy = py - ay;
  const denom = vx * vx + vy * vy || 1e-12;
  const t = (wx * vx + wy * vy) / denom;
  return { t, point: { lat: ay + t * vy, lng: ax + t * vx } };
}

// ------------------------------- helpers ---------------------------------
function isFiniteNum(x) {
  return Number.isFinite(Number(x));
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

function coerceLatLngAny(p) {
  if (!p) return null;

  // google.maps.LatLng
  if (typeof p.lat === "function" && typeof p.lng === "function") {
    const lat = p.lat();
    const lng = p.lng();
    if (isFiniteNum(lat) && isFiniteNum(lng)) return { lat: +lat, lng: +lng };
    return null;
  }

  // {lat,lng}
  if (typeof p === "object" && isFiniteNum(p.lat) && isFiniteNum(p.lng)) {
    return { lat: +p.lat, lng: +p.lng };
  }

  // {latitude, longitude}
  if (
    typeof p === "object" &&
    isFiniteNum(p.latitude) &&
    isFiniteNum(p.longitude)
  ) {
    return { lat: +p.latitude, lng: +p.longitude };
  }

  // [a,b] where could be [lat,lng] or [lng,lat]
  if (Array.isArray(p) && p.length >= 2) {
    const a = +p[0];
    const b = +p[1];
    if (!isFiniteNum(a) || !isFiniteNum(b)) return null;

    const aIsLat = Math.abs(a) <= 90;
    const bIsLat = Math.abs(b) <= 90;

    if (aIsLat && !bIsLat) return { lat: a, lng: b };
    if (!aIsLat && bIsLat) return { lat: b, lng: a };

    return { lat: a, lng: b };
  }

  return null;
}

function coerceLatLngGeoJSONCoord(c) {
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = +c[0];
  const lat = +c[1];
  if (!isFiniteNum(lat) || !isFiniteNum(lng)) return null;
  return { lat, lng };
}

function parseNodeKey(key) {
  const [lat, lng] = String(key).split(",").map(Number);
  if (!isFiniteNum(lat) || !isFiniteNum(lng)) return null;
  return { lat, lng };
}

function makeKey6(p) {
  return `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}

// ---------------------- local projector (small area) ----------------------
function makeProjector(lat0) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const cos0 = Math.cos(toRad(lat0));

  return {
    toXY: (p) => {
      const x = toRad(p.lng) * cos0 * R;
      const y = toRad(p.lat) * R;
      return { x, y };
    },
    toLatLng: (xy) => {
      const lat = toDeg(xy.y / R);
      const lng = toDeg(xy.x / (R * cos0));
      return { lat, lng };
    },
  };
}

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
}

function sub2(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add2(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function mul2(a, k) {
  return { x: a.x * k, y: a.y * k };
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function bboxOverlap(a1, a2, b1, b2, pad = 0) {
  const aminx = Math.min(a1.x, a2.x) - pad;
  const amaxx = Math.max(a1.x, a2.x) + pad;
  const aminy = Math.min(a1.y, a2.y) - pad;
  const amaxy = Math.max(a1.y, a2.y) + pad;

  const bminx = Math.min(b1.x, b2.x) - pad;
  const bmaxx = Math.max(b1.x, b2.x) + pad;
  const bminy = Math.min(b1.y, b2.y) - pad;
  const bmaxy = Math.max(b1.y, b2.y) + pad;

  return !(amaxx < bminx || aminx > bmaxx || amaxy < bminy || aminy > bmaxy);
}

/**
 * Proper segment intersection in XY.
 * Returns {t,u, p:{x,y}} or null.
 */
function segIntersectionXY(A, B, C, D) {
  const r = sub2(B, A);
  const s = sub2(D, C);
  const denom = cross2(r, s);
  if (Math.abs(denom) < 1e-12) return null; // parallel/collinear

  const CA = sub2(C, A);
  const t = cross2(CA, s) / denom;
  const u = cross2(CA, r) / denom;

  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  const p = add2(A, mul2(r, t));
  return { t, u, p };
}

/**
 * Closest point on segment AB to point P (XY).
 * Returns {t in [0,1], p:{x,y}, d}
 */
function closestPointOnSegmentXY(P, A, B) {
  const vx = B.x - A.x;
  const vy = B.y - A.y;
  const wx = P.x - A.x;
  const wy = P.y - A.y;
  const denom = vx * vx + vy * vy || 1e-12;
  const t = clamp01((wx * vx + wy * vy) / denom);
  const p = { x: A.x + vx * t, y: A.y + vy * t };
  return { t, p, d: dist2(P, p) };
}

// ------------------------------- graph line extraction --------------------
function extractLines(input) {
  const out = [];
  if (!input) return out;

  const geo = input?.geometry ? input.geometry : null;
  const geom =
    geo ||
    (input?.type && input?.coordinates && typeof input.type === "string"
      ? input
      : null);

  if (geom && typeof geom.type === "string") {
    if (geom.type === "LineString") {
      const line = (geom.coordinates || [])
        .map(coerceLatLngGeoJSONCoord)
        .filter(Boolean);
      if (line.length >= 2) out.push(line);
      return out;
    }

    if (geom.type === "MultiLineString") {
      for (const coords of geom.coordinates || []) {
        const line = (coords || [])
          .map(coerceLatLngGeoJSONCoord)
          .filter(Boolean);
        if (line.length >= 2) out.push(line);
      }
      return out;
    }

    return out;
  }

  if (input?.type === "polyline" && Array.isArray(input.path)) {
    const line = input.path.map(coerceLatLngAny).filter(Boolean);
    if (line.length >= 2) out.push(line);
    return out;
  }

  if (Array.isArray(input?.path)) {
    const line = input.path.map(coerceLatLngAny).filter(Boolean);
    if (line.length >= 2) out.push(line);
    return out;
  }

  if (input?.from && input?.to) {
    const a = coerceLatLngAny(input.from);
    const b = coerceLatLngAny(input.to);
    if (a && b) out.push([a, b]);
    return out;
  }

  return out;
}

/**
 * Build adjacency list for Dijkstra.
 *
 * 🔥 IMPORTANT FIX:
 * - splitIntersections: true will split road segments at mid-intersections
 *   so visually-crossing yellow roads become connected in the graph.
 */
export function buildGraph(inputs, opts = {}) {
  const SNAP_M = opts.snapM ?? 2.5;
  const SNAP_K = opts.snapK ?? 3;
  const ONLY_SEGMENTS = !!opts.onlySegments;

  const SPLIT = opts.splitIntersections !== false; // default true
  const JUNCTION_SNAP_M = Number.isFinite(+opts.junctionSnapM)
    ? +opts.junctionSnapM
    : 1.2;

  const graph = {};
  const ensureNode = (key) => {
    if (!graph[key]) graph[key] = {};
  };

  const makeKey = (lat, lng) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

  const addEdge = (A, B) => {
    const dist = haversineMetersObj(A, B);
    if (dist < 0.3) return;

    const k1 = makeKey(A.lat, A.lng);
    const k2 = makeKey(B.lat, B.lng);

    ensureNode(k1);
    ensureNode(k2);

    graph[k1][k2] = Math.min(graph[k1][k2] ?? Infinity, dist);
    graph[k2][k1] = Math.min(graph[k2][k1] ?? Infinity, dist);
  };

  // 1) Build raw segment list
  const segments = [];
  const allPts = [];

  for (const item of inputs || []) {
    if (ONLY_SEGMENTS) {
      if (!item?.from || !item?.to) continue;
      const a = coerceLatLngAny(item.from);
      const b = coerceLatLngAny(item.to);
      if (!a || !b) continue;
      segments.push({ a, b });
      allPts.push(a, b);
      continue;
    }

    const lines = extractLines(item);
    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i];
        const b = line[i + 1];
        if (!a || !b) continue;
        segments.push({ a, b });
        allPts.push(a, b);
      }
    }
  }

  if (!segments.length) return {};

  // 2) Split intersections
  if (SPLIT) {
    const lat0 =
      allPts.reduce((acc, p) => acc + (p?.lat || 0), 0) /
      Math.max(1, allPts.length);
    const proj = makeProjector(lat0);

    const segXY = segments.map((s) => ({
      aLL: s.a,
      bLL: s.b,
      a: proj.toXY(s.a),
      b: proj.toXY(s.b),
      splits: [
        { t: 0, ll: s.a },
        { t: 1, ll: s.b },
      ],
    }));

    const extraLinks = [];

    const addSplit = (seg, t, ll) => {
      for (const ex of seg.splits) {
        if (Math.abs(ex.t - t) < 1e-6) return;
        if (haversineMetersObj(ex.ll, ll) < 0.15) return;
      }
      seg.splits.push({ t, ll });
    };

    for (let i = 0; i < segXY.length; i++) {
      for (let j = i + 1; j < segXY.length; j++) {
        const si = segXY[i];
        const sj = segXY[j];

        if (!bboxOverlap(si.a, si.b, sj.a, sj.b, JUNCTION_SNAP_M)) continue;

        const hit = segIntersectionXY(si.a, si.b, sj.a, sj.b);
        if (hit) {
          const ll = proj.toLatLng(hit.p);
          addSplit(si, hit.t, ll);
          addSplit(sj, hit.u, ll);
        }

        const endpointsI = [
          { ll: si.aLL, xy: si.a },
          { ll: si.bLL, xy: si.b },
        ];
        for (const ep of endpointsI) {
          const c = closestPointOnSegmentXY(ep.xy, sj.a, sj.b);
          if (c.t > 1e-6 && c.t < 1 - 1e-6 && c.d <= JUNCTION_SNAP_M) {
            const ll = proj.toLatLng(c.p);
            addSplit(sj, c.t, ll);
            extraLinks.push({ from: ep.ll, to: ll });
          }
        }

        const endpointsJ = [
          { ll: sj.aLL, xy: sj.a },
          { ll: sj.bLL, xy: sj.b },
        ];
        for (const ep of endpointsJ) {
          const c = closestPointOnSegmentXY(ep.xy, si.a, si.b);
          if (c.t > 1e-6 && c.t < 1 - 1e-6 && c.d <= JUNCTION_SNAP_M) {
            const ll = proj.toLatLng(c.p);
            addSplit(si, c.t, ll);
            extraLinks.push({ from: ep.ll, to: ll });
          }
        }
      }
    }

    for (const s of segXY) {
      s.splits.sort((p, q) => p.t - q.t);

      const cleaned = [];
      for (const sp of s.splits) {
        if (!cleaned.length) {
          cleaned.push(sp);
          continue;
        }
        const prev = cleaned[cleaned.length - 1];
        if (haversineMetersObj(prev.ll, sp.ll) < 0.15) continue;
        cleaned.push(sp);
      }

      for (let k = 0; k < cleaned.length - 1; k++) {
        addEdge(cleaned[k].ll, cleaned[k + 1].ll);
      }
    }

    for (const l of extraLinks) addEdge(l.from, l.to);
  } else {
    for (const s of segments) addEdge(s.a, s.b);
  }

  // 3) Snap endpoints that almost touch
  const degrees = new Map();
  for (const [node, nbrs] of Object.entries(graph)) {
    degrees.set(node, Object.keys(nbrs).length);
  }

  const endpoints = [];
  for (const [node, deg] of degrees.entries()) {
    if (deg <= 1) {
      const p = parseNodeKey(node);
      if (p) endpoints.push({ key: node, p });
    }
  }

  for (let i = 0; i < endpoints.length; i++) {
    const A = endpoints[i];
    const cands = [];
    for (let j = 0; j < endpoints.length; j++) {
      if (i === j) continue;
      const B = endpoints[j];
      const d = haversineMetersObj(A.p, B.p);
      if (d <= SNAP_M) cands.push({ key: B.key, p: B.p, d });
    }
    cands
      .sort((x, y) => x.d - y.d)
      .slice(0, SNAP_K)
      .forEach((c) => addEdge(A.p, c.p));
  }

  // 4) remove isolated nodes
  const connected = {};
  for (const [node, nbrs] of Object.entries(graph)) {
    if (Object.keys(nbrs).length) connected[node] = nbrs;
  }
  return connected;
}

// ----------------------------- dijkstra -------------------------------
export function dijkstra(graph, start, end) {
  if (!graph?.[start] || !graph?.[end]) return [];

  const dist = new Map();
  const prev = new Map();
  const visited = new Set();

  class PQ {
    constructor() {
      this.a = [];
    }
    enq(x, p) {
      this.a.push({ x, p });
      this.a.sort((m, n) => m.p - n.p);
    }
    deq() {
      return this.a.shift()?.x;
    }
    empty() {
      return this.a.length === 0;
    }
  }

  const pq = new PQ();
  for (const n of Object.keys(graph)) {
    dist.set(n, Infinity);
    prev.set(n, null);
  }

  dist.set(start, 0);
  pq.enq(start, 0);

  while (!pq.empty()) {
    const cur = pq.deq();
    if (!cur) break;
    if (visited.has(cur)) continue;
    if (cur === end) break;

    visited.add(cur);

    for (const [nbr, w] of Object.entries(graph[cur] || {})) {
      if (visited.has(nbr)) continue;
      const nd = dist.get(cur) + w;
      if (nd < dist.get(nbr)) {
        dist.set(nbr, nd);
        prev.set(nbr, cur);
        pq.enq(nbr, nd);
      }
    }
  }

  const path = [];
  let cur = end;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  if (path[0] !== start) return [];
  return path;
}

// -------------------------- trimming helpers ---------------------------
function trimBehindAtUser(route, user, threshold = 20) {
  if (!route || route.length < 2) return route;

  const u = { lat: user.lat, lng: user.lng };
  let bestIdx = -1;
  let bestDist = Infinity;
  let bestPoint = null;

  for (let i = 0; i < route.length - 1; i++) {
    const A = route[i];
    const B = route[i + 1];
    const { t } = projectPoint(A, B, u);
    const clampedT = Math.max(0, Math.min(1, t));
    const onSeg = {
      lat: A.lat + (B.lat - A.lat) * clampedT,
      lng: A.lng + (B.lng - A.lng) * clampedT,
    };
    const d = haversineMetersObj(onSeg, u);

    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
      bestPoint = { ...onSeg, t: clampedT };
    }
  }

  if (bestIdx >= 0 && bestDist <= threshold) {
    const remaining = route.slice(bestIdx + 1);
    const out = [{ lat: u.lat, lng: u.lng }];
    if (bestPoint && bestPoint.t < 1.0)
      out.push({ lat: bestPoint.lat, lng: bestPoint.lng });
    return out.concat(remaining);
  }

  return [{ lat: u.lat, lng: u.lng }, ...route];
}

function trimAheadAtDestination(route, destination, threshold = 25) {
  if (!route || route.length < 2) return route;

  const dest = { lat: destination.lat, lng: destination.lng };

  for (let i = 0; i < route.length - 1; i++) {
    const A = route[i];
    const B = route[i + 1];
    const { t, point } = projectPoint(A, B, dest);
    if (t >= 0 && t <= 1) {
      const d = haversineMetersObj(point, dest);
      if (d <= threshold) {
        const out = route.slice(0, i + 1);
        if (t > 0) out.push({ lat: point.lat, lng: point.lng });
        out.push({ lat: dest.lat, lng: dest.lng });
        return out;
      }
    }
  }

  const last = route[route.length - 1];
  if (haversineMetersObj(last, dest) <= threshold) {
    const out = route.slice(0, -1);
    out.push({ lat: dest.lat, lng: dest.lng });
    return out;
  }

  return route;
}

function sumDistance(route) {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += haversineMeters(
      route[i].lat,
      route[i].lng,
      route[i + 1].lat,
      route[i + 1].lng
    );
  }
  return total;
}

// ------------------------ snap-to-road + routed polyline --------------------
function cloneGraph(graph) {
  const g = {};
  for (const [k, nbrs] of Object.entries(graph || {})) {
    g[k] = { ...(nbrs || {}) };
  }
  return g;
}

function closestPointOnSegment(P, A, B) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;

  const lat0 = toRad((A.lat + B.lat) / 2);
  const ax = toRad(A.lng) * Math.cos(lat0) * R;
  const ay = toRad(A.lat) * R;
  const bx = toRad(B.lng) * Math.cos(lat0) * R;
  const by = toRad(B.lat) * R;
  const px = toRad(P.lng) * Math.cos(lat0) * R;
  const py = toRad(P.lat) * R;

  const vx = bx - ax,
    vy = by - ay;
  const wx = px - ax,
    wy = py - ay;

  const denom = vx * vx + vy * vy || 1e-12;
  const t = clamp01((wx * vx + wy * vy) / denom);

  const snapped = {
    lat: A.lat + (B.lat - A.lat) * t,
    lng: A.lng + (B.lng - A.lng) * t,
  };

  const d = haversineMetersObj(P, snapped);
  return { snapped, t, d };
}

function snapPointToGraphEdge(pt, graph) {
  const seen = new Set();
  let best = null;

  for (const aKey of Object.keys(graph || {})) {
    const A = parseNodeKey(aKey);
    if (!A) continue;

    for (const bKey of Object.keys(graph[aKey] || {})) {
      const id = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const B = parseNodeKey(bKey);
      if (!B) continue;

      const { snapped, d } = closestPointOnSegment(pt, A, B);

      if (!best || d < best.distToRoadM) {
        best = { snappedPoint: snapped, aKey, bKey, distToRoadM: d };
      }
    }
  }

  return best;
}

function connectVirtualNode(g, virtualKey, virtualPoint, aKey, bKey) {
  const A = parseNodeKey(aKey);
  const B = parseNodeKey(bKey);
  if (!A || !B) return;

  if (!g[virtualKey]) g[virtualKey] = {};
  if (!g[aKey]) g[aKey] = {};
  if (!g[bKey]) g[bKey] = {};

  const dA = haversineMetersObj(virtualPoint, A);
  const dB = haversineMetersObj(virtualPoint, B);

  g[virtualKey][aKey] = Math.min(g[virtualKey][aKey] ?? Infinity, dA);
  g[aKey][virtualKey] = Math.min(g[aKey][virtualKey] ?? Infinity, dA);

  g[virtualKey][bKey] = Math.min(g[virtualKey][bKey] ?? Infinity, dB);
  g[bKey][virtualKey] = Math.min(g[bKey][virtualKey] ?? Infinity, dB);
}

function dedupeNear(points, minMeters = 0.25) {
  if (!points?.length) return [];
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    const cur = points[i];
    if (haversineMetersObj(prev, cur) >= minMeters) out.push(cur);
  }
  return out;
}

// ------------------------ route -> steps (Google Maps style) ----------------
function bearingDeg(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const toDeg = (x) => (x * 180) / Math.PI;

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function turnText(delta) {
  const a = Math.abs(delta);
  if (a < 25) return "Continue straight";
  if (a < 60) return delta > 0 ? "Slight right" : "Slight left";
  if (a < 130) return delta > 0 ? "Turn right" : "Turn left";
  return delta > 0 ? "Sharp right" : "Sharp left";
}

export function routeToSteps(route) {
  if (!Array.isArray(route) || route.length < 2) return [];

  const segDist = [];
  const segBear = [];

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const d = haversineMetersObj(a, b);
    if (d < 0.3) continue;
    segDist.push(d);
    segBear.push(bearingDeg(a, b));
  }

  if (!segDist.length) return [];

  const steps = [];
  let accum = 0;

  steps.push(`Start and follow the green line.`);

  for (let i = 0; i < segBear.length - 1; i++) {
    accum += segDist[i];

    const b1 = segBear[i];
    const b2 = segBear[i + 1];
    const delta = ((b2 - b1 + 540) % 360) - 180;

    if (Math.abs(delta) >= 35) {
      steps.push(`Walk ${fmtDistance(accum)} then ${turnText(delta)}.`);
      accum = 0;
    }
  }

  const remaining = accum + segDist[segDist.length - 1];
  steps.push(
    `Continue for ${fmtDistance(remaining)} to reach the grave marker 🎯.`
  );

  return steps;
}

// ------------------------ build routed polyline -------------------------
export async function buildRoutedPolyline(
  user,
  destination,
  graph,
  trim = { userM: 25, destM: 25 }
) {
  const nodeKeys = Object.keys(graph || {});
  if (!nodeKeys.length) {
    return {
      polyline: [],
      graphPath: [],
      distance: 0,
      steps: [],
      debug: { used: "no_graph" },
    };
  }

  const SNAP_MAX_M = Number.isFinite(+trim.snapMaxM) ? +trim.snapMaxM : 60;
  const ALLOW_FALLBACK = !!trim.allowFallback;

  const g = cloneGraph(graph);

  const u = { lat: user.lat, lng: user.lng };
  const dest = { lat: destination.lat, lng: destination.lng };

  const uSnap = snapPointToGraphEdge(u, g);
  const dSnap = snapPointToGraphEdge(dest, g);

  const nearestNodeKey = (pt) => {
    let best = null;
    let bestD = Infinity;
    for (const k of nodeKeys) {
      const p = parseNodeKey(k);
      if (!p) continue;
      const d = haversineMetersObj(pt, p);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    return { key: best, distance: bestD };
  };

  let startKey = null,
    endKey = null;
  let startSnapPoint = null,
    endSnapPoint = null;

  // Start
  if (uSnap && uSnap.distToRoadM <= SNAP_MAX_M) {
    startSnapPoint = uSnap.snappedPoint;
    startKey = makeKey6(startSnapPoint);
    connectVirtualNode(g, startKey, startSnapPoint, uSnap.aKey, uSnap.bKey);
  } else {
    const nn = nearestNodeKey(u);
    if (!nn.key || nn.distance > SNAP_MAX_M) {
      return {
        polyline: [],
        graphPath: [],
        distance: 0,
        steps: [],
        debug: { used: "start_too_far_from_road", startDist: nn.distance },
      };
    }
    startKey = nn.key;
    startSnapPoint = parseNodeKey(startKey);
  }

  // End
  if (dSnap && dSnap.distToRoadM <= SNAP_MAX_M) {
    endSnapPoint = dSnap.snappedPoint;
    endKey = makeKey6(endSnapPoint);
    connectVirtualNode(g, endKey, endSnapPoint, dSnap.aKey, dSnap.bKey);
  } else {
    const nn = nearestNodeKey(dest);
    if (!nn.key || nn.distance > SNAP_MAX_M) {
      return {
        polyline: [],
        graphPath: [],
        distance: 0,
        steps: [],
        debug: { used: "end_too_far_from_road", endDist: nn.distance },
      };
    }
    endKey = nn.key;
    endSnapPoint = parseNodeKey(endKey);
  }

  const keys = dijkstra(g, startKey, endKey);

  if (!keys.length) {
    if (!ALLOW_FALLBACK) {
      return {
        polyline: [],
        graphPath: [],
        distance: 0,
        steps: [],
        debug: {
          used: "no_path_on_roads",
          startSnapM: uSnap?.distToRoadM ?? null,
          endSnapM: dSnap?.distToRoadM ?? null,
        },
      };
    }

    let route = [
      { lat: u.lat, lng: u.lng },
      { lat: dest.lat, lng: dest.lng },
    ];
    route = trimBehindAtUser(route, u, trim.userM);
    route = trimAheadAtDestination(route, dest, trim.destM);

    return {
      polyline: route,
      graphPath: [],
      distance: sumDistance(route),
      steps: routeToSteps(route),
      debug: { used: "fallback_line" },
    };
  }

  const nodes = keys.map(parseNodeKey).filter(Boolean);

  let route = [
    { lat: u.lat, lng: u.lng },
    ...(startSnapPoint ? [startSnapPoint] : []),
    ...nodes,
    ...(endSnapPoint ? [endSnapPoint] : []),
    { lat: dest.lat, lng: dest.lng },
  ];

  route = dedupeNear(route, 0.25);
  route = trimBehindAtUser(route, u, trim.userM);
  route = trimAheadAtDestination(route, dest, trim.destM);

  return {
    polyline: route,
    graphPath: nodes,
    distance: sumDistance(route),
    steps: routeToSteps(route),
    debug: {
      used: "road_graph",
      startSnapM: uSnap?.distToRoadM ?? null,
      endSnapM: dSnap?.distToRoadM ?? null,
      nodes: nodes.length,
    },
  };
}
