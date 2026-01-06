// frontend/src/views/admin/pages/BurialSchedule.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../../components/ui/select";
import { Badge } from "../../../components/ui/badge";
import { ScrollArea } from "../../../components/ui/scroll-area";

import {
  Eye,
  Search,
  CalendarDays,
  UserCircle2,
  ShieldCheck,
  RefreshCcw,
  CheckCircle2,
  Clock3,
  MapPin,
} from "lucide-react";

import { Toaster, toast } from "sonner";

import CemeteryMap, {
  CEMETERY_CENTER,
} from "../../../components/map/CemeteryMap.jsx";

// ✅ Reuse existing dialog component (same one used by visitor)
import ReservationDialog from "../../../views/visitor/components/ReservationDialog";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "";

/* --------------------------- auth helpers --------------------------- */
function readAuth() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function getToken() {
  const auth = readAuth();
  return auth?.accessToken || auth?.token || auth?.jwt || null;
}
function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
function useAuthUser() {
  const auth = readAuth();
  return useMemo(() => auth?.user ?? null, [auth]);
}

/* --------------------------- reservation helper --------------------------- */
/**
 * Admin reservation API helper.
 * Adjust ADMIN_RESERVE_ENDPOINT if your backend uses a different route.
 *
 * - Tries:  POST /admin/reserve-plot
 * - Fallback: POST /visitor/reserve-plot (only works if your backend allows admin or role is visitor)
 */
async function reservePlotAsAdmin(plotId, notes = "") {
  const token = getToken();
  if (!token) throw new Error("Unauthorized. Please login again.");

  const payload = { plot_id: plotId, notes: notes || "" };

  const attempt = async (url) => {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      body: JSON.stringify(payload),
    });

    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json")
      ? await res.json().catch(() => ({}))
      : await res.text();

    if (!res.ok) {
      const msg =
        typeof body === "string" ? body : body?.message || JSON.stringify(body);
      const err = new Error(msg || "Reservation failed.");
      err.status = res.status;
      throw err;
    }

    return body?.data || body;
  };

  const ADMIN_RESERVE_ENDPOINT = `${API_BASE}/admin/reserve-plot`;
  const VISITOR_RESERVE_ENDPOINT = `${API_BASE}/visitor/reserve-plot`;

  try {
    return await attempt(ADMIN_RESERVE_ENDPOINT);
  } catch (e) {
    if (e?.status === 404) return await attempt(VISITOR_RESERVE_ENDPOINT);
    throw e;
  }
}

/* --------------------------- other helpers --------------------------- */
const safeLower = (v) => String(v || "").trim().toLowerCase();

const fmtDateLong = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const fmtDateShort = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const fmtTime = (t) => {
  if (!t) return "TBD";
  return String(t);
};

const normalizeStatusLabel = (raw) => {
  const n = safeLower(raw);
  if (!n) return "Unknown";
  if (n === "cancelled") return "Cancelled";
  if (n === "canceled") return "Canceled";
  return n.charAt(0).toUpperCase() + n.slice(1);
};

const statusBadgeClass = (raw) => {
  const n = safeLower(raw);
  if (n === "pending") return "bg-amber-600";
  if (n === "confirmed") return "bg-emerald-600";
  if (n === "completed") return "bg-indigo-600";
  if (n === "rejected") return "bg-rose-600";
  if (n === "cancelled" || n === "canceled") return "bg-slate-600";
  return "bg-slate-600";
};

// plot status badge helper (available / reserved / occupied)
const plotStatusBadge = (s) => {
  const v = safeLower(s);
  if (v === "available") return "bg-emerald-600";
  if (v === "reserved") return "bg-amber-500";
  if (v === "occupied") return "bg-rose-600";
  return "bg-slate-500";
};

/* -------------------- GeoJSON ➜ CemeteryMap helpers -------------------- */
/**
 * IMPORTANT:
 * - We intentionally DO NOT set strokeColor/fillColor in DEFAULT_PLOT_STYLE anymore.
 * - CemeteryMap applies status-based colors + legend.
 * - We only override colors when highlighted.
 */
const DEFAULT_PLOT_STYLE = {
  strokeOpacity: 0.8,
  strokeWeight: 1.5,
  fillOpacity: 0.35,
};

const HIGHLIGHTED_PLOT_STYLE = {
  strokeColor: "#0ea5e9",
  strokeOpacity: 1,
  strokeWeight: 3,
  fillColor: "#0ea5e9",
  fillOpacity: 0.2,
};

const getFeatId = (f) => {
  const p = f?.properties || {};
  return p.id != null ? String(p.id) : p.uid != null ? String(p.uid) : undefined;
};

