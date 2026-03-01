// frontend/src/components/map/CemeteryMap.jsx

import { useCallback, useMemo, useRef, useState } from "react";

// ✅ Make sure Leaflet CSS is loaded (fixes tiny-tile/white-screen issue)
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Polyline,
  useMapEvents,
  FeatureGroup,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";

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
export const CEMETERY_CENTER = { lat: 15.4948545, lng: 120.5550455 };
export const CEMETERY_ENTRANCE = { lat: 15.494175676617589, lng: 120.55463847892524 };

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
  { lat: 15.495711403125703, lng: 120.55557900352841 },
  { lat: 15.495769559138362, lng: 120.55564002377788 },
  { lat: 15.49524033884679, lng: 120.55604302567154 },
  { lat: 15.49520350661523, lng: 120.55599943977671 },
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

const ALL_POINTS = GEOFENCE_POLYGONS.flat();
const lats = ALL_POINTS.map((p) => p.lat);
const lngs = ALL_POINTS.map((p) => p.lng);

export const CEMETERY_BOUNDS = {
  north: Math.max(...lats),
  south: Math.min(...lats),
  east: Math.max(...lngs),
  west: Math.min(...lngs),
};

// ============================================================================
// INITIAL ROADS (kept for routing graph, hidden by default)
// ============================================================================
export const INITIAL_ROAD_SEGMENTS = [
  { id: "MAIN_ROAD_A", from: { lat: 15.494204941386018, lng: 120.554605304102 }, to: { lat: 15.494854814113388, lng: 120.55545786787883 } },
  { id: "MAIN_ROAD_B", from: { lat: 15.494137563161392, lng: 120.55462785871107 }, to: { lat: 15.49525256129744, lng: 120.5560871411545 } },
  { id: "MAIN_ROAD_C", from: { lat: 15.494943558259884, lng: 120.554547927049 }, to: { lat: 15.494164967630882, lng: 120.55516242804077 } },
  { id: "MAIN_ROAD_D", from: { lat: 15.494168622992797, lng: 120.55515484160878 }, to: { lat: 15.494557918667045, lng: 120.55565175290458 } },
  { id: "MAIN_ROAD_E", from: { lat: 15.495384027246267, lng: 120.55497087063283 }, to: { lat: 15.494561574022015, lng: 120.55565933933656 } },
  { id: "MAIN_ROAD_F", from: { lat: 15.494793688944096, lng: 120.55462379138424 }, to: { lat: 15.495996295868565, lng: 120.55585848319174 } },
  { id: "MAIN_ROAD_G", from: { lat: 15.49552293014835, lng: 120.55535777867995 }, to: { lat: 15.494981939426166, lng: 120.55578641208778 } },
  { id: "MAIN_ROAD_H", from: { lat: 15.494952775409871, lng: 120.55455808467482 }, to: { lat: 15.496135295447349, lng: 120.5557848630519 } },
  { id: "MAIN_ROAD_I", from: { lat: 15.495619645834816, lng: 120.55545629246764 }, to: { lat: 15.495078147745525, lng: 120.55588678699803 } },
  { id: "MAIN_ROAD_J", from: { lat: 15.49572949610942, lng: 120.55553273542162 }, to: { lat: 15.495155689325069, lng: 120.55600078087679 } },
  { id: "MAIN_ROAD_K", from: { lat: 15.495817376287063, lng: 120.55563600046474 }, to: { lat: 15.49522547672178, lng: 120.55607051830849 } },
];

