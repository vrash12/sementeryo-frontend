
// frontend/src/components/map/CemeteryMap.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleMap,
  Marker,
  Polygon,
  Polyline,
  DrawingManager,
  useJsApiLoader,
} from "@react-google-maps/api";

import { Button } from "../../components/ui/button";
import DetailsModal from "../../views/components/DetailsModal";
import ReservationDialog from "../../views/visitor/components/ReservationDialog";
import { hasRole } from "../../utils/auth";
import { toast } from "sonner";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "/api";
const IMG_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL_IMAGE) || API_BASE;

// ---- Shared cemetery geometry ----
export const CEMETERY_CENTER = {
  lat: 15.4948545,
  lng: 120.5550455,
};

export const CEMETERY_ENTRANCE = {
  lat: 15.494175676617589,
  lng: 120.55463847892524,
};

// ============================================================================
// GEOFENCE DEFINITIONS (ALL SECTIONS)
// ============================================================================
export const BASE_GEOFENCE_POLYGON = [
  { lat: 15.494519, lng: 120.554952 },
  { lat: 15.494804, lng: 120.554709 },
  { lat: 15.49519, lng: 120.555092 },
  { lat: 15.494837, lng: 120.555382 },
];

export const EXTRA1_GEOFENCE_POLYGON = [
  { lat: 15.49525, lng: 120.555145 },
  { lat: 15.494827, lng: 120.555488 },
  { lat: 15.495007, lng: 120.555737 },
  { lat: 15.495466, lng: 120.555366 },
];

export const EXTRA2_GEOFENCE_POLYGON = [
  { lat: 15.49551, lng: 120.555417 },
  { lat: 15.495057, lng: 120.555786 },
  { lat: 15.495091, lng: 120.555841 },
  { lat: 15.495573, lng: 120.555461 },
];

export const EXTRA3_GEOFENCE_POLYGON = [
  { lat: 15.494942, lng: 120.554601 },
  { lat: 15.49486, lng: 120.554651 },
  { lat: 15.495257, lng: 120.555061 },
  { lat: 15.495347, lng: 120.554962 },
];

export const EXTRA4_GEOFENCE_POLYGON = [
  { lat: 15.4943905, lng: 120.5550505 },
  { lat: 15.4942253, lng: 120.5551791 },
  { lat: 15.4945557, lng: 120.5555986 },
  { lat: 15.4947143, lng: 120.5554745 },
];

export const EXTRA5_GEOFENCE_POLYGON = [
  { lat: 15.495627, lng: 120.555499 },
  { lat: 15.495127, lng: 120.555889 },
  { lat: 15.495177, lng: 120.555952 },
  { lat: 15.495673, lng: 120.555543 },
];

export const EXTRA6_GEOFENCE_POLYGON = [
  { lat: 15.495711403125703, lng: 120.55557900352841 }, // BL
  { lat: 15.495769559138362, lng: 120.55564002377788 }, // TL
  { lat: 15.49524033884679, lng: 120.55604302567154 }, // TR
  { lat: 15.49520350661523, lng: 120.55599943977671 }, // BR
];

export const GEOFENCE_POLYGONS = [
  BASE_GEOFENCE_POLYGON,
  EXTRA1_GEOFENCE_POLYGON,
  EXTRA2_GEOFENCE_POLYGON,
  EXTRA3_GEOFENCE_POLYGON,
  EXTRA4_GEOFENCE_POLYGON,
  EXTRA5_GEOFENCE_POLYGON,
  EXTRA6_GEOFENCE_POLYGON,
];

const ALL_POINTS = GEOFENCE_POLYGONS.reduce((acc, poly) => acc.concat(poly), []);
const lats = ALL_POINTS.map((p) => p.lat);
const lngs = ALL_POINTS.map((p) => p.lng);

export const CEMETERY_BOUNDS = {
  north: Math.max(...lats),
  south: Math.min(...lats),
  east: Math.max(...lngs),
  west: Math.min(...lngs),
};