function featureToMapShapes(feature, highlightedId) {
  const out = { polygons: [], markers: [] };
  if (!feature?.geometry) return out;

  const { geometry, properties } = feature;
  const id = getFeatId(feature);
  const type = geometry.type;
  const coords = geometry.coordinates;

  if (!coords) return out;

  const isHighlighted =
    highlightedId && id && String(id) === String(highlightedId);

  const baseOptions = isHighlighted
    ? { ...DEFAULT_PLOT_STYLE, ...HIGHLIGHTED_PLOT_STYLE }
    : { ...DEFAULT_PLOT_STYLE };

  const status = properties?.status ?? properties?.plot_status ?? null;

  const pushPolygonFromRing = (ring, polyId) => {
    if (!Array.isArray(ring) || ring.length === 0) return;
    const path = ring
      .map((pair) => {
        const [lng, lat] = pair || [];
        if (typeof lat !== "number" || typeof lng !== "number") return null;
        return { lat, lng };
      })
      .filter(Boolean);
    if (path.length === 0) return;

    out.polygons.push({
      id: polyId,
      path,
      options: baseOptions,
      properties,
      status,
    });
  };

  if (type === "Point") {
    const [lng, lat] = coords;
    if (typeof lat === "number" && typeof lng === "number") {
      out.markers.push({
        id: id || properties?.plot_name || Math.random().toString(36).slice(2),
        position: { lat, lng },
        title: properties?.plot_name || (id ? `Plot ${id}` : "Plot"),
      });
    }
    return out;
  }

  if (type === "Polygon") {
    const rings = Array.isArray(coords) ? coords : [];
    if (rings[0]) {
      pushPolygonFromRing(
        rings[0],
        id || `poly-${Math.random().toString(36).slice(2)}`
      );
    }
    return out;
  }

  if (type === "MultiPolygon") {
    const polys = Array.isArray(coords) ? coords : [];
    polys.forEach((polyCoords, idx) => {
      const rings = Array.isArray(polyCoords) ? polyCoords : [];
      if (rings[0]) {
        pushPolygonFromRing(rings[0], `${id || "poly"}-${idx}`);
      }
    });
    return out;
  }

  return out;
}

function fcToMapShapes(fc, highlightedId) {
  const res = { polygons: [], markers: [] };
  if (!fc || !Array.isArray(fc.features)) return res;
  fc.features.forEach((f) => {
    const shapes = featureToMapShapes(f, highlightedId);
    res.polygons.push(...shapes.polygons);
    res.markers.push(...shapes.markers);
  });
  return res;
}

/* -------------------------- burial requests helpers -------------------------- */
function pickReqDate(r) {
  return (
    r?.scheduled_date ||
    r?.burial_date ||
    r?.service_date ||
    r?.date ||
    null
  );
}

function pickReqTime(r) {
  return (
    r?.scheduled_time ||
    r?.burial_time ||
    r?.service_time ||
    r?.time ||
    null
  );
}

function getReqPlotLabel(r) {
  return (
    r?.plot_code ||
    r?.plot_name ||
    r?.plot_uid ||
    r?.plot_id ||
    "—"
  );
}

/**
 * Try common confirm endpoints without making you hunt routes.
 * Uses confirmBurialRequestAsAdmin(req.params.id) on backend.
 */