function isInsideSinglePolygon(lat, lng, polygon) {
  const x = lng;
  const y = lat;
  const poly = polygon.map((p) => ({ x: p.lng, y: p.lat }));
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isInsideGeofence(lat, lng, polygons = GEOFENCE_POLYGONS) {
  return polygons.some((poly) => isInsideSinglePolygon(lat, lng, poly));
}

// Resolve backend-stored paths like "/uploads/..." into a usable URL
function resolveAssetUrl(v) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) return raw;

  const base = String(IMG_BASE || API_BASE || "").replace(/\/+$/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

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
              onError={(e) => { e.currentTarget.style.display = "none"; }}
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

const STATUS_COLORS = {
  available: { label: "Available", color: "#10b981" },
  reserved: { label: "Reserved", color: "#f59e0b" },
  occupied: { label: "Occupied", color: "#ef4444" },
};

function normalizeStatus(s) {
  return String(s || "").trim().toLowerCase();
}

function getLeafletPolyStyle(poly, isSelected = false) {
  const statusKey = normalizeStatus(poly?.status);
  const fallback = STATUS_COLORS[statusKey]?.color || "#10b981";
  const base = poly?.options || {};

  const strokeColor = base.strokeColor ?? fallback;
  const fillColor = base.fillColor ?? fallback;

  return {
    color: isSelected ? "#2563eb" : strokeColor,
    weight: isSelected ? 3 : base.strokeWeight ?? 1.2,
    opacity: base.strokeOpacity ?? 1,
    fillColor,
    fillOpacity: base.fillOpacity ?? 0.5,
  };
}

function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const USER_PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><filter id="s" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.25"/>
  </filter></defs>
  <g filter="url(#s)">
    <path d="M32 4c-10.8 0-19.5 8.7-19.5 19.5C12.5 39.8 32 60 32 60s19.5-20.2 19.5-36.5C51.5 12.7 42.8 4 32 4z"
      fill="#0ea5e9" stroke="#075985" stroke-width="2"/>
    <circle cx="32" cy="24" r="12.5" fill="#ffffff"/>
    <text x="32" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-size="10.5" font-weight="700" fill="#075985">YOU</text>
  </g>
</svg>
`;

const TARGET_PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><filter id="s" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.25"/>
  </filter></defs>
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

function makeLeafletIcon(svg, size) {
  return L.icon({
    iconUrl: svgToDataUrl(svg),
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function ClickHandler({ enabled, onClick }) {
  useMapEvents({
    click: (e) => {
      if (!enabled) return;
      onClick?.(e);
    },
  });
  return null;
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

  detailsModalProps = {},

  enableDeathCertificateUpload = false,
  burialRequestIdForDeathCertificate = null,
  onDeathCertificateUploaded,

  disablePlotDetailsModal = false,

  tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution = "&copy; OpenStreetMap contributors",
}) {
  const [selectedGrave, setSelectedGrave] = useState(null);
  const [isReserveOpen, setIsReserveOpen] = useState(false);

  const deathCertInputRef = useRef(null);
  const [deathCertUploading, setDeathCertUploading] = useState(false);

  const mapRef = useRef(null);

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
        headers: { ...headersAuth },
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to upload death certificate");

      toast.success(data?.message || "Death certificate uploaded.");
      onDeathCertificateUploaded?.(data?.data);

      if (data?.data?.death_certificate_url) {
        setSelectedGrave((prev) =>
          prev ? { ...prev, death_certificate_url: data.data.death_certificate_url } : prev
        );
      }
    } catch (e) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setDeathCertUploading(false);
    }
  };

  const allPolylines = useMemo(() => {
    const initial = showInitialRoads
      ? INITIAL_ROAD_SEGMENTS.map((seg) => ({
          id: seg.id,
          path: [seg.from, seg.to],
          options: { strokeColor: "#facc15", strokeOpacity: 1, strokeWeight: 8 },
        }))
      : [];
    return [...initial, ...(polylines || [])];
  }, [showInitialRoads, polylines]);

  const modalRecord = useMemo(() => {
    if (!selectedGrave) return null;
    const r = { ...selectedGrave };
    if (r.photo_url) r.photo_url = resolveAssetUrl(r.photo_url);
    if (r.death_certificate_url) r.death_certificate_url = resolveAssetUrl(r.death_certificate_url);
    return r;
  }, [selectedGrave]);

  const handleClick = useCallback(
    (e) => {
      if (enableDrawing) return;
      if (!clickable || !onCoordinatePick) return;

      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

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

  const userIcon = useMemo(() => makeLeafletIcon(USER_PIN_SVG, 44), []);
  const targetIcon = useMemo(() => makeLeafletIcon(TARGET_PIN_SVG, 46), []);

  const leafletBounds = useMemo(() => {
    const sw = [CEMETERY_BOUNDS.south, CEMETERY_BOUNDS.west];
    const ne = [CEMETERY_BOUNDS.north, CEMETERY_BOUNDS.east];
    return [sw, ne];
  }, []);

  const onCreated = useCallback(
    (e) => {
      const { layerType, layer } = e;

      if (layerType === "rectangle") {
        const b = layer.getBounds();
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        const path = [
          { lat: ne.lat, lng: ne.lng },
          { lat: sw.lat, lng: ne.lng },
          { lat: sw.lat, lng: sw.lng },
          { lat: ne.lat, lng: sw.lng },
        ];
        onDrawingComplete?.({ type: "polygon", path });
      }

      if (layerType === "polyline") {
        const pts = layer.getLatLngs().map((p) => ({ lat: p.lat, lng: p.lng }));
        onDrawingComplete?.({ type: "polyline", path: pts });
      }

      try { layer.remove(); } catch {}
    },
    [onDrawingComplete]
  );

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
            onChange={(ev) => {
              const file = ev.target.files?.[0] || null;
              ev.target.value = "";
              if (file) uploadDeathCertificate(file);
            }}
          />
        </>
      )}
    </div>
  );

  return (
    <>
      {/* ✅ Give Leaflet an explicit height (don’t rely on 100%) */}
      <div className="relative w-full" style={{ height: "70vh", minHeight: 520 }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={zoom}
          style={{ width: "100%", height: "100%" }}
          maxBounds={restrictToCemeteryBounds ? leafletBounds : undefined}
          maxBoundsViscosity={restrictToCemeteryBounds ? 0.75 : undefined}
          whenCreated={(map) => {
            mapRef.current = map;
            onMapLoad?.(map);

            // ✅ Fix rendering when inside cards/tabs/animated layouts
            setTimeout(() => map.invalidateSize(), 0);
            setTimeout(() => map.invalidateSize(), 250);
          }}
        >
          <TileLayer attribution={tileAttribution} url={tileUrl} />

          <ClickHandler enabled={true} onClick={handleClick} />

          {showGeofence &&
            GEOFENCE_POLYGONS.map((poly, idx) => (
              <Polygon
                key={`geo-${idx}`}
                positions={poly.map((p) => [p.lat, p.lng])}
                pathOptions={{ color: "#22c55e", weight: 2, fillOpacity: 0.03 }}
              />
            ))}

          {(polygons || []).map((poly, idx) => {
            const id = poly?.id != null ? String(poly.id) : null;
            const selId = selectedGrave?.id != null ? String(selectedGrave.id) : null;
            const isSelected = id && selId && id === selId;

            return (
              <Polygon
                key={poly.id || `plot-${idx}`}
                positions={(poly.path || []).map((p) => [p.lat, p.lng])}
                pathOptions={getLeafletPolyStyle(poly, isSelected)}
                eventHandlers={{
                  click: () => {
                    if (enableDrawing) return;

                    if (onEditPlot) {
                      onEditPlot(poly);
                      return;
                    }
                    setSelectedGrave(poly);
                  },
                }}
              />
            );
          })}

          {markers.map((m) => {
            const icon =
              m.icon ||
              (m.iconType === "user" ? userIcon : m.iconType === "target" ? targetIcon : undefined);

            return (
              <Marker
                key={m.id || `${m.position.lat}-${m.position.lng}`}
                position={[m.position.lat, m.position.lng]}
                icon={icon}
              />
            );
          })}

          {allPolylines.map((line, idx) => (
            <Polyline
              key={line.id || `line-${idx}`}
              positions={(line.path || []).map((p) => [p.lat, p.lng])}
              pathOptions={{
                color: line.options?.strokeColor || "#facc15",
                weight: line.options?.strokeWeight || 6,
                opacity: line.options?.strokeOpacity ?? 1,
              }}
            />
          ))}

          {enableDrawing && (
            <FeatureGroup>
              <EditControl
                position="topright"
                onCreated={onCreated}
                draw={{
                  polygon: false,
                  circle: false,
                  circlemarker: false,
                  marker: false,
                  rectangle: true,
                  polyline: true,
                }}
              />
            </FeatureGroup>
          )}

          {children}
        </MapContainer>

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
          </div>
        )}
      </div>

      {!onEditPlot && !disablePlotDetailsModal && (
        <>
          <DetailsModal
            open={!!modalRecord && !isReserveOpen}
            title="Plot Details"
            record={modalRecord}
            fields={DEFAULT_MODAL_FIELDS}
            onClose={() => setSelectedGrave(null)}
            actions={modalActions}
          />

          <ReservationDialog
            open={isReserveOpen}
            onClose={() => {
              setIsReserveOpen(false);
              setSelectedGrave(null);
            }}
            plot={selectedGrave}
            onSuccess={() => window.location.reload()}
          />
        </>
      )}
    </>
  );
}