// ============================================================================
// INITIAL ROADS (YELLOW LINES), kept for routing graph, hidden by default
// ============================================================================
export const INITIAL_ROAD_SEGMENTS = [
  {
    id: "MAIN_ROAD_A",
    from: { lat: 15.494204941386018, lng: 120.554605304102 },
    to: { lat: 15.494854814113388, lng: 120.55545786787883 },
  },
  {
    id: "MAIN_ROAD_B",
    from: { lat: 15.494137563161392, lng: 120.55462785871107 },
    to: { lat: 15.49525256129744, lng: 120.5560871411545 },
  },
  {
    id: "MAIN_ROAD_C",
    from: { lat: 15.494943558259884, lng: 120.554547927049 },
    to: { lat: 15.494164967630882, lng: 120.55516242804077 },
  },
  {
    id: "MAIN_ROAD_D",
    from: { lat: 15.494168622992797, lng: 120.55515484160878 },
    to: { lat: 15.494557918667045, lng: 120.55565175290458 },
  },
  {
    id: "MAIN_ROAD_E",
    from: { lat: 15.495384027246267, lng: 120.55497087063283 },
    to: { lat: 15.494561574022015, lng: 120.55565933933656 },
  },
  {
    id: "MAIN_ROAD_F",
    from: { lat: 15.494793688944096, lng: 120.55462379138424 },
    to: { lat: 15.495996295868565, lng: 120.55585848319174 },
  },
  {
    id: "MAIN_ROAD_G",
    from: { lat: 15.49552293014835, lng: 120.55535777867995 },
    to: { lat: 15.494981939426166, lng: 120.55578641208778 },
  },
  {
    id: "MAIN_ROAD_H",
    from: { lat: 15.494952775409871, lng: 120.55455808467482 },
    to: { lat: 15.496135295447349, lng: 120.5557848630519 },
  },
  {
    id: "MAIN_ROAD_I",
    from: { lat: 15.495619645834816, lng: 120.55545629246764 },
    to: { lat: 15.495078147745525, lng: 120.55588678699803 },
  },
  {
    id: "MAIN_ROAD_J",
    from: { lat: 15.49572949610942, lng: 120.55553273542162 },
    to: { lat: 15.495155689325069, lng: 120.55600078087679 },
  },
  {
    id: "MAIN_ROAD_K",
    from: { lat: 15.495817376287063, lng: 120.55563600046474 },
    to: { lat: 15.49522547672178, lng: 120.55607051830849 },
  },
];

export const INITIAL_ROAD_POLYLINES = INITIAL_ROAD_SEGMENTS.map((seg) => ({
  id: seg.id,
  path: [seg.from, seg.to],
  options: {
    strokeColor: "#facc15",
    strokeOpacity: 1,
    strokeWeight: 8,
    zIndex: 50,
  },
}));

