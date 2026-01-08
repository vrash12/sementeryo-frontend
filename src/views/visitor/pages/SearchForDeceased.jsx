// frontend/src/views/visitor/pages/SearchForDeceased.jsx
// ✅ Geofence removed from this page so you can test Live Location from home.
// Notes:
// - We no longer import/use isInsideGeofence here.
// - GPS will always start + keep watching if permission is granted.
// - Routing will fall back to cemetery entrance if you’re too far from the cemetery (to avoid routing/snap failures).

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { NavLink } from "react-router-dom";
import fetchBurialRecords from "../js/get-burial-records";
import { buildGraph, buildRoutedPolyline, fmtDistance } from "../js/dijkstra-pathfinding";

import CemeteryMap, {
  CEMETERY_CENTER,
  CEMETERY_ENTRANCE,
  INITIAL_ROAD_SEGMENTS,
} from "../../../components/map/CemeteryMap";

// shadcn/ui
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";

// =========================== UI COPY ===========================
const MEMORIAL_QUOTE = "To live in hearts we leave behind is not to die.";

function formatDate(s) {
  if (!s) return "—";

  const raw = String(s).trim();

  // ✅ remove "T16:00:00.000Z" (or any ISO time part) if present
  const dateOnly = raw.includes("T") ? raw.split("T")[0] : raw;

  // If it's "YYYY-MM-DD", parse as LOCAL time to avoid timezone day-shift
  const isYMD = /^\d{4}-\d{2}-\d{2}$/.test(dateOnly);
  const d = isYMD ? new Date(`${dateOnly}T00:00:00`) : new Date(raw);

  if (Number.isNaN(d.getTime())) return dateOnly;

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function safeFileName(s) {
  return String(s || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

// --------------------------- Device API helpers ---------------------------
function isSecureForDeviceAPIs() {
  const host = window.location.hostname;
  return window.isSecureContext || host === "localhost" || host === "127.0.0.1";
}

function cameraErrToMessage(err) {
  const name = err?.name || "";
  if (name === "NotAllowedError")
    return "Camera permission denied. Please allow camera access in your browser site settings.";
  if (name === "NotFoundError") return "No camera found on this device.";
  if (name === "NotReadableError")
    return "Camera is already in use by another app (e.g., Messenger/Zoom/Camera). Close it and try again.";
  if (name === "SecurityError") return "Camera access requires HTTPS (or localhost).";
  return err?.message || "Unable to access camera.";
}

// --------------------------- plot center fallback ---------------------------
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api"; // ✅ fallback to avoid env crash
const API_ORIGIN = String(API_BASE || "").replace(/\/api\/?$/, "");

function centerOfGeometry(geom) {
  if (!geom || !geom.type) return null;

  const pts = [];
  const walk = (c) => {
    if (!c) return;
    if (typeof c[0] === "number" && typeof c[1] === "number") {
      // GeoJSON coordinate pair [lng, lat]
      pts.push(c);
      return;
    }
    if (Array.isArray(c)) c.forEach(walk);
  };
  walk(geom.coordinates);

  if (!pts.length) return null;

  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;

  for (const [lng, lat] of pts) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return null;
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

function resolvePhotoSrc(photoUrl) {
  if (!photoUrl) return "";
  const u = String(photoUrl).trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return `${API_ORIGIN}${u.startsWith("/") ? u : `/${u}`}`;
}

function getPhotoUrlFromAnything(row, qrData) {
  return row?.photo_url || row?.photoUrl || qrData?.photo_url || qrData?.photoUrl || "";
}

async function fetchPlotCenterById(plotId) {
  if (!plotId) return null;

  try {
    const res = await fetch(`${API_BASE}/plot/${encodeURIComponent(String(plotId))}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;

    const json = await res.json().catch(() => null);
    const feature = json?.data?.feature || json?.data || json?.feature || json;
    const geom = feature?.geometry || feature?.geom || null;
    return centerOfGeometry(geom);
  } catch (e) {
    console.warn("fetchPlotCenterById failed:", e);
    return null;
  }
}

// --------------------------- utils: QR parsing ---------------------------
function parseLatLngFromToken(token) {
  if (!token) return null;
  const raw = String(token).trim();

  const tryJson = (text) => {
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === "object") {
        if (Number.isFinite(+obj.lat) && Number.isFinite(+obj.lng)) {
          return { lat: +obj.lat, lng: +obj.lng, data: obj };
        }
        if (Number.isFinite(+obj.latitude) && Number.isFinite(+obj.longitude)) {
          return { lat: +obj.latitude, lng: +obj.longitude, data: obj };
        }

        // deep scan
        const stack = [obj];
        while (stack.length) {
          const cur = stack.pop();
          if (cur && typeof cur === "object") {
            if (Number.isFinite(+cur.lat) && Number.isFinite(+cur.lng)) {
              return { lat: +cur.lat, lng: +cur.lng, data: obj };
            }
            if (Number.isFinite(+cur.latitude) && Number.isFinite(+cur.longitude)) {
              return { lat: +cur.latitude, lng: +cur.longitude, data: obj };
            }
            for (const v of Object.values(cur)) {
              if (!v) continue;
              if (
                typeof v === "string" &&
                v.trim().startsWith("{") &&
                v.trim().endsWith("}")
              ) {
                try {
                  stack.push(JSON.parse(v));
                } catch {}
              } else if (typeof v === "object") {
                stack.push(v);
              }
            }
          }
        }
        return { lat: null, lng: null, data: obj };
      }
    } catch {}
    return null;
  };

  const jsonAttempt = tryJson(raw);
  if (jsonAttempt) return jsonAttempt;

  const mGeo = raw.match(/^geo:([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/i);
  if (mGeo) return { lat: +mGeo[1], lng: +mGeo[2], data: null };

  const mPair = raw.match(/([+-]?\d+(?:\.\d+)?)\s*[,\s]\s*([+-]?\d+(?:\.\d+)?)/i);
  if (mPair) {
    const a = +mPair[1],
      b = +mPair[2];
    const looksLikeLatLng = Math.abs(a) <= 90 && Math.abs(b) <= 180;
    const looksLikeLngLat = Math.abs(a) <= 180 && Math.abs(b) <= 90 && !looksLikeLatLng;
    if (looksLikeLatLng) return { lat: a, lng: b, data: null };
    if (looksLikeLngLat) return { lat: b, lng: a, data: null };
    return { lat: a, lng: b, data: null };
  }

  return { lat: null, lng: null, data: null };
}

const QR_LABELS = {
  person_full_name: "Full Name",
  deceased_name: "Deceased Name",
  birth_date: "Birth Date",
  death_date: "Death Date",
  burial_date: "Burial Date",
};

const capitalizeLabelFromKey = (k) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const formatQrValue = (key, value) => {
  if (value == null || value === "") return "—";
  if (key === "lat" || key === "lng")
    return Number.isFinite(+value) ? (+value).toFixed(6) : String(value);
  if (/(_date$|^created_at$|^updated_at$)/.test(key)) return formatDate(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const unwrapRows = (payload) =>
  Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];

function qrDisplayEntries(data) {
  const omit = new Set([
    "_type",
    "id",
    "uid",
    "plot_id",
    "family_contact",
    "is_active",
    "lat",
    "lng",
    "created_at",
    "updated_at",
    "headstone_type",
    "memorial_text",
  ]);
  return Object.entries(data)
    .filter(([k]) => !omit.has(k))
    .map(([k, v]) => ({
      key: k,
      label: QR_LABELS[k] ?? capitalizeLabelFromKey(k),
      value: formatQrValue(k, v),
    }));
}

// --------------------------- utils: name matching ---------------------------
const normalizeName = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function levenshtein(a, b) {
  a = a || "";
  b = b || "";
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );

  return dp[m][n];
}

const similarity = (a, b) => {
  const A = normalizeName(a),
    B = normalizeName(b);
  if (!A && !B) return 1;
  const dist = levenshtein(A, B);
  return 1 - dist / Math.max(A.length, B.length);
};

const getDeceasedName = (r) =>
  (
    r?.person_full_name ??
    r?.personFullName ??
    r?.person_name ??
    r?.personName ??
    r?.full_name ??
    r?.fullName ??
    r?.name ??
    ""
  )
    .toString()
    .trim();

/**
 * "Search Name" = QR token name first,
 * fallback to DB fields only if QR payload has no name.
 */
function nameFromQrToken(qrToken) {
  const parsed = parseLatLngFromToken(qrToken);
  const d = parsed?.data;

  if (!d || typeof d !== "object") return "";

  const byKnownKeys = getDeceasedName(d);
  if (byKnownKeys) return byKnownKeys;

  const first = (d.first_name ?? d.firstname ?? "").toString().trim();
  const middle = (d.middle_name ?? d.middlename ?? "").toString().trim();
  const last = (d.last_name ?? d.lastname ?? "").toString().trim();

  return [first, middle, last].filter(Boolean).join(" ").trim();
}

function getSearchName(row) {
  const fromQr = nameFromQrToken(row?.qr_token);
  if (fromQr) return fromQr;
  return getDeceasedName(row);
}

// --------------------------- Static Maps: polyline encode ---------------------------
function encodePolyline(points) {
  let lastLat = 0;
  let lastLng = 0;
  let result = "";

  const encodeSigned = (num) => {
    let sgnNum = num << 1;
    if (num < 0) sgnNum = ~sgnNum;
    return encodeUnsigned(sgnNum);
  };

  const encodeUnsigned = (num) => {
    let out = "";
    while (num >= 0x20) {
      out += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
      num >>= 5;
    }
    out += String.fromCharCode(num + 63);
    return out;
  };

  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);

    const dLat = lat - lastLat;
    const dLng = lng - lastLng;

    lastLat = lat;
    lastLng = lng;

    result += encodeSigned(dLat);
    result += encodeSigned(dLng);
  }

  return result;
}

function meanCenter(points) {
  if (!points?.length) return null;
  let sLat = 0,
    sLng = 0;
  for (const p of points) {
    sLat += p.lat;
    sLng += p.lng;
  }
  return { lat: sLat / points.length, lng: sLng / points.length };
}

// --------------------------- Distance helpers ---------------------------
function haversineDistanceM(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// --------------------------- Nearest CR helpers ---------------------------
function getNearestComfortRoom(userLoc, comfortRooms) {
  if (!userLoc || !Array.isArray(comfortRooms) || !comfortRooms.length) return null;

  let best = null;
  let bestD = Infinity;

  for (const cr of comfortRooms) {
    const d = haversineDistanceM(userLoc, cr.position);
    if (d < bestD) {
      bestD = d;
      best = cr;
    }
  }

  return best ? { room: best, distanceM: bestD } : null;
}

// --------------------------- Marker icons (SVG data URLs) ---------------------------
const svgToDataUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const USER_PIN_SVG = `
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0b1220" flood-opacity="0.25"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <path d="M32 4c-10.5 0-19 8.5-19 19 0 15 19 37 19 37s19-22 19-37C51 12.5 42.5 4 32 4z" fill="#0EA5E9"/>
    <circle cx="32" cy="23" r="9" fill="#ffffff" opacity="0.95"/>
    <path d="M20 42c3.5-6 20.5-6 24 0" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.95"/>
  </g>
</svg>
`;

const TARGET_PIN_SVG = `
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0b1220" flood-opacity="0.25"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <path d="M32 4c-10.5 0-19 8.5-19 19 0 15 19 37 19 37s19-22 19-37C51 12.5 42.5 4 32 4z" fill="#FB7185"/>
    <circle cx="32" cy="23" r="11" fill="#ffffff" opacity="0.95"/>
    <circle cx="32" cy="23" r="7" fill="#FB7185" opacity="0.95"/>
    <circle cx="32" cy="23" r="3" fill="#ffffff" opacity="0.95"/>
  </g>
</svg>
`;

// --------------------------- Amenities (static) ---------------------------
const COMFORT_ROOMS = [
  { id: "cr1", title: "Comfort Room 1", position: { lat: 15.495013, lng: 120.554517 } },
  { id: "cr2", title: "Comfort Room 2", position: { lat: 15.494161, lng: 120.555232 } },
];

const PARKING_LOT_PATH = [
  { lat: 15.494962, lng: 120.554452 }, // top left
  { lat: 15.494451, lng: 120.554879 }, // top right
  { lat: 15.494264, lng: 120.554623 }, // bottom right
  { lat: 15.494736, lng: 120.554232 }, // bottom left
];

const AMENITY_CR_PIN_SVG = `
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0b1220" flood-opacity="0.25"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <path d="M32 4c-10.5 0-19 8.5-19 19 0 15 19 37 19 37s19-22 19-37C51 12.5 42.5 4 32 4z" fill="#22C55E"/>
    <rect x="23.5" y="14.5" width="17" height="20" rx="4" fill="#ffffff" opacity="0.95"/>
    <rect x="28" y="19" width="8" height="10" rx="2" fill="#22C55E" opacity="0.95"/>
    <circle cx="36.5" cy="18.5" r="1.3" fill="#22C55E" opacity="0.95"/>
  </g>
</svg>
`;

const AMENITY_CR_NEAREST_PIN_SVG = `
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0b1220" flood-opacity="0.25"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <path d="M32 4c-10.5 0-19 8.5-19 19 0 15 19 37 19 37s19-22 19-37C51 12.5 42.5 4 32 4z" fill="#16A34A"/>
    <rect x="23.5" y="14.5" width="17" height="20" rx="4" fill="#ffffff" opacity="0.95"/>
    <path d="M32 16l1.6 3.2 3.5.5-2.5 2.4.6 3.5L32 23.9l-3.2 1.7.6-3.5-2.5-2.4 3.5-.5L32 16z"
      fill="#16A34A" opacity="0.95"/>
  </g>
</svg>
`;

const AMENITY_PARK_PIN_SVG = `
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0b1220" flood-opacity="0.25"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <path d="M32 4c-10.5 0-19 8.5-19 19 0 15 19 37 19 37s19-22 19-37C51 12.5 42.5 4 32 4z" fill="#F59E0B"/>
    <circle cx="32" cy="23" r="12" fill="#ffffff" opacity="0.95"/>
    <text x="32" y="28.5" text-anchor="middle" font-size="14" font-family="Arial" font-weight="700" fill="#F59E0B">P</text>
  </g>
</svg>
`;

// --------------------------- LOAD PLOTS (GeoJSON) for showing all graves ---------------------------
function normalizeFeatureCollection(body) {
  if (!body) return null;
  if (body?.type === "FeatureCollection") return body;
  if (body?.data?.type === "FeatureCollection") return body.data;
  if (body?.data?.data?.type === "FeatureCollection") return body.data.data;
  return null;
}

function featureToPath(geom) {
  if (!geom) return [];

  if (geom.type === "Polygon") {
    const ring = geom.coordinates?.[0] || [];
    return ring
      .map(([lng, lat]) => (Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null))
      .filter(Boolean);
  }

  if (geom.type === "MultiPolygon") {
    const ring = geom.coordinates?.[0]?.[0] || [];
    return ring
      .map(([lng, lat]) => (Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null))
      .filter(Boolean);
  }

  return [];
}

// =======================================================================
// Component
// =======================================================================
export default function SearchForDeceased() {
  const [mode, setMode] = useState("name"); // "name" | "qr"

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRequestingLoc, setIsRequestingLoc] = useState(false);

  // ✅ plots/graves for map rendering
  const [plotsFc, setPlotsFc] = useState(null);
  const [loadingPlots, setLoadingPlots] = useState(false);
  const [plotsError, setPlotsError] = useState("");

  const [nameQuery, setNameQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [notFoundMsg, setNotFoundMsg] = useState("");

  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  const [selected, setSelected] = useState(null);

  const [scanDataForSelected, setScanDataForSelected] = useState(null);
  const [scanResult, setScanResult] = useState(null);

  const [locationConsent, setLocationConsent] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // ✅ track where userLocation came from
  // "gps" = real location, "entrance" = fallback, "none" = not set yet
  const [locationSource, setLocationSource] = useState("none");

  const [graph, setGraph] = useState(null);

  const [routeStatus, setRouteStatus] = useState("");
  const [routeDistance, setRouteDistance] = useState(0);
  const [routePath, setRoutePath] = useState([]);
  const [routeSteps, setRouteSteps] = useState([]);

  const hasGoodLocationRef = useRef(false);

  const geoWatchIdRef = useRef(null);
  const [mapCoords, setMapCoords] = useState(null);

  // Scan modal
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanMode, setScanMode] = useState("choose");
  const [scanErr, setScanErr] = useState("");
  const videoRef = useRef(null);
  const rafRef = useRef(0);
  const fileRef = useRef(null);
  const canvasRef = useRef(null);

  const DEFAULT_START = CEMETERY_ENTRANCE;

  // map instance for UX controls
  const mapRef = useRef(null);
  const handleMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // -------------------------- Build graph on mount --------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      setRouteStatus("Loading cemetery road network…");
      try {
        const inputs = [...INITIAL_ROAD_SEGMENTS];
        setRouteStatus("Building routing graph (connecting intersections)…");

        const g = buildGraph(inputs, {
          onlySegments: true,
          splitIntersections: true,
          junctionSnapM: 1.5,
          snapM: 2.5,
          snapK: 4,
        });

        if (!alive) return;

        setGraph(g);
        setRouteStatus(`Graph ready (${Object.keys(g).length} nodes)`);
      } catch (e) {
        console.error("Graph building failed:", e);
        setRouteStatus("Graph building failed");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // -------------------------- Load burial records --------------------------
  useEffect(() => {
    let ignore = false;
    const ac = new AbortController();

    setLoading(true);
    setError("");

    fetchBurialRecords({ limit: 2000, offset: 0, signal: ac.signal })
      .then((payload) => !ignore && setRows(unwrapRows(payload)))
      .catch((e) => !ignore && setError(e.message || "Failed to load"))
      .finally(() => !ignore && setLoading(false));

    return () => {
      ignore = true;
      ac.abort();
    };
  }, []);

  // -------------------------- Load plots/graves GeoJSON --------------------------
  useEffect(() => {
    let ignore = false;
    const ac = new AbortController();

    (async () => {
      setLoadingPlots(true);
      setPlotsError("");

      try {
        const res = await fetch(`${API_BASE}/plot/`, {
          signal: ac.signal,
          headers: { Accept: "application/json" },
        });

        const ct = res.headers.get("content-type") || "";
        const body = ct.includes("application/json") ? await res.json() : await res.text();

        if (!res.ok) {
          const msg =
            typeof body === "string" ? body : body?.message || "Failed to load plots";
          throw new Error(msg);
        }

        const fc = normalizeFeatureCollection(body);
        if (!fc?.features?.length) {
          throw new Error("Plots loaded but no features returned.");
        }

        if (!ignore) setPlotsFc(fc);
      } catch (e) {
        if (!ignore) setPlotsError(e?.message || "Failed to load plots.");
      } finally {
        if (!ignore) setLoadingPlots(false);
      }
    })();

    return () => {
      ignore = true;
      ac.abort();
    };
  }, []);

  // -------------------------- Location permission ---------------------------
  // Ask only when we have a destination and still no start
  useEffect(() => {
    if (!mapCoords) return;
    if (!userLocation && !locationConsent) setLocationModalOpen(true);
  }, [mapCoords, userLocation, locationConsent]);

  // ✅ No geofence gating here — always attempt live location (if allowed)
  const requestUserLocation = useCallback(() => {
    setIsRequestingLoc(true);
    setLocationConsent(true);
    setLocationModalOpen(false);

    hasGoodLocationRef.current = false;
    setUserLocation(null);
    setLocationSource("none");
    setRouteStatus("Requesting your location…");

    if (!("geolocation" in navigator)) {
      setUserLocation(DEFAULT_START);
      setLocationSource("entrance");
      setRouteStatus("Geolocation not supported. Starting from cemetery entrance.");
      setIsRequestingLoc(false);
      return;
    }

    if (!isSecureForDeviceAPIs()) {
      setUserLocation(DEFAULT_START);
      setLocationSource("entrance");
      setRouteStatus(
        "Location blocked by browser (needs HTTPS or localhost). Starting from cemetery entrance."
      );
      setIsRequestingLoc(false);
      return;
    }

    if (geoWatchIdRef.current) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }

    const startWatch = () => {
      geoWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const loc = { lat: latitude, lng: longitude };

          hasGoodLocationRef.current = true;
          setUserLocation(loc);
          setLocationSource("gps");
          setRouteStatus(`Live location ✅ (±${Math.round(accuracy || 0)}m)`);
        },
        (err) => {
          console.warn("watchPosition error:", err);
          if (!hasGoodLocationRef.current) {
            setUserLocation(DEFAULT_START);
            setLocationSource("entrance");
            setRouteStatus("Location updates failed. Starting from cemetery entrance.");
          } else {
            setRouteStatus("Location updates stopped. Using last known location.");
          }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const loc = { lat: latitude, lng: longitude };

        hasGoodLocationRef.current = true;
        setUserLocation(loc);
        setLocationSource("gps");
        setRouteStatus(`Location acquired ✅ (±${Math.round(accuracy || 0)}m)`);

        startWatch();
        setIsRequestingLoc(false);
      },
      (err) => {
        console.warn("Geolocation error:", err);

        const code = err?.code;
        const msg =
          code === 1
            ? "Location permission denied."
            : code === 2
            ? "Location unavailable. Turn on GPS / Location Services and try again."
            : code === 3
            ? "Location timed out. Try again (better signal) or use the entrance."
            : "Could not get your location.";

        setUserLocation(DEFAULT_START);
        setLocationSource("entrance");
        setRouteStatus(`${msg} Starting from cemetery entrance.`);
        setIsRequestingLoc(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [DEFAULT_START]);

  const useDefaultLocation = useCallback(() => {
    setIsRequestingLoc(false);
    setLocationConsent(true);
    setLocationModalOpen(false);
    setUserLocation(DEFAULT_START);
    setLocationSource("entrance");
    if (!routeStatus) setRouteStatus("Starting route from cemetery entrance.");
  }, [DEFAULT_START, routeStatus]);

  // ✅ Routing start logic WITHOUT geofence:
  // If you're too far from the cemetery, route from entrance (but GPS can still be acquired).
  const routingStart = useMemo(() => {
    if (!userLocation) return null;

    if (locationSource !== "gps") return DEFAULT_START;

    const dToCemetery = haversineDistanceM(userLocation, CEMETERY_CENTER);

    // If user is very far, snapping to cemetery roads will fail. Use entrance as start.
    // Adjust threshold if you want (e.g. 1000m).
    const THRESHOLD_M = 700;
    if (dToCemetery > THRESHOLD_M) return DEFAULT_START;

    return userLocation;
  }, [userLocation, locationSource, DEFAULT_START]);

  const routingSource = useMemo(() => {
    if (!routingStart) return "none";
    if (routingStart === DEFAULT_START) return "entrance";
    return "gps";
  }, [routingStart, DEFAULT_START]);

  // -------------------------- Compute / update route ------------------------
  useEffect(() => {
    let cancelled = false;

    if (!mapCoords || !routingStart || !graph) return;

    (async () => {
      try {
        setRouteStatus(
          routingSource === "entrance" && locationSource === "gps"
            ? "You’re far from the cemetery. Routing starts from the cemetery entrance (GPS still active)."
            : "Computing route along cemetery roads…"
        );
        setRouteDistance(0);
        setRoutePath([]);
        setRouteSteps([]);

        const { polyline, distance, steps, debug } = await buildRoutedPolyline(
          routingStart,
          mapCoords,
          graph,
          {
            userM: 25,
            destM: 25,
            snapMaxM: 80,
            allowFallback: false,
          }
        );

        if (cancelled) return;

        if (!polyline?.length) {
          console.warn("No route polyline. Debug:", debug);
          setRouteStatus("No road route found to that grave.");
          setRouteSteps([]);
          return;
        }

        setRouteDistance(distance || 0);
        setRoutePath(polyline);
        setRouteSteps(Array.isArray(steps) ? steps : []);
        setRouteStatus("Route ready ✅");
      } catch (e) {
        console.error("Route computation failed:", e);
        if (!cancelled) setRouteStatus("Route computation failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapCoords, routingStart, graph, routingSource, locationSource]);

  // ------------------------- Helpers: reset UI state ------------------------
  const resetAll = useCallback(() => {
    setNotFoundMsg("");
    setResults([]);
    setSuggestions([]);
    setSelected(null);
    setScanDataForSelected(null);
    setScanResult(null);
    setMapCoords(null);
    setRoutePath([]);
    setRouteDistance(0);
    setRouteSteps([]);
    setRouteStatus("");
  }, []);

  const switchMode = useCallback(
    (m) => {
      setMode(m);
      resetAll();
    },
    [resetAll]
  );

  // ------------------------- Search (server first) --------------------------
  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      resetAll();

      const q = nameQuery.trim();
      if (!q) {
        setNotFoundMsg("Please enter a name to search.");
        return;
      }

      setSearching(true);

      let baseRows = [];
      try {
        const payload = await fetchBurialRecords({
          query: q,
          q,
          limit: 250,
          offset: 0,
        });
        const apiRows = unwrapRows(payload);
        if (apiRows.length) baseRows = apiRows;
      } catch (err) {
        console.warn("Search API failed; using cached rows:", err);
      }

      if (!baseRows.length) baseRows = Array.isArray(rows) ? rows : [];

      if (!baseRows.length) {
        setNotFoundMsg("No burial records returned from the server.");
        setSearching(false);
        return;
      }

      const availableRows = baseRows.filter((r) => getSearchName(r).length > 0);

      if (!availableRows.length) {
        setNotFoundMsg(
          "Records were returned, but no usable name was found in QR token or record fields."
        );
        setSearching(false);
        return;
      }

      const withScores = availableRows
        .map((r) => ({ row: r, score: similarity(q, getSearchName(r)) }))
        .sort((a, b) => b.score - a.score);

      const STRONG = 0.7;
      const WEAK_MIN = 0.4;

      const strong = withScores.filter(({ score }) => score >= STRONG).map(({ row }) => row);

      const weak = withScores
        .filter(({ score }) => score >= WEAK_MIN && score < STRONG)
        .map(({ row }) => row);

      if (!strong.length && !weak.length) {
        setNotFoundMsg("No records found with a similar name.");
      }

      setResults(strong);
      setSuggestions(weak);

      if (strong.length === 1) {
        await handleSelect(strong[0]);
      }

      setSearching(false);
    },
    [nameQuery, rows, resetAll]
  );

  // handleSelect supports QR missing coords by fetching plot center
  async function handleSelect(row) {
    setScanResult(null);
    setSelected(row || null);

    const parsed = parseLatLngFromToken(row?.qr_token);

    let coords =
      parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)
        ? { lat: parsed.lat, lng: parsed.lng }
        : null;

    if (!coords && row?.plot_id) {
      coords = await fetchPlotCenterById(row.plot_id);
    }

    setScanDataForSelected(parsed?.data && typeof parsed.data === "object" ? parsed.data : null);

    setMapCoords(coords);

    if (!coords) {
      setRouteStatus("Selected record has no location (no lat/lng and plot lookup failed).");
    }
  }

  // ------------------------- QR -------------------------
  function closeScanModal() {
    stopCamera();
    setScanErr("");
    setScanMode("choose");
    setScanModalOpen(false);
  }

  async function startCamera() {
    setScanErr("");
    setScanMode("camera");

    if (!isSecureForDeviceAPIs()) {
      setScanModalOpen(true);
      setScanErr("Camera is blocked on this site. Use HTTPS (or localhost) to enable camera access.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanModalOpen(true);
      setScanErr("Your browser does not support camera access (getUserMedia missing).");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err) {
      setScanModalOpen(true);
      setScanErr(cameraErrToMessage(err));
      return;
    }

    setScanModalOpen(true);

    await new Promise((r) => requestAnimationFrame(r));

    const v = videoRef.current;
    if (!v) {
      stream.getTracks().forEach((t) => t.stop());
      setScanErr("Scanner UI did not initialize. Please try again.");
      return;
    }

    v.srcObject = stream;
    try {
      await v.play();
    } catch {}

    let barcodeDetector = null;
    if ("BarcodeDetector" in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats?.();
        if (!formats || formats.includes("qr_code")) {
          barcodeDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
        }
      } catch {}
    }

    let jsQRFn = null;
    try {
      const mod = await import("jsqr");
      jsQRFn = mod.default;
    } catch {}

    const tick = async () => {
      try {
        const vv = videoRef.current;
        if (!vv) return;

        if (barcodeDetector) {
          const codes = await barcodeDetector.detect(vv);
          if (codes?.length) {
            await handleQrFound(codes[0].rawValue || "");
            return;
          }
        }

        if (jsQRFn) {
          const canvas =
            canvasRef.current || (canvasRef.current = document.createElement("canvas"));

          const vw = vv.videoWidth || 640;
          const vh = vv.videoHeight || 480;

          const cw = Math.min(1024, vw);
          const ch = Math.floor((cw / vw) * vh);

          canvas.width = cw;
          canvas.height = ch;

          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(vv, 0, 0, cw, ch);
          const imageData = ctx.getImageData(0, 0, cw, ch);

          const code = jsQRFn(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });

          if (code?.data) {
            await handleQrFound(code.data);
            return;
          }
        }
      } catch {}

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    const v = videoRef.current;
    const stream = v?.srcObject;

    if (stream?.getTracks) stream.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
  }

  async function handleUploadFile(file) {
    if (!file) return;

    setScanErr("");
    setScanMode("upload");
    setScanModalOpen(true);

    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);

    try {
      const bmp = await createImageBitmap(await (await fetch(url)).blob());
      const canvas = document.createElement("canvas");
      const cw = Math.min(1600, bmp.width);
      const ch = Math.floor((cw / bmp.width) * bmp.height);
      canvas.width = cw;
      canvas.height = ch;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, cw, ch);

      if ("BarcodeDetector" in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats?.();
          if (!supported || supported.includes("qr_code")) {
            const det = new window.BarcodeDetector({ formats: ["qr_code"] });
            const codes = await det.detect(canvas);
            if (codes?.length) {
              await handleQrFound(codes[0].rawValue || "");
              cleanup();
              return;
            }
          }
        } catch {}
      }

      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const z = new BrowserQRCodeReader();
        const res = await z.decodeFromImageUrl(url);
        if (res?.getText) {
          await handleQrFound(res.getText());
          cleanup();
          return;
        }
      } catch {}

      try {
        const imageData = ctx.getImageData(0, 0, cw, ch);
        const { default: jsQR } = await import("jsqr");
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });
        if (code && code.data) {
          await handleQrFound(code.data);
          cleanup();
          return;
        }
      } catch {}

      setScanErr("No QR code detected in the image.");
    } catch (e) {
      setScanErr(e?.message || "Failed to decode QR image.");
    } finally {
      cleanup();
      setTimeout(() => setScanMode("choose"), 250);
    }
  }

  async function handleQrFound(text) {
    stopCamera();
    setScanModalOpen(false);
    setScanErr("");
    setScanMode("choose");

    resetAll();
    setMode("qr");

    const parsed = parseLatLngFromToken(text);

    let coords =
      parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)
        ? { lat: parsed.lat, lng: parsed.lng }
        : null;

    const plotIdFromQr =
      parsed?.data && typeof parsed.data === "object"
        ? parsed.data.plot_id ?? parsed.data.plotId ?? null
        : null;

    let poolLocal = Array.isArray(rows) ? rows : [];
    let matchedRow = null;

    if (plotIdFromQr != null) {
      matchedRow = poolLocal.find((r) => String(r.plot_id) === String(plotIdFromQr)) || null;

      if (!matchedRow) {
        try {
          const morePayload = await fetchBurialRecords({ limit: 5000, offset: 0 });
          const moreRows = unwrapRows(morePayload);

          if (moreRows.length) {
            setRows(moreRows);
            poolLocal = moreRows;

            matchedRow =
              poolLocal.find((r) => String(r.plot_id) === String(plotIdFromQr)) || null;
          }
        } catch (e) {
          console.warn("Could not refresh records for QR match:", e);
        }
      }

      if (matchedRow) setSelected(matchedRow);
    }

    if (!coords && plotIdFromQr) coords = await fetchPlotCenterById(plotIdFromQr);

    setMapCoords(coords);

    setScanDataForSelected(parsed?.data && typeof parsed.data === "object" ? parsed.data : null);

    setScanResult({
      token: text,
      coords,
      data: parsed?.data || null,
      plot_id: plotIdFromQr ?? null,
      matchedRow: matchedRow || null,
    });

    if (!coords) {
      setRouteStatus("QR scanned, but no location found (no lat/lng and plot lookup failed).");
    }
  }

  // ----------------------------- Result card ------------------------------
  function RecordCard({ row, onPick }) {
    const name = getSearchName(row) || "Unnamed";
    return (
      <div className="relative">
        <div className="absolute -inset-2 bg-gradient-to-br from-emerald-400/20 via-cyan-400/15 to-blue-400/20 rounded-2xl blur-xl opacity-25" />
        <Card className="group relative overflow-hidden border-white/60 dark:border-white/10 bg-white/85 dark:bg-white/5 backdrop-blur supports-[backdrop-filter]:bg-white/40 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 via-cyan-400/10 to-blue-400/10" />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-base text-slate-900 flex items-center justify-between gap-3">
              <span className="truncate">{name}</span>
              <span className="shrink-0 rounded-full border bg-white/80 px-2.5 py-1 text-[11px] text-slate-700">
                Plot: {row?.plot_id ?? "—"}
              </span>
            </CardTitle>
            <CardDescription className="text-slate-600">
              Born {formatDate(row?.birth_date)} · Died {formatDate(row?.death_date)}
            </CardDescription>
          </CardHeader>
          <CardContent className="relative flex items-center justify-end gap-3">
            <Button size="sm" onClick={() => onPick?.(row)} className="shadow-md">
              View on map
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --------------------------- Nearest CR (show only if near cemetery) -------------------
  const nearestCR = useMemo(() => {
    if (locationSource !== "gps") return null;
    if (!userLocation) return null;

    const d = haversineDistanceM(userLocation, CEMETERY_CENTER);
    if (d > 1200) return null; // hide if far away (home testing)

    return getNearestComfortRoom(userLocation, COMFORT_ROOMS);
  }, [userLocation, locationSource]);

  // --------------------------- Map props -------------------
  const mapMarkers = useMemo(() => {
    const list = [];

    const nearestId = nearestCR?.room?.id || null;

    // Amenities (always visible)
    COMFORT_ROOMS.forEach((cr) => {
      const isNearest = nearestId && cr.id === nearestId;

      list.push({
        id: cr.id,
        position: cr.position,
        title: isNearest ? `${cr.title} (Nearest)` : cr.title,
        icon: svgToDataUrl(isNearest ? AMENITY_CR_NEAREST_PIN_SVG : AMENITY_CR_PIN_SVG),
        label: isNearest ? "Nearest CR" : undefined,
        zIndex: isNearest ? 80 : 50,
      });
    });

    const parkingCenter = meanCenter(PARKING_LOT_PATH);
    if (parkingCenter) {
      list.push({
        id: "parking",
        position: parkingCenter,
        title: "Parking Lot",
        icon: svgToDataUrl(AMENITY_PARK_PIN_SVG),
        zIndex: 49,
      });
    }

    // Dynamic pins (route)
    // NOTE: If you're far away, the map is restricted to cemetery bounds in CemeteryMap,
    // so your home marker won't be visible. You can still verify Live Location via Status.
    if (userLocation) {
      list.push({
        id: "user",
        position: userLocation,
        title: "Your Location",
        iconType: "user",
        icon: svgToDataUrl(USER_PIN_SVG),
        zIndex: 1000,
      });
    }
    if (mapCoords) {
      list.push({
        id: "dest",
        position: mapCoords,
        title: "Grave Location",
        iconType: "target",
        icon: svgToDataUrl(TARGET_PIN_SVG),
        zIndex: 1001,
      });
    }

    return list;
  }, [userLocation, mapCoords, nearestCR]);

  const mapPolylines = useMemo(() => {
    if (!routePath?.length) return [];
    return [
      {
        id: "route",
        path: routePath,
        options: {
          strokeColor: "#059669",
          strokeOpacity: 0.95,
          strokeWeight: 4,
          zIndex: 999,
        },
      },
    ];
  }, [routePath]);

  // Amenities polygons (parking lot)
  const amenityPolygons = useMemo(() => {
    if (!PARKING_LOT_PATH?.length) return [];
    return [
      {
        id: "parking_poly",
        plot_name: "Parking Lot",
        status: "available",
        path: PARKING_LOT_PATH,
        options: {
          strokeColor: "#F59E0B",
          fillColor: "#F59E0B",
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillOpacity: 0.12,
          zIndex: 2,
          clickable: false,
        },
      },
    ];
  }, []);

  // ✅ Build polygons from plots FeatureCollection (THIS MAKES GRAVES SHOW)
  const selectedPlotId = useMemo(() => {
    return selected?.plot_id ?? scanResult?.plot_id ?? scanResult?.matchedRow?.plot_id ?? null;
  }, [selected, scanResult]);

  const plotPolygons = useMemo(() => {
    const features = plotsFc?.features || [];
    if (!features.length) return [];

    return features
      .map((f) => {
        const props = f.properties || {};
        const path = featureToPath(f.geometry);
        if (path.length < 3) return null;

        const id =
          props.id != null
            ? String(props.id)
            : props.uid
            ? String(props.uid)
            : undefined;

        const statusRaw = String(props.status || "").trim().toLowerCase();
        let color = "#10b981"; // available
        if (statusRaw === "reserved") color = "#f59e0b";
        else if (statusRaw === "occupied") color = "#ef4444";

        const isSelected =
          selectedPlotId != null && props.id != null && String(props.id) === String(selectedPlotId);

        const baseOptions = {
          strokeColor: color,
          fillColor: color,
          strokeOpacity: 1,
          strokeWeight: 1.2,
          fillOpacity: 0.35,
          zIndex: 10,
        };

        const selectedOptions = isSelected
          ? {
              strokeColor: "#2563eb",
              fillColor: "#60a5fa",
              strokeWeight: 4,
              fillOpacity: 0.6,
              zIndex: 999,
            }
          : {};

        return {
          ...props, // keep plot_name, uid, price, size_sqm, etc.
          id,
          status: props.status,
          path,
          options: { ...baseOptions, ...selectedOptions },
        };
      })
      .filter(Boolean);
  }, [plotsFc, selectedPlotId]);

  const hasDetailsOpen = !!selected || !!scanResult;
  const routeReady = routePath?.length > 0 && mapCoords && routingStart;

  const photoSrc = resolvePhotoSrc(
    getPhotoUrlFromAnything(
      selected || scanResult?.matchedRow,
      scanDataForSelected || scanResult?.data
    )
  );

  const deceasedNameResolved =
    getSearchName(selected) ||
    getSearchName(scanResult?.matchedRow) ||
    scanDataForSelected?.person_full_name ||
    scanResult?.data?.person_full_name ||
    scanDataForSelected?.deceased_name ||
    scanResult?.data?.deceased_name ||
    "Unknown";

  // --------------------------- Download route as IMAGE -------------------
  const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const downloadRouteImage = useCallback(async () => {
    if (!routeReady) return;

    try {
      if (!GOOGLE_KEY) {
        setRouteStatus("Missing Google Maps API key (VITE_GOOGLE_MAPS_API_KEY).");
        return;
      }

      setRouteStatus("Preparing route image download…");

      const center = meanCenter(routePath) || mapCoords || CEMETERY_CENTER;
      const enc = encodePolyline(routePath);

      const size = "900x900";
      const scale = 2;

      // use routingStart for marker "U" if routing started at entrance fallback
      const routeStartForImage = routingStart || userLocation || DEFAULT_START;

      const mUser = `color:0x0ea5e9|label:U|${routeStartForImage.lat},${routeStartForImage.lng}`;
      const mTarget = `color:0xfb7185|label:T|${mapCoords.lat},${mapCoords.lng}`;
      const path = `weight:6|color:0x059669|enc:${enc}`;

      const styles = [
        "feature:all|element:labels|visibility:off",
        "feature:landscape|element:geometry|color:0xffffff",
        "feature:landscape.natural|element:geometry|color:0xffffff",
        "feature:landscape.man_made|element:geometry|color:0xffffff",
        "feature:water|element:geometry|color:0xffffff",
        "feature:poi|visibility:off",
        "feature:transit|visibility:off",
      ];
      const styleParams = styles.map((s) => `&style=${encodeURIComponent(s)}`).join("");

      const url =
        "https://maps.googleapis.com/maps/api/staticmap" +
        `?center=${center.lat},${center.lng}` +
        `&zoom=19` +
        `&size=${size}` +
        `&scale=${scale}` +
        `&maptype=roadmap` +
        `&markers=${encodeURIComponent(mUser)}` +
        `&markers=${encodeURIComponent(mTarget)}` +
        `&path=${encodeURIComponent(path)}` +
        styleParams +
        `&key=${encodeURIComponent(GOOGLE_KEY)}`;

      const res = await fetch(url);
      if (!res.ok) {
        setRouteStatus(
          "Image download failed. Make sure Google Static Maps API is enabled for your key."
        );
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `route_${safeFileName(deceasedNameResolved)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setRouteStatus("Route image downloaded ✅");
    } catch (e) {
      console.error(e);
      setRouteStatus("Image download failed. Please check API key & Static Maps API.");
    }
  }, [
    routeReady,
    routePath,
    mapCoords,
    routingStart,
    userLocation,
    DEFAULT_START,
    deceasedNameResolved,
    GOOGLE_KEY,
  ]);

  // UX controls
  const fitCemetery = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.panTo(CEMETERY_CENTER);
    map.setZoom(17);
  }, []);

  const fitRoute = useCallback(() => {
    const g = window.google?.maps;
    const map = mapRef.current;
    if (!g || !map) return;

    const bounds = new g.LatLngBounds();
    if (routingStart) bounds.extend(routingStart);
    if (mapCoords) bounds.extend(mapCoords);
    if (Array.isArray(routePath)) routePath.forEach((p) => bounds.extend(p));

    try {
      map.fitBounds(bounds, 60);
    } catch {}
  }, [routingStart, mapCoords, routePath]);

  const centerToYou = useCallback(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    map.panTo(userLocation);
    map.setZoom(19);
  }, [userLocation]);

  const centerToGrave = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapCoords) return;
    map.panTo(mapCoords);
    map.setZoom(19);
  }, [mapCoords]);

  // Cleanup on unmount: stop watch + camera
  useEffect(() => {
    return () => {
      try {
        if (geoWatchIdRef.current) {
          navigator.geolocation.clearWatch(geoWatchIdRef.current);
          geoWatchIdRef.current = null;
        }
      } catch {}
      try {
        cancelAnimationFrame(rafRef.current);
      } catch {}
      try {
        const v = videoRef.current;
        const stream = v?.srcObject;
        if (stream?.getTracks) stream.getTracks().forEach((t) => t.stop());
        if (v) v.srcObject = null;
      } catch {}
    };
  }, []);

  // =======================================================================
  // UI
  // =======================================================================
  return (
    <div className="relative min-h-screen font-poppins">
      {/* Backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 via-cyan-50 to-blue-100" />
        <div className="absolute -top-24 -left-24 h-[32rem] w-[32rem] rounded-full bg-emerald-300/50 blur-3xl dark:bg-emerald-500/10" />
        <div className="absolute top-1/3 right-0 h-[28rem] w-[28rem] rounded-full bg-cyan-300/50 blur-3xl dark:bg-cyan-700/20" />
        <div className="absolute -bottom-32 left-1/4 h-[24rem] w-[24rem] rounded-full bg-blue-300/40 blur-3xl dark:bg-blue-700/20" />
      </div>

      {/* Header */}
      <section className="pt-24 pb-8">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <div className="mb-3 text-sm text-slate-500">
            <NavLink to="/" className="hover:text-slate-700">
              Home
            </NavLink>
            &nbsp;›&nbsp;
            <span className="text-slate-700">Search For Deceased</span>
          </div>

          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-br from-emerald-400/25 via-cyan-400/20 to-blue-400/25 rounded-3xl blur-xl opacity-40" />

            <Card className="relative overflow-hidden border-white/60 dark:border-white/10 bg-white/85 dark:bg-white/5 backdrop-blur supports-[backdrop-filter]:bg-white/40 shadow-lg rounded-3xl">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/12 via-cyan-400/10 to-blue-400/12" />

              <CardHeader className="relative pb-3">
                <div className="flex flex-col gap-2">
                  <CardTitle className="text-2xl sm:text-3xl text-slate-900">
                    Find a Grave
                  </CardTitle>

                  <div className="w-full rounded-3xl border bg-white/80 px-6 py-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl sm:text-4xl leading-none text-slate-700">❝</span>

                      <div className="flex-1">
                        <div className="text-lg sm:text-2xl md:text-3xl font-semibold italic text-slate-800 leading-snug">
                          {MEMORIAL_QUOTE}
                        </div>
                        <div className="mt-2 text-xs sm:text-sm text-slate-500">
                          Memorial quote
                        </div>
                      </div>

                      <span className="text-3xl sm:text-4xl leading-none text-slate-700">❞</span>
                    </div>
                  </div>

                  <CardDescription className="text-slate-600 max-w-3xl">
                    The map below always shows{" "}
                    <span className="font-semibold">all graves/plots</span>.
                    Search by name or scan a QR to pin a specific grave and
                    (optionally) compute a route.
                  </CardDescription>
                </div>

                {/* Mode switch */}
                <div className="mt-5 inline-flex rounded-2xl border bg-white/80 p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => switchMode("name")}
                    aria-pressed={mode === "name"}
                    className={[
                      "px-4 py-2 text-sm rounded-xl transition outline-none",
                      "focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                      mode === "name"
                        ? "bg-slate-900 text-white shadow"
                        : "text-slate-700 hover:bg-slate-100",
                    ].join(" ")}
                  >
                    🔎 Search by Name
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("qr")}
                    aria-pressed={mode === "qr"}
                    className={[
                      "px-4 py-2 text-sm rounded-xl transition outline-none",
                      "focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                      mode === "qr"
                        ? "bg-slate-900 text-white shadow"
                        : "text-slate-700 hover:bg-slate-100",
                    ].join(" ")}
                  >
                    📷 Scan QR
                  </button>
                </div>
              </CardHeader>

              <CardContent className="relative">
                {mode === "name" ? (
                  <form
                    onSubmit={onSubmit}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                  >
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label htmlFor="nameQuery" className="mb-1 block text-sm text-slate-600">
                        Deceased Name
                      </label>
                      <Input
                        id="nameQuery"
                        value={nameQuery}
                        onChange={(e) => setNameQuery(e.target.value)}
                        placeholder="e.g., Juan Dela Cruz"
                        className="h-11 rounded-xl"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Tip: You can type partial names. Results are fuzzy-matched.
                      </div>
                    </div>

                    <div className="sm:col-span-1 lg:col-span-1 flex gap-2 items-end">
                      <Button type="submit" disabled={searching} className="h-11 rounded-xl">
                        {searching ? "Searching…" : "Search"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl"
                        onClick={() => {
                          setNameQuery("");
                          resetAll();
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-2xl border bg-white/75 p-4">
                      <div className="font-semibold text-slate-900">Scan a QR Code</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Step 1: Scan or upload the QR. Step 2: Allow location (or
                        use entrance). Step 3: View the grave pinned on the map.
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button onClick={startCamera} className="h-12 rounded-xl">
                        Open Camera Scanner
                      </Button>

                      <Button
                        variant="outline"
                        className="h-12 rounded-xl"
                        onClick={() => fileRef.current?.click?.()}
                      >
                        Upload QR Image
                      </Button>

                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onClick={(e) => {
                          e.currentTarget.value = "";
                        }}
                        onChange={(e) => handleUploadFile(e.target.files?.[0] || null)}
                      />
                    </div>

                    <div className="text-xs text-slate-500">
                      QR should include <code>lat/lng</code> (or{" "}
                      <code>latitude/longitude</code>) OR a valid <code>plot_id</code>.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Loading / error */}
      <section className="pb-6">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8 space-y-3">
          {loading && (
            <Card className="bg-white/80 backdrop-blur shadow-md rounded-2xl">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-1/3 rounded bg-slate-200" />
                  <div className="h-4 w-2/3 rounded bg-slate-200" />
                  <div className="h-10 w-full rounded bg-slate-200" />
                </div>
              </CardContent>
            </Card>
          )}
          {error && (
            <Card className="bg-white/80 backdrop-blur shadow-md border-rose-200 rounded-2xl">
              <CardContent className="p-6 text-center text-rose-600">{error}</CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Results (only show in Search mode) */}
      {mode === "name" && (results.length > 0 || suggestions.length > 0 || notFoundMsg) && (
        <section className="pb-2">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-8 space-y-4">
            {notFoundMsg && (
              <Card className="bg-white/80 backdrop-blur shadow-md border-amber-200 rounded-2xl">
                <CardContent className="p-6 text-center text-slate-700">
                  <div className="text-lg">No match found</div>
                  <div className="mt-1 text-sm text-slate-600">{notFoundMsg}</div>
                </CardContent>
              </Card>
            )}

            {results.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">
                  Best matches ({results.length})
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {results.map((r) => (
                    <RecordCard
                      key={`res-${r.id ?? `${r.plot_id}-${getSearchName(r)}`}`}
                      row={r}
                      onPick={handleSelect}
                    />
                  ))}
                </div>
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">
                  Other possible matches ({suggestions.length})
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {suggestions.map((r) => (
                    <RecordCard
                      key={`sug-${r.id ?? `${r.plot_id}-${getSearchName(r)}`}`}
                      row={r}
                      onPick={handleSelect}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ALWAYS SHOW MAP + details panel */}
      <section className="pb-10">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="overflow-hidden lg:col-span-2 border-white/60 bg-white/85 backdrop-blur shadow-lg rounded-3xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                  Cemetery Map
                  <span className="rounded-full border bg-white/80 px-2.5 py-1 text-[11px] text-slate-700">
                    {mode === "qr" ? "via QR" : "via Name Search"}
                  </span>
                  <span className="rounded-full border bg-white/80 px-2.5 py-1 text-[11px] text-slate-700">
                    All graves shown
                  </span>
                  <span className="rounded-full border bg-white/80 px-2.5 py-1 text-[11px] text-slate-700">
                    Amenities shown (CR + Parking)
                  </span>
                </CardTitle>

                <CardDescription className="flex flex-wrap items-center gap-2">
                  {routeDistance > 0 && (
                    <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs text-slate-700 shadow-sm">
                      Distance: <span className="font-semibold">{fmtDistance(routeDistance)}</span>
                    </span>
                  )}

                  {nearestCR?.room && (
                    <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs text-slate-700 shadow-sm">
                      Nearest CR: <span className="font-semibold">{nearestCR.room.title}</span>
                      <span className="text-slate-500">({Math.round(nearestCR.distanceM)}m)</span>
                    </span>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {plotsError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {plotsError}
                  </div>
                )}

                {loadingPlots && (
                  <div className="text-sm text-slate-600 border bg-white/80 px-3 py-2 rounded-xl">
                    Loading graves/plots on the map…
                  </div>
                )}

                {routeStatus && (
                  <div className="text-sm text-slate-700 border bg-white/80 px-3 py-2 rounded-xl">
                    <span className="font-semibold">Status:</span> {routeStatus}
                  </div>
                )}

                {/* Controls */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={fitCemetery} className="rounded-xl">
                    Fit Cemetery
                  </Button>
                  <Button
                    variant="outline"
                    onClick={fitRoute}
                    disabled={!routeReady}
                    className="rounded-xl"
                  >
                    Fit Route
                  </Button>
                  <Button
                    variant="outline"
                    onClick={centerToYou}
                    disabled={!userLocation}
                    className="rounded-xl"
                  >
                    Center: You
                  </Button>
                  <Button
                    variant="outline"
                    onClick={centerToGrave}
                    disabled={!mapCoords}
                    className="rounded-xl"
                  >
                    Center: Grave
                  </Button>
                  <Button
                    onClick={downloadRouteImage}
                    disabled={!routeReady}
                    className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl"
                  >
                    Download Route Image
                  </Button>
                </div>

                <div className="w-full h-[520px] rounded-2xl border overflow-hidden shadow-sm">
                  <CemeteryMap
                    clickable={false}
                    showLegend={false}
                    showGeofence={false}
                    showInitialRoads={false}
                    polygons={[...amenityPolygons, ...plotPolygons]}
                    center={mapCoords || CEMETERY_CENTER}
                    zoom={mapCoords ? 19 : 17}
                    markers={mapMarkers}
                    polylines={routeReady ? mapPolylines : []}
                    onMapLoad={handleMapLoad}
                  />
                </div>

                {!hasDetailsOpen && (
                  <div className="rounded-2xl border bg-white/90 p-4 shadow-sm">
                    <div className="font-semibold text-slate-800">Tip</div>
                    <div className="text-sm text-slate-600 mt-1">
                      The map already shows <span className="font-semibold">all graves</span>{" "}
                      plus <span className="font-semibold">comfort rooms</span> and{" "}
                      <span className="font-semibold">parking</span>. Use Search or QR to
                      pin a grave and generate directions.
                    </div>
                  </div>
                )}

                {hasDetailsOpen && (
                  <div className="rounded-2xl border bg-white/90 p-4 shadow-sm">
                    <div className="font-semibold text-slate-800">How to get there</div>
                    <div className="text-sm text-slate-600 mt-1">
                      Your location uses the <span className="font-semibold">blue pin</span> and
                      the grave uses the <span className="font-semibold">pink target pin</span>.
                      {locationSource === "gps" ? (
                        <span className="ml-2 text-emerald-700 text-xs font-medium">
                          (Live GPS enabled)
                        </span>
                      ) : (
                        <span className="ml-2 text-slate-500 text-xs font-medium">
                          (Starting from entrance)
                        </span>
                      )}
                    </div>

                    {routeSteps?.length ? (
                      <ol className="mt-3 space-y-2 list-decimal pl-5 text-sm text-slate-700">
                        {routeSteps.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ol>
                    ) : (
                      <div className="mt-3 text-sm text-slate-500">
                        Directions will appear once the route is ready.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/60 bg-white/85 backdrop-blur shadow-lg rounded-3xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Details</CardTitle>
                <CardDescription className="text-slate-600">
                  {hasDetailsOpen ? (
                    <>
                      Deceased:{" "}
                      <span className="font-semibold">{deceasedNameResolved}</span>
                      {scanResult?.matchedRow?.plot_id && (
                        <span className="ml-2 text-emerald-700 text-xs font-medium">
                          (matched by plot_id)
                        </span>
                      )}
                    </>
                  ) : (
                    "Select a record to view details."
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-2">
                {hasDetailsOpen && photoSrc ? (
                  <div className="rounded-2xl border bg-white p-2 shadow-sm">
                    <img
                      src={photoSrc}
                      alt={`Photo of ${deceasedNameResolved}`}
                      className="w-full h-56 object-cover rounded-xl"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                ) : hasDetailsOpen ? (
                  <div className="text-xs text-slate-500">No photo uploaded for this record.</div>
                ) : (
                  <div className="rounded-2xl border bg-white/80 p-4 text-sm text-slate-600">
                    Search a name or scan a QR to pin a grave and show info here.
                  </div>
                )}

                {hasDetailsOpen && (selected || scanResult?.matchedRow) ? (
                  <div className="space-y-2 text-sm">
                    <div>
                      <div className="text-slate-500">Deceased Name</div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 break-words shadow-sm">
                        {getSearchName(selected || scanResult?.matchedRow) || "—"}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-slate-500">Birth Date</div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm">
                          {formatDate((selected || scanResult?.matchedRow)?.birth_date)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Death Date</div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm">
                          {formatDate((selected || scanResult?.matchedRow)?.death_date)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500">Plot</div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm">
                        {(selected || scanResult?.matchedRow)?.plot_id ?? "—"}
                      </div>
                    </div>
                  </div>
                ) : hasDetailsOpen && scanDataForSelected ? (
                  <div className="space-y-2">
                    {(() => {
                      const entries = qrDisplayEntries(scanDataForSelected);
                      if (entries.length === 0)
                        return <div className="text-sm text-slate-500">No displayable fields.</div>;
                      return entries.map(({ key, label, value }) => (
                        <div key={key} className="text-sm">
                          <div className="text-slate-500">{label}</div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 break-words shadow-sm">
                            {value}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {hasDetailsOpen && (
            <div className="text-center flex flex-wrap justify-center gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => resetAll()}>
                Back
              </Button>

              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  switchMode("name");
                  setNameQuery("");
                }}
              >
                New Search
              </Button>

              <Button variant="outline" className="rounded-xl" onClick={() => switchMode("qr")}>
                Scan Another QR
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Scan Modal */}
      <Dialog
        open={scanModalOpen}
        onOpenChange={(o) => (o ? setScanModalOpen(true) : closeScanModal())}
      >
        <DialogContent
          className="sm:max-w-2xl rounded-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>QR Scanner</DialogTitle>
            <DialogDescription>
              Point your camera at the QR code. We’ll auto-detect it and pin the grave on the map.
            </DialogDescription>
          </DialogHeader>

          {scanMode === "camera" && (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden border">
                <div className="w-full aspect-video bg-muted/40">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    autoPlay
                  />
                </div>
              </div>

              {scanErr && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
                  {scanErr}
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    stopCamera();
                    setScanModalOpen(false);
                    setScanMode("choose");
                  }}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}

          {scanMode === "upload" && (
            <div className="text-sm text-slate-600">
              Processing image…{" "}
              {scanErr && <span className="text-rose-600 font-medium ml-2">{scanErr}</span>}
            </div>
          )}

          {scanMode === "choose" && scanErr && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
              {scanErr}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Location Modal */}
      <Dialog
        open={locationModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLocationModalOpen(false);

            // ✅ only default to entrance if user did NOT click Allow
            if (!locationConsent && !isRequestingLoc) {
              useDefaultLocation();
            }
            return;
          }

          setLocationModalOpen(true);
        }}
      >
        <DialogContent
          className="sm:max-w-md rounded-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Use Your Location?</DialogTitle>
            <DialogDescription>
              If you allow location access, we’ll try to start the route from where you are.
              If you are far from the cemetery, routing may start from the cemetery entrance (but
              your GPS can still be acquired).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl" onClick={useDefaultLocation}>
              Use Cemetery Entrance
            </Button>
            <Button className="rounded-xl" onClick={requestUserLocation}>
              Allow Location Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