async function confirmBurialRequest(id) {
  const token = getToken();
  if (!token) throw new Error("Unauthorized. Please login again.");

  const tryCall = async (url, method) => {
    const res = await fetch(url, { method, headers: authHeaders() });
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json")
      ? await res.json().catch(() => ({}))
      : await res.text();

    if (!res.ok) {
      const msg =
        typeof body === "string" ? body : body?.error || body?.message || "";
      const err = new Error(msg || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return body;
  };

  const idEnc = encodeURIComponent(String(id));

  const attempts = [
    { url: `${API_BASE}/admin/burial-requests/${idEnc}/confirm`, method: "POST" },
    { url: `${API_BASE}/admin/burial-requests/${idEnc}/confirm`, method: "PUT" },
    { url: `${API_BASE}/admin/burial-requests/confirm/${idEnc}`, method: "POST" },
    { url: `${API_BASE}/admin/burial-requests/confirm/${idEnc}`, method: "PUT" },
  ];

  let lastErr = null;
  for (const a of attempts) {
    try {
      return await tryCall(a.url, a.method);
    } catch (e) {
      lastErr = e;
      if (e?.status && e.status !== 404) break;
    }
  }

  throw lastErr || new Error("Confirm failed.");
}

/* -------------------------- page main -------------------------- */
export default function BurialSchedule() {
  const currentUser = useAuthUser();

  // ✅ OPTION A: This page is now driven by burial_requests, not burial_schedules
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // dropdown data
  const [plots, setPlots] = useState([]); // [{id, plot_name}]
  const [fc, setFc] = useState(null);

  const [hoveredRow, setHoveredRow] = useState(null);

  // modals
  const [viewItem, setViewItem] = useState(null);

  // ✅ plot click -> details modal -> reservation dialog
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [openPlotDetails, setOpenPlotDetails] = useState(false);
  const [openReserve, setOpenReserve] = useState(false);

  const isAnyModalOpen = !!viewItem || openPlotDetails || openReserve;

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ expected backend: getBurialRequestsAsAdmin
      const res = await fetch(`${API_BASE}/admin/burial-requests`, {
        headers: authHeaders({ Accept: "application/json" }),
      });

      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json")
        ? await res.json().catch(() => ({}))
        : await res.text();

      if (!res.ok) {
        const msg =
          typeof body === "string"
            ? body
            : body?.error || body?.message || "Failed to load burial requests.";
        throw new Error(msg);
      }

      const arr = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.items)
        ? body.items
        : [];

      setRows(arr);
    } catch (e) {
      console.error("[burial-requests] fetch error:", e);
      toast.error(e?.message || "Failed to load burial requests.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlots = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/plots/available`, {
        headers: authHeaders({ Accept: "application/json" }),
      });
      const json = await res.json().catch(() => []);
      setPlots(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error("[plots] fetch error:", e);
      setPlots([]);
    }
  }, []);

  const fetchPlotsGeo = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/plot/`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      setFc(json || null);
    } catch (e) {
      console.error("[plot geojson] fetch error:", e);
      setFc(null);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchPlots();
    fetchPlotsGeo();
  }, [fetchRequests, fetchPlots, fetchPlotsGeo]);

  // ✅ Refresh list when the tab/window gains focus (helps after accepting elsewhere)
  useEffect(() => {
    const onFocus = () => fetchRequests();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchRequests]);

  const stats = useMemo(() => {
    const out = { all: rows.length, pending: 0, confirmed: 0, completed: 0 };
    rows.forEach((r) => {
      const s = safeLower(r?.status);
      if (s === "pending") out.pending += 1;
      else if (s === "confirmed") out.confirmed += 1;
      else if (s === "completed") out.completed += 1;
    });
    return out;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows.filter((r) => {
      const deceased = String(r?.deceased_name || "").toLowerCase();
      const family = String(
        r?.family_contact_name ||
          r?.family_contact_email ||
          r?.family_contact ||
          ""
      ).toLowerCase();
      const plot = String(getReqPlotLabel(r)).toLowerCase();

      const passQ =
        !needle ||
        deceased.includes(needle) ||
        family.includes(needle) ||
        plot.includes(needle);

      const st = safeLower(r?.status);
      const passStatus =
        statusFilter === "All" || st === safeLower(statusFilter);

      return passQ && passStatus;
    });
  }, [rows, q, statusFilter]);

  // ✅ when plot polygon clicked on map
  const handlePlotClick = useCallback((poly) => {
    setSelectedPlot(poly);
    setOpenPlotDetails(true);
    setOpenReserve(false);
  }, []);

  const selectedPlotStatus = useMemo(() => {
    const s =
      selectedPlot?.status ??
      selectedPlot?.properties?.status ??
      selectedPlot?.properties?.plot_status ??
      null;
    return safeLower(s);
  }, [selectedPlot]);

  const canReserveSelectedPlot = selectedPlotStatus === "available";

  // normalize plot object for ReservationDialog
  const reservationPlot = useMemo(() => {
    if (!selectedPlot) return null;
    return {
      ...(selectedPlot.properties || {}),
      id: selectedPlot.id ?? selectedPlot.properties?.id,
      uid: selectedPlot.properties?.uid ?? selectedPlot.uid,
      status:
        selectedPlot.status ??
        selectedPlot.properties?.status ??
        selectedPlot.properties?.plot_status,
      plot_name: selectedPlot.properties?.plot_name ?? selectedPlot.plot_name,
      plot_type: selectedPlot.properties?.plot_type ?? selectedPlot.plot_type,
      size_sqm: selectedPlot.properties?.size_sqm ?? selectedPlot.size_sqm,
      price: selectedPlot.properties?.price ?? selectedPlot.price,
    };
  }, [selectedPlot]);

  const highlightedPlotId = useMemo(() => {
    const id =
      hoveredRow?.plot_id ??
      viewItem?.plot_id ??
      (selectedPlot?.id != null ? String(selectedPlot.id) : null) ??
      null;
    return id != null ? String(id) : null;
  }, [hoveredRow, viewItem, selectedPlot]);

  const mapShapes = useMemo(
    () => fcToMapShapes(fc, highlightedPlotId),
    [fc, highlightedPlotId]
  );

  const onConfirm = async (row) => {
    const id = row?.id ?? row?.uid;
    if (!id) return toast.error("Missing request id.");

    try {
      toast.message("Confirming burial request...");
      await confirmBurialRequest(id);
      toast.success("Request confirmed, plot was updated to occupied.");
      await fetchRequests();
      await fetchPlots();
      await fetchPlotsGeo();
    } catch (e) {
      console.error("confirm error:", e);
      toast.error(e?.message || "Failed to confirm request.");
    }
  };

  return (
    <div className="w-full">
      <Toaster richColors expand={false} />

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl">Burial Requests</CardTitle>
              <CardDescription>
                Option A, this screen shows burial_requests (including accepted ones).
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={fetchRequests}
                disabled={loading}
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          {/* mini stats */}
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <MiniStat icon={CalendarDays} label="All" value={stats.all} />
            <MiniStat icon={Clock3} label="Pending" value={stats.pending} />
            <MiniStat icon={CheckCircle2} label="Confirmed" value={stats.confirmed} />
            <MiniStat icon={ShieldCheck} label="Completed" value={stats.completed} />
          </div>
        </CardHeader>

        <CardContent>
          {/* controls */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-4">
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search deceased, family, plot..."
                  className="pl-8 w-full sm:w-[320px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-slate-500">
              Signed in as{" "}
              <span className="font-medium text-slate-700">
                {currentUser?.first_name || currentUser?.email || "Admin"}
              </span>
            </div>
          </div>

          <Separator className="my-2" />

          {/* table */}
          <div className="rounded-xl border bg-white">
            <div className="grid grid-cols-12 px-4 py-3 text-xs font-medium text-slate-500">
              <div className="col-span-3">Deceased Name</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Time</div>
              <div className="col-span-2">Plot</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right pr-1">Actions</div>
            </div>
            <Separator />

            <ScrollArea className="max-h-[56vh]">
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  No burial requests found.
                </div>
              ) : (
                filtered.map((r) => {
                  const reqDate = pickReqDate(r);
                  const reqTime = pickReqTime(r);
                  const status = safeLower(r?.status);
                  const canConfirm = status === "pending";

                  return (
                    <div
                      key={r.id ?? r.uid ?? Math.random()}
                      className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-slate-50"
                      onMouseEnter={() => setHoveredRow(r)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <div className="col-span-3 flex items-center gap-2 min-w-0">
                        <UserCircle2 className="h-4 w-4 text-slate-400" />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-800">
                            {r.deceased_name || "—"}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {r.family_contact_name ||
                              r.family_contact_email ||
                              (r.family_contact ? `User #${r.family_contact}` : "—")}
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        <span>{fmtDateShort(reqDate)}</span>
                      </div>

                      <div className="col-span-2 flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-700">{fmtTime(reqTime)}</span>
                      </div>

                      <div className="col-span-2 flex items-center gap-2 min-w-0">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{getReqPlotLabel(r)}</span>
                      </div>

                      <div className="col-span-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full text-white ${statusBadgeClass(
                            r.status
                          )}`}
                        >
                          {normalizeStatusLabel(r.status)}
                        </span>
                      </div>

                      <div className="col-span-1 flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="secondary"
                          onClick={() => setViewItem(r)}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {canConfirm && (
                          <Button
                            size="icon"
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() => onConfirm(r)}
                            title="Confirm"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </div>

          {/* Map under table, hidden when any modal is open */}
          <div className="mt-4 rounded-xl overflow-hidden border bg-white">
            <div className="px-4 py-3">
              <div className="text-sm font-medium text-slate-800">
                Plot Map
              </div>
              <div className="text-xs text-slate-500">
                Click a plot to reserve as admin.
              </div>
            </div>

            {!isAnyModalOpen && (
              <div className="h-[50vh]">
                <CemeteryMap
                  center={CEMETERY_CENTER}
                  zoom={19}
                  clickable={true}
                  showGeofence={true}
                  enableDrawing={false}
                  polygons={mapShapes.polygons}
                  markers={mapShapes.markers}
                  onEditPlot={handlePlotClick}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ✅ Plot details modal */}
      <PlotDetailsModal
        open={openPlotDetails}
        plot={selectedPlot}
        canReserve={canReserveSelectedPlot}
        onClose={() => {
          setOpenPlotDetails(false);
          if (!openReserve) setSelectedPlot(null);
        }}
        onReserve={() => {
          if (!canReserveSelectedPlot) {
            toast.message("This plot is not available for reservation.");
            return;
          }
          setOpenPlotDetails(false);
          setOpenReserve(true);
        }}
      />

      {/* ✅ Reservation dialog (reused) */}
      <ReservationDialog
        open={openReserve}
        plot={reservationPlot}
        onClose={() => {
          setOpenReserve(false);
          setSelectedPlot(null);
          setOpenPlotDetails(false);
        }}
        reserveFn={(plotId, notes) => reservePlotAsAdmin(plotId, notes)}
        onSuccess={() => {
          toast.success("Reservation created.");
          setOpenReserve(false);
          setSelectedPlot(null);
          setOpenPlotDetails(false);
          fetchPlots();
          fetchPlotsGeo();
        }}
      />

      {/* View modal */}
      <ViewModal item={viewItem} onOpenChange={(o) => !o && setViewItem(null)} />
    </div>
  );
}

/* -------------------------- small UI pieces -------------------------- */
function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className="h-4 w-4 text-slate-400" />
        <span>{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">
        {Number.isFinite(Number(value)) ? Number(value) : value ?? 0}
      </div>
    </div>
  );
}

/* -------------------------- plot details modal -------------------------- */
function PlotDetailsModal({ open, plot, canReserve, onClose, onReserve }) {
  const p = plot?.properties || {};
  const status = plot?.status ?? p.status ?? p.plot_status ?? "—";

  const plotName = p.plot_name ?? p.name ?? "—";
  const plotType = p.plot_type ?? "—";
  const uid = p.uid ?? plot?.uid ?? "—";
  const size = p.size_sqm ?? "—";
  const price = p.price ?? "—";
  const id = plot?.id ?? p.id ?? "—";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Plot Details</DialogTitle>
          <DialogDescription>
            Review the plot information. If available, you can create a reservation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Plot ID">
            <Badge variant="secondary">{String(id)}</Badge>
          </Field>

          <Field label="UID">
            <Badge variant="secondary">{String(uid)}</Badge>
          </Field>

          <Field label="Plot Name">{plotName}</Field>

          <Field label="Status">
            <span
              className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full text-white ${plotStatusBadge(
                status
              )}`}
            >
              {String(status || "—")}
            </span>
          </Field>

          <Field label="Type">{plotType}</Field>
          <Field label="Size (sqm)">{String(size)}</Field>
          <Field label="Price">{String(price)}</Field>

          {!canReserve && (
            <div className="text-xs text-slate-500">
              This plot is not available for reservation.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onReserve} disabled={!canReserve}>
            Reserve This Plot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- view-only modal + helpers -------------------------- */
function Field({ label, children }) {
  return (
    <div className="grid grid-cols-4 gap-3 items-start">
      <Label className="text-slate-500 col-span-1">{label}</Label>
      <div className="col-span-3 break-words">{children}</div>
    </div>
  );
}

function ViewModal({ item, onOpenChange }) {
  const open = !!item;

  const date = pickReqDate(item);
  const time = pickReqTime(item);
  const plotLabel = getReqPlotLabel(item);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Burial Request Details</DialogTitle>
          <DialogDescription>Full details for this request.</DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-4">
            <Field label="Deceased Name">
              <Badge variant="secondary">{item.deceased_name || "—"}</Badge>
            </Field>

            <Field label="Plot">{plotLabel}</Field>

            <Field label="Family Contact">
              {item.family_contact_name ||
                item.family_contact_email ||
                item.family_contact ||
                "—"}
            </Field>

            <Field label="Birth Date">{fmtDateLong(item.birth_date)}</Field>
            <Field label="Death Date">{fmtDateLong(item.death_date)}</Field>

            <Field label="Service Date">{fmtDateLong(date)}</Field>
            <Field label="Service Time">{fmtTime(time)}</Field>

            <Field label="Status">
              <span
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full text-white ${statusBadgeClass(
                  item.status
                )}`}
              >
                {normalizeStatusLabel(item.status)}
              </span>
            </Field>

            <Field label="Notes">
              <div className="whitespace-pre-wrap text-slate-700">
                {item.notes || item.special_requirements || "—"}
              </div>
            </Field>

            <Separator />

            <div className="text-xs text-slate-400">
              Created: {fmtDateLong(item.created_at)} , Updated: {fmtDateLong(item.updated_at)}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