function isInsideSinglePolygon(lat, lng, polygon) {
  const x = lng;
  const y = lat;
  const poly = polygon.map((p) => ({ x: p.lng, y: p.lat }));
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isInsideGeofence(lat, lng, polygons = GEOFENCE_POLYGONS) {
  return polygons.some((poly) => isInsideSinglePolygon(lat, lng, poly));
}

const containerStyle = {
  width: "100%",
  height: "100%",
};

const LIBRARIES = ["drawing", "geometry"];

// Resolve backend-stored paths like "/uploads/..." into a usable URL
function resolveAssetUrl(v) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) return raw;

  const base = String(IMG_BASE || API_BASE || "").replace(/\/+$/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

// IMPORTANT: include photo for deceased here (type: "image")
const DEFAULT_MODAL_FIELDS = [
  { name: "photo_url", label: "Photo", type: "image" },
  {
    name: "death_certificate_url",
    label: "Death Certificate",
    type: "text",
    formatter: (raw) => {
      const href = resolveAssetUrl(raw);
      if (!href) return "—";
      const lower = href.toLowerCase();
      const isPdf = lower.endsWith(".pdf");
      const isImg =
        lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp");
      return (
        <div className="flex items-center gap-3">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-sky-700 underline underline-offset-2 hover:text-sky-800"
          >
            {isPdf ? "Open PDF" : "Open File"}
          </a>
          {isImg && (
            <img
              src={href}
              alt="Death Certificate"
              className="h-14 w-14 rounded-lg border object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>
      );
    },
  },
  { name: "uid", label: "UID", type: "text" },
  { name: "plot_name", label: "Plot Name", type: "text" },
  { name: "status", label: "Status", type: "badge" },
  {
    name: "plot_type",
    label: "Type",
    type: "select",
    options: [
      { value: "grave_double", label: "Grave (Double)" },
      { value: "lawn_lot", label: "Lawn Lot" },
      { value: "memorial_court", label: "Memorial Court" },
    ],
  },
  { name: "size_sqm", label: "Size (sqm)", type: "text" },
  { name: "price", label: "Price", type: "text" },
];

// Status colors (legend + optional fallback)
const STATUS_COLORS = {
  available: { label: "Available", color: "#10b981" },
  reserved: { label: "Reserved", color: "#f59e0b" },
  occupied: { label: "Occupied", color: "#ef4444" },
};

function normalizeStatus(s) {
  return String(s || "").trim().toLowerCase();
}

function getPolyStyleWithStatusFallback(poly) {
  const statusKey = normalizeStatus(poly?.status);
  const fallback = STATUS_COLORS[statusKey]?.color;

  if (!fallback) return poly?.options || {};

  const base = poly?.options || {};
  return {
    strokeColor: base.strokeColor ?? fallback,
    fillColor: base.fillColor ?? fallback,
    strokeOpacity: base.strokeOpacity ?? 1,
    strokeWeight: base.strokeWeight ?? 1.2,
    fillOpacity: base.fillOpacity ?? 0.5,
    zIndex: base.zIndex,
  };
}

function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const USER_PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.25"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <path d="M32 4c-10.8 0-19.5 8.7-19.5 19.5C12.5 39.8 32 60 32 60s19.5-20.2 19.5-36.5C51.5 12.7 42.8 4 32 4z"
      fill="#0ea5e9" stroke="#075985" stroke-width="2"/>
    <circle cx="32" cy="24" r="12.5" fill="#ffffff"/>
    <text x="32" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-size="10.5" font-weight="700" fill="#075985">YOU</text>
    <circle cx="32" cy="24" r="13.7" fill="none" stroke="rgba(7,89,133,.25)" stroke-width="2"/>
  </g>
</svg>
`;

const TARGET_PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.25"/>
    </filter>
  </defs>
  <g filter="url(#s)">
    <path d="M32 4c-10.8 0-19.5 8.7-19.5 19.5C12.5 39.8 32 60 32 60s19.5-20.2 19.5-36.5C51.5 12.7 42.8 4 32 4z"
      fill="#fb7185" stroke="#9f1239" stroke-width="2"/>
    <circle cx="32" cy="24" r="13" fill="#ffffff"/>
    <circle cx="32" cy="24" r="9" fill="none" stroke="#fb7185" stroke-width="3"/>
    <circle cx="32" cy="24" r="5" fill="none" stroke="#9f1239" stroke-width="3"/>
    <circle cx="32" cy="24" r="2.2" fill="#9f1239"/>
  </g>
</svg>
`;

function buildMarkerIcons() {
  const g = window.google?.maps;
  if (!g) return {};
  return {
    user: {
      url: svgToDataUrl(USER_PIN_SVG),
      scaledSize: new g.Size(44, 44),
      anchor: new g.Point(22, 44),
    },
    target: {
      url: svgToDataUrl(TARGET_PIN_SVG),
      scaledSize: new g.Size(46, 46),
      anchor: new g.Point(23, 46),
    },
  };
}

function hexToRgb(hex) {
  const raw = String(hex || "").trim();
  const m = raw.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [16, 185, 129]; // default emerald
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return [r, g, b];
}

function pickPolyColor(poly) {
  const base = poly?.options?.fillColor || poly?.options?.strokeColor;
  if (base) return base;

  const st = normalizeStatus(poly?.status);
  return STATUS_COLORS[st]?.color || "#10b981";
}

function getPolyElevationMeters(poly, fallbackMeters) {
  const candidates = [
    poly?.elevation,
    poly?.elevation_m,
    poly?.elevationM,
    poly?.height,
    poly?.height_m,
    poly?.heightM,
    poly?.extrudeHeight,
    poly?.extrude_height,
    poly?.extrude_height_m,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return fallbackMeters;
}

export default function CemeteryMap({
  center = CEMETERY_CENTER,
  zoom = 19,
  clickable = true,
  showGeofence = true,
  markers = [],
  polylines = [],
  polygons = [],
  onCoordinatePick,
  restrictToGeofence = false,
  onClickOutsideGeofence,
  children,

  enableDrawing = false,
  onDrawingComplete,

  onEditPlot,

  showLegend = true,
  showInitialRoads = false,
  restrictToCemeteryBounds = true,

  onMapLoad,

  // Existing customization for footer buttons in DetailsModal
  detailsModalProps = {},

  // OPTIONAL: Upload death certificate
  enableDeathCertificateUpload = false,
  burialRequestIdForDeathCertificate = null,
  onDeathCertificateUploaded,

  // ✅ NEW: Disable the Plot Details modal completely (no popups on click)
  disablePlotDetailsModal = false,

  // ✅ NEW: 3D plots ("boxes") using deck.gl WebGL overlay
  enable3DPlots = false,

  // Height (meters) for extruded plots (if plot has no custom height fields)
  plot3DHeight = 3,

  // Try to tilt the map so you can see the boxes
  autoTilt3D = true,
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "cemetery-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const [selectedGrave, setSelectedGrave] = useState(null);
  const [isReserveOpen, setIsReserveOpen] = useState(false);

  const deathCertInputRef = useRef(null);
  const [deathCertUploading, setDeathCertUploading] = useState(false);

  // map instance for deck.gl overlay
  const mapInstanceRef = useRef(null);

  // deck.gl overlay refs (lazy loaded)
  const deckOverlayRef = useRef(null);
  const deckLibRef = useRef(null); // { GoogleMapsOverlay, PolygonLayer }
  const deckWarnedRef = useRef(false);

  // auth token (matches your other pages)
  const authRaw = typeof window !== "undefined" ? localStorage.getItem("auth") : null;
  const token = useMemo(() => {
    try {
      const parsed = authRaw ? JSON.parse(authRaw) : null;
      return parsed?.accessToken || parsed?.token || parsed?.jwt || "";
    } catch {
      return "";
    }
  }, [authRaw]);

  const headersAuth = useMemo(() => {
    const h = {};
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const markerIcons = useMemo(() => {
    if (!isLoaded) return {};
    return buildMarkerIcons();
  }, [isLoaded]);

  const handleOverlayComplete = (e) => {
    const { type, overlay } = e;
    let newShapeData = null;

    if (type === "rectangle") {
      const bounds = overlay.getBounds();
      const NE = bounds.getNorthEast();
      const SW = bounds.getSouthWest();

      const path = [
        { lat: NE.lat(), lng: NE.lng() },
        { lat: SW.lat(), lng: NE.lng() },
        { lat: SW.lat(), lng: SW.lng() },
        { lat: NE.lat(), lng: SW.lng() },
      ];

      newShapeData = { type: "polygon", path };
      overlay.setMap(null);
    } else if (type === "polyline") {
      const path = overlay
        .getPath()
        .getArray()
        .map((latLng) => ({
          lat: latLng.lat(),
          lng: latLng.lng(),
        }));
      newShapeData = { type: "polyline", path };
      overlay.setMap(null);
    }

    if (onDrawingComplete && newShapeData) {
      onDrawingComplete(newShapeData);
    }
  };

  const handleClick = useCallback(
    (ev) => {
      if (enableDrawing) return;
      if (!clickable || !onCoordinatePick) return;

      const lat = ev.latLng.lat();
      const lng = ev.latLng.lng();

      if (restrictToGeofence) {
        const inside = isInsideGeofence(lat, lng);
        if (!inside) {
          onClickOutsideGeofence?.({ lat, lng });
          return;
        }
      }

      onCoordinatePick({ lat, lng });
    },
    [clickable, onCoordinatePick, restrictToGeofence, onClickOutsideGeofence, enableDrawing]
  );

  const handlePolygonClick = (e, poly) => {
    if (enableDrawing) return;

    if (onEditPlot) {
      onEditPlot(poly);
      return;
    }

    // even if modal disabled, we still set selection (useful for highlight)
    setSelectedGrave(poly);
  };

  const options = useMemo(() => {
    const base = {
      clickableIcons: false,
      fullscreenControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      zoomControl: true,
      gestureHandling: "greedy",
      mapTypeId: "terrain",
      // for 3D viewing (may be ignored depending on map mode)
      tilt: enable3DPlots && autoTilt3D ? 45 : 0,
    };

    // ✅ Only restrict the map to cemetery bounds when enabled
    if (restrictToCemeteryBounds) {
      return {
        ...base,
        restriction: {
          latLngBounds: CEMETERY_BOUNDS,
          strictBounds: false,
        },
      };
    }

    return base;
  }, [restrictToCemeteryBounds, enable3DPlots, autoTilt3D]);

  const isVisitor =
    !onEditPlot &&
    (() => {
      try {
        return hasRole("visitor");
      } catch {
        return false;
      }
    })();

  const canReserve = isVisitor && normalizeStatus(selectedGrave?.status) === "available";

  const burialReqId =
    burialRequestIdForDeathCertificate ??
    selectedGrave?.burial_request_id ??
    selectedGrave?.burialRequestId ??
    selectedGrave?.burial_request?.id ??
    null;

  const canUploadDeathCert =
    Boolean(enableDeathCertificateUpload) && isVisitor && Boolean(token) && Boolean(burialReqId);

  const uploadDeathCertificate = async (file) => {
    if (!burialReqId) {
      toast.error("Missing burial request ID for death certificate upload.");
      return;
    }
    if (!file) return;

    try {
      setDeathCertUploading(true);

      const fd = new FormData();
      fd.append("death_certificate", file);

      const url = `${API_BASE}/visitor/burial-requests/${encodeURIComponent(
        String(burialReqId)
      )}/death-certificate`;

      const res = await fetch(url, {
        method: "POST",
        headers: { ...headersAuth }, // DO NOT set Content-Type for FormData
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to upload death certificate");

      toast.success(data?.message || "Death certificate uploaded.");

      onDeathCertificateUploaded?.(data?.data);

      if (data?.data?.death_certificate_url) {
        setSelectedGrave((prev) => (prev ? { ...prev, death_certificate_url: data.data.death_certificate_url } : prev));
      }
    } catch (e) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setDeathCertUploading(false);
    }
  };

  // Only include yellow roads if enabled
  const allPolylines = [...(showInitialRoads ? INITIAL_ROAD_POLYLINES : []), ...polylines];

  // make modal record safe for images (prefix /uploads -> IMG_BASE)
  const modalRecord = useMemo(() => {
    if (!selectedGrave) return null;
    const r = { ...selectedGrave };
    if (r.photo_url) r.photo_url = resolveAssetUrl(r.photo_url);
    if (r.death_certificate_url) r.death_certificate_url = resolveAssetUrl(r.death_certificate_url);
    return r;
  }, [selectedGrave]);

  // Split polygons:
  // - "nonClickable" (amenities etc) we keep as Google Polygons
  // - "plotPolys" we can render in 3D (deck.gl) when enabled
  const nonClickablePolys = useMemo(() => {
    return (polygons || []).filter((p) => p?.options?.clickable === false);
  }, [polygons]);

  const plotPolys = useMemo(() => {
    return (polygons || []).filter((p) => p?.options?.clickable !== false);
  }, [polygons]);

  const googlePolygonsToRender = useMemo(() => {
    // If 3D is enabled, avoid drawing the same plots twice:
    // only draw amenities/nonClickable in Google Maps.
    return enable3DPlots ? nonClickablePolys : polygons;
  }, [enable3DPlots, nonClickablePolys, polygons]);

  // --- Deck.gl 3D overlay setup ---
  useEffect(() => {
    let cancelled = false;

    async function ensureDeckLib() {
      if (deckLibRef.current) return deckLibRef.current;

      try {
        const gm = await import("@deck.gl/google-maps");
        const layers = await import("@deck.gl/layers");

        const lib = {
          GoogleMapsOverlay: gm.GoogleMapsOverlay,
          PolygonLayer: layers.PolygonLayer,
        };

        deckLibRef.current = lib;
        return lib;
      } catch (e) {
        if (!deckWarnedRef.current) {
          deckWarnedRef.current = true;
          toast.error(
            "3D plots require deck.gl packages. Install: @deck.gl/core @deck.gl/layers @deck.gl/google-maps"
          );
        }
        return null;
      }
    }

    async function apply3D() {
      if (!enable3DPlots) return;

      const map = mapInstanceRef.current;
      if (!map) return;

      const lib = await ensureDeckLib();
      if (!lib) return;

      if (cancelled) return;

      // Create overlay once
      if (!deckOverlayRef.current) {
        deckOverlayRef.current = new lib.GoogleMapsOverlay({ layers: [] });
        deckOverlayRef.current.setMap(map);
      }

      const selectedId = selectedGrave?.id != null ? String(selectedGrave.id) : null;

      const layer = new lib.PolygonLayer({
        id: "plots-3d",
        data: plotPolys,
        pickable: true,
        extruded: true,
        wireframe: false,

        // Convert {lat,lng} -> [lng, lat]
        getPolygon: (d) => (d?.path || []).map((p) => [p.lng, p.lat]),

        // Height in meters
        getElevation: (d) => getPolyElevationMeters(d, plot3DHeight),

        // Colors (RGBA 0-255)
        getFillColor: (d) => {
          const hex = pickPolyColor(d);
          const [r, g, b] = hexToRgb(hex);
          const isSel = selectedId && d?.id != null && String(d.id) === selectedId;
          return isSel ? [37, 99, 235, 210] : [r, g, b, 160];
        },
        getLineColor: (d) => {
          const hex = d?.options?.strokeColor || pickPolyColor(d);
          const [r, g, b] = hexToRgb(hex);
          return [r, g, b, 220];
        },

        lineWidthMinPixels: 1,
        opacity: 1,

        // Click behavior
        onClick: (info) => {
          const obj = info?.object;
          if (!obj) return;

          if (enableDrawing) return;

          if (onEditPlot) {
            onEditPlot(obj);
            return;
          }

          setSelectedGrave(obj);
        },

        updateTriggers: {
          getFillColor: [selectedId],
          getElevation: [plot3DHeight],
        },
      });

      deckOverlayRef.current.setProps({ layers: [layer] });

      // try tilt (best effort)
      if (autoTilt3D) {
        try {
          map.setTilt?.(45);
          map.setHeading?.(0);
        } catch {}
      }
    }

    async function cleanup3D() {
      if (deckOverlayRef.current) {
        try {
          deckOverlayRef.current.setProps({ layers: [] });
          deckOverlayRef.current.setMap(null);
        } catch {}
        deckOverlayRef.current = null;
      }
    }

    if (!enable3DPlots) {
      cleanup3D();
      return;
    }

    apply3D();

    return () => {
      cancelled = true;
      // keep overlay alive across renders; only remove when disabled/unmount
    };
  }, [
    enable3DPlots,
    plotPolys,
    plot3DHeight,
    selectedGrave,
    autoTilt3D,
    enableDrawing,
    onEditPlot,
  ]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (deckOverlayRef.current) {
        try {
          deckOverlayRef.current.setProps({ layers: [] });
          deckOverlayRef.current.setMap(null);
        } catch {}
        deckOverlayRef.current = null;
      }
    };
  }, []);

  if (loadError) return <div className="text-sm text-destructive">Failed to load Google Maps.</div>;
  if (!isLoaded) return <div className="text-sm text-muted-foreground">Loading map…</div>;

  const modalActions = (canReserve || canUploadDeathCert) && (
    <div className="flex flex-wrap items-center gap-2">
      {canReserve && (
        <Button
          onClick={() => setIsReserveOpen(true)}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Reserve This Plot
        </Button>
      )}

      {canUploadDeathCert && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={deathCertUploading}
            onClick={() => deathCertInputRef.current?.click()}
          >
            {deathCertUploading ? "Uploading…" : "Upload Death Certificate"}
          </Button>

          <input
            ref={deathCertInputRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              e.target.value = "";
              if (file) uploadDeathCertificate(file);
            }}
          />
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="relative h-full w-full">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={zoom}
          options={options}
          onClick={handleClick}
          mapTypeId="terrain"
          onLoad={(map) => {
            mapInstanceRef.current = map;
            onMapLoad?.(map);

            if (enable3DPlots && autoTilt3D) {
              try {
                map.setTilt?.(45);
                map.setHeading?.(0);
              } catch {}
            }
          }}
        >
          {showGeofence &&
            GEOFENCE_POLYGONS.map((poly, idx) => (
              <Polygon
                key={idx}
                path={poly}
                options={{
                  strokeColor: "#22c55e",
                  strokeWeight: 2,
                  fillOpacity: 0.03,
                  clickable: false,
                  zIndex: 5,
                }}
              />
            ))}

          {/* If 3D enabled, we only draw nonClickable polygons (amenities) here.
              Plot polygons will be drawn by deck.gl. */}
          {googlePolygonsToRender.map((poly, idx) => (
            <Polygon
              key={poly.id || idx}
              path={poly.path}
              options={getPolyStyleWithStatusFallback(poly)}
              onClick={(e) => handlePolygonClick(e, poly)}
            />
          ))}

          {markers.map((m) => {
            const icon = m.icon || (m.iconType ? markerIcons[m.iconType] : undefined) || undefined;
            return (
              <Marker
                key={m.id || `${m.position.lat}-${m.position.lng}`}
                position={m.position}
                title={m.title}
                label={m.label}
                icon={icon}
                zIndex={m.zIndex}
                animation={m.animation}
              />
            );
          })}

          {allPolylines.map((line, idx) => (
            <Polyline key={line.id || idx} path={line.path} options={line.options} />
          ))}

          {enableDrawing && (
            <DrawingManager
              onOverlayComplete={handleOverlayComplete}
              options={{
                drawingControl: true,
                drawingControlOptions: {
                  position: window.google.maps.ControlPosition.TOP_CENTER,
                  drawingModes: ["rectangle", "polyline"],
                },
                rectangleOptions: {
                  editable: true,
                  draggable: true,
                  fillColor: "#3b82f6",
                  strokeColor: "#3b82f6",
                  fillOpacity: 0.3,
                  strokeWeight: 2,
                },
                polylineOptions: {
                  editable: true,
                  draggable: true,
                  strokeColor: "#f59e0b",
                  strokeWeight: 5,
                },
              }}
            />
          )}

          {children}
        </GoogleMap>

        {showLegend && (
          <div className="absolute bottom-3 left-3 z-[999] rounded-lg border bg-white/95 p-3 shadow-sm">
            <div className="text-xs font-semibold text-slate-700">Legend</div>
            <div className="mt-2 space-y-1.5">
              {Object.entries(STATUS_COLORS).map(([key, v]) => (
                <div key={key} className="flex items-center gap-2 text-xs text-slate-700">
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-sm border"
                    style={{ backgroundColor: v.color, borderColor: v.color }}
                  />
                  <span>{v.label}</span>
                </div>
              ))}
            </div>

            {/* Optional hint */}
            {enable3DPlots && (
              <div className="mt-2 text-[11px] text-slate-500">
                3D plots enabled (tilt the map if supported).
              </div>
            )}
          </div>
        )}
      </div>

      {/* ✅ Hide modal entirely when disablePlotDetailsModal is true */}
      {!onEditPlot && !disablePlotDetailsModal && (
        <>
          <DetailsModal
            open={!!modalRecord && !isReserveOpen}
            title="Plot Details"
            record={modalRecord}
            fields={DEFAULT_MODAL_FIELDS}
            onClose={() => setSelectedGrave(null)}
            actions={modalActions}
            {...detailsModalProps}
          />

          <ReservationDialog
            open={isReserveOpen}
            onClose={() => {
              setIsReserveOpen(false);
              setSelectedGrave(null);
            }}
            plot={selectedGrave}
            onSuccess={() => {
              window.location.reload();
            }}
          />
        </>
      )}
    </>
  );
}

