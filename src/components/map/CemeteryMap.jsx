// frontend/src/components/map/CemeteryMap.jsx
import { useCallback, useMemo, useState } from "react";
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
// INITIAL ROADS (YELLOW LINES) — kept for routing graph, but hidden by default
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
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
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

// IMPORTANT: include photo for deceased here (type: "image")
const DEFAULT_MODAL_FIELDS = [
  { name: "photo_url", label: "Photo", type: "image" },
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

// ✅ Status colors (legend + optional fallback)
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

// ---------- pretty marker icons (user / target) ----------
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

  // ✅ UI toggles
  showLegend = true,

  // ✅ CHANGE HERE: hide yellow road overlay by default
  // If ever you want them back on a specific page, pass showInitialRoads={true}
  showInitialRoads = false,

  onMapLoad,
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "cemetery-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const [selectedGrave, setSelectedGrave] = useState(null);
  const [isReserveOpen, setIsReserveOpen] = useState(false);

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
    [
      clickable,
      onCoordinatePick,
      restrictToGeofence,
      onClickOutsideGeofence,
      enableDrawing,
    ]
  );

  const handlePolygonClick = (e, poly) => {
    if (enableDrawing) return;

    if (onEditPlot) {
      onEditPlot(poly);
      return;
    }

    setSelectedGrave(poly);
  };

  const options = useMemo(
    () => ({
      clickableIcons: false,
      fullscreenControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      zoomControl: true,
      gestureHandling: "greedy",
      mapTypeId: "terrain",
      restriction: {
        latLngBounds: CEMETERY_BOUNDS,
        strictBounds: false,
      },
    }),
    []
  );

  if (loadError)
    return (
      <div className="text-sm text-destructive">Failed to load Google Maps.</div>
    );

  if (!isLoaded)
    return <div className="text-sm text-muted-foreground">Loading map…</div>;

  // ✅ Only include yellow roads if enabled
  const allPolylines = [
    ...(showInitialRoads ? INITIAL_ROAD_POLYLINES : []),
    ...polylines,
  ];

  // ✅ avoid crashing if hasRole throws
  const isVisitor =
    !onEditPlot &&
    (() => {
      try {
        return hasRole("visitor");
      } catch {
        return false;
      }
    })();

  const canReserve =
    isVisitor && normalizeStatus(selectedGrave?.status) === "available";

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
          onLoad={(map) => onMapLoad?.(map)}
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

          {polygons.map((poly, idx) => (
            <Polygon
              key={poly.id || idx}
              path={poly.path}
              options={getPolyStyleWithStatusFallback(poly)}
              onClick={(e) => handlePolygonClick(e, poly)}
            />
          ))}

          {markers.map((m) => {
            const icon =
              m.icon ||
              (m.iconType ? markerIcons[m.iconType] : undefined) ||
              undefined;

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
            <Polyline
              key={line.id || idx}
              path={line.path}
              options={line.options}
            />
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
                <div
                  key={key}
                  className="flex items-center gap-2 text-xs text-slate-700"
                >
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

      {!onEditPlot && (
        <>
          <DetailsModal
            open={!!selectedGrave && !isReserveOpen}
            title="Plot Details"
            record={selectedGrave}
            fields={DEFAULT_MODAL_FIELDS}
            onClose={() => setSelectedGrave(null)}
            actions={
              canReserve && (
                <Button
                  onClick={() => setIsReserveOpen(true)}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Reserve This Plot
                </Button>
              )
            }
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
