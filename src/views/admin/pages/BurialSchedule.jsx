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
  Pencil,
  Trash2,
  Plus,
  Search,
  CalendarDays,
  UserCircle2,
  ShieldCheck,
} from "lucide-react";

import { Toaster, toast } from "sonner";

import CemeteryMap, {
  CEMETERY_CENTER,
} from "../../../components/map/CemeteryMap.jsx";

// ✅ Reuse existing dialog component (same one used by visitor)
import ReservationDialog from "../../../views/visitor/components/ReservationDialog";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

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

/* --------------------------- reservation helper (✅ ADDED HERE) --------------------------- */
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
    // fallback only for 404 (route missing) — you can also add 403 if your setup permits
    if (e?.status === 404) {
      return await attempt(VISITOR_RESERVE_ENDPOINT);
    }
    throw e;
  }
}

/* --------------------------- other helpers --------------------------- */
const fmtDateLong = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const statusColor = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "confirmed") return "bg-emerald-600";
  if (v === "completed") return "bg-indigo-600";
  return "bg-slate-500";
};
const normalizeStatus = (raw) => {
  if (!raw) return "Confirmed";
  const n = String(raw).toLowerCase();
  if (n === "completed") return "Completed";
  if (n === "confirmed") return "Confirmed";
  return n.charAt(0).toUpperCase() + n.slice(1);
};

// plot status badge helper (available / reserved / occupied)
const plotStatusBadge = (s) => {
  const v = String(s || "").toLowerCase();
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

/**
 * Convert one GeoJSON feature into CemeteryMap shapes.
 * Returns { polygons: [...], markers: [...] }
 */
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

  // pass status to CemeteryMap so it can color + legend correctly
  const status = properties?.status ?? properties?.plot_status ?? null;

  // Helper to push one polygon ring
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
      status, // ✅ enables status-based coloring
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

/**
 * Convert full FeatureCollection ➜ { polygons, markers }
 */
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

/* -------------------------- page main -------------------------- */
export default function BurialSchedule() {
  const currentUser = useAuthUser();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // dropdown data
  const [plots, setPlots] = useState([]); // [{id, plot_name}]
  const [visitors, setVisitors] = useState([]); // [{id, full_name}]

  // map data (full GeoJSON)
  const [fc, setFc] = useState(null);

  const [hoveredRow, setHoveredRow] = useState(null);

  // schedule modals
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [openForm, setOpenForm] = useState(false);

  // ✅ plot click -> details modal -> reservation dialog
  const [selectedPlot, setSelectedPlot] = useState(null); // polygon object from CemeteryMap
  const [openPlotDetails, setOpenPlotDetails] = useState(false);
  const [openReserve, setOpenReserve] = useState(false);

  const isAnyModalOpen =
    openForm || !!viewItem || !!confirmDelete || openPlotDetails || openReserve;

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/burial-schedules/`, {
        headers: authHeaders({ Accept: "application/json" }),
      });
      const data = await res.json();
      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];
      setRows(arr);
    } catch (e) {
      console.error("[burial-schedules] fetch error:", e);
      toast.error("Failed to load schedules.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlots = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/plots/available`, {
        headers: authHeaders({ Accept: "application/json" }),
      });
      const json = await res.json();
      setPlots(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error("[plots] fetch error:", e);
      setPlots([]);
      toast.error("Failed to load available plots.");
    }
  }, []);

  const fetchVisitors = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/visitors`, {
        headers: authHeaders({ Accept: "application/json" }),
      });
      const data = await res.json();
      const arr = (Array.isArray(data) ? data : []).map((v) => ({
        id: v.id,
        full_name:
          v.full_name ??
          [v.first_name, v.last_name].filter(Boolean).join(" ") ??
          "Unknown",
      }));
      setVisitors(arr);
    } catch (e) {
      console.error("[visitors] fetch error:", e);
      setVisitors([]);
      toast.error("Failed to load visitors.");
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
      toast.error("Failed to load plot map.");
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchPlots();
    fetchVisitors();
    fetchPlotsGeo();
  }, [fetchList, fetchPlots, fetchVisitors, fetchPlotsGeo]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const passQ =
        !needle ||
        String(r.deceased_name || "").toLowerCase().includes(needle) ||
        String(r.approved_by_name || r.approved_by || "")
          .toLowerCase()
          .includes(needle);
      const passStatus =
        statusFilter === "All" ||
        String(r.status || "").toLowerCase() === statusFilter.toLowerCase();
      return passQ && passStatus;
    });
  }, [rows, q, statusFilter]);

  const onCreate = () => {
    setEditItem(null);
    setOpenForm(true);
  };
  const onEdit = (item) => {
    setEditItem(item);
    setOpenForm(true);
  };

  const onDelete = async (rowOrId) => {
    const id =
      typeof rowOrId === "object" ? rowOrId.id ?? rowOrId.uid : rowOrId;
    const who = typeof rowOrId === "object" ? rowOrId.deceased_name : null;

    try {
      const res = await fetch(
        `${API_BASE}/admin/burial-schedules/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );
      if (!res.ok) throw new Error(await res.text());

      toast.success(`Schedule${who ? ` for “${who}”` : ""} deleted.`);
      setConfirmDelete(null);
      fetchList();
      fetchPlots();
      fetchPlotsGeo();
    } catch (e) {
      console.error("delete error:", e);
      toast.error("Failed to delete schedule.");
    }
  };

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
    return String(s || "").toLowerCase();
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

  // highlight on the big map
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

  return (
    <div className="w-full">
      <Toaster richColors expand={false} />

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl">Burial Schedule</CardTitle>
          <CardDescription>Manage schedules for upcoming burials.</CardDescription>
        </CardHeader>

        <CardContent>
          {/* controls */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-4">
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search deceased or approver…"
                  className="pl-8 w-[260px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={onCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Add Schedule
            </Button>
          </div>

          <Separator className="my-2" />

          {/* table */}
          <div className="rounded-lg border">
            <div className="grid grid-cols-12 px-4 py-3 text-xs font-medium text-slate-500">
              <div className="col-span-3">Deceased Name</div>
              <div className="col-span-3">Burial Date</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Approved By</div>
              <div className="col-span-2 text-right pr-1">Actions</div>
            </div>
            <Separator />

            <ScrollArea className="max-h-[56vh]">
              {loading ? (
                <div className="p-6 text-sm text-slate-500">Loading schedules…</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No schedules found.</div>
              ) : (
                filtered.map((r) => (
                  <div
                    key={r.id ?? r.uid ?? Math.random()}
                    className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-slate-50"
                    onMouseEnter={() => setHoveredRow(r)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <div className="col-span-3 flex items-center gap-2">
                      <UserCircle2 className="h-4 w-4 text-slate-400" />
                      <span className="truncate">{r.deceased_name || "—"}</span>
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      <span>{fmtDateLong(r.burial_date)}</span>
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full text-white ${statusColor(
                          r.status
                        )}`}
                      >
                        {normalizeStatus(r.status)}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-slate-400" />
                      <span className="truncate">
                        {r.approved_by_name || r.approved_by || "—"}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => setViewItem(r)}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => onEdit(r)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => setConfirmDelete(r)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Map under table — hidden when any modal is open */}
          <div className="mt-4 rounded-md overflow-hidden border">
            <div className="px-4 py-2 text-sm text-slate-500">
              Plot Map (click a plot to reserve)
            </div>

            {!isAnyModalOpen && (
              <div className="mt-4 h-[50vh]">
                <CemeteryMap
                  center={CEMETERY_CENTER}
                  zoom={19}
                  clickable={true}              // ✅ allow clicking
                  showGeofence={true}
                  enableDrawing={false}
                  polygons={mapShapes.polygons}
                  markers={mapShapes.markers}
                  onEditPlot={handlePlotClick}  // ✅ treat as plot click hook
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

      {/* Create / Edit modal */}
      <UpsertModal
        open={openForm}
        onOpenChange={(v) => {
          setOpenForm(v);
          if (!v) setEditItem(null);
        }}
        item={editItem}
        plots={plots}
        visitors={visitors}
        currentUser={currentUser}
        fc={fc}
        onSaved={() => {
          setOpenForm(false);
          setEditItem(null);
          fetchList();
          fetchPlots();
          fetchPlotsGeo();
        }}
      />

      {/* Confirm Delete */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schedule</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you sure you want to delete this burial schedule?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => onDelete(confirmDelete?.id ?? confirmDelete?.uid)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Burial Schedule Details</DialogTitle>
          <DialogDescription>Full details for this schedule.</DialogDescription>
        </DialogHeader>
        {item ? (
          <div className="space-y-4">
            <Field label="Deceased Name">
              <Badge variant="secondary">{item.deceased_name || "—"}</Badge>
            </Field>
            <Field label="Plot">{item.plot_name || item.plot_id || "—"}</Field>
            <Field label="Family Contact">
              {item.family_contact_name || item.family_contact || "—"}
            </Field>
            <Field label="Birth Date">{fmtDateLong(item.birth_date || item.bith_date)}</Field>
            <Field label="Death Date">{fmtDateLong(item.death_date)}</Field>
            <Field label="Burial Date">{fmtDateLong(item.burial_date)}</Field>
            <Field label="Status">
              <span
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full text-white ${statusColor(
                  item.status
                )}`}
              >
                {normalizeStatus(item.status)}
              </span>
            </Field>
            <Field label="Approved By">{item.approved_by_name || item.approved_by || "—"}</Field>
            <Field label="Special Requirements">
              <div className="whitespace-pre-wrap text-slate-700">
                {item.special_requirements || "—"}
              </div>
            </Field>
            <Field label="Memorial Text">
              <div className="whitespace-pre-wrap text-slate-700">
                {item.memorial_text || "—"}
              </div>
            </Field>
            <Separator />
            <div className="text-xs text-slate-400">
              Created: {fmtDateLong(item.created_at)} • Updated: {fmtDateLong(item.updated_at)}
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

function UpsertModal({ open, onOpenChange, item, onSaved, plots, visitors, currentUser, fc }) {
  const isEdit = !!item;
  const [saving, setSaving] = useState(false);

  // today in YYYY-MM-DD (used to disallow future birth/death dates)
  const todayStr = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState(() => ({
    deceased_name: "",
    plot_id: "",
    family_contact: "",
    birth_date: "",
    death_date: "",
    burial_date: "",
    approved_by: currentUser?.id ?? "",
    special_requirements: "",
    memorial_text: "",
  }));

  useEffect(() => {
    if (isEdit) {
      setForm({
        deceased_name: item.deceased_name ?? "",
        plot_id: item.plot_id ?? "",
        family_contact: item.family_contact ?? "",
        birth_date: item.birth_date ?? item.bith_date ?? "",
        death_date: item.death_date ?? "",
        burial_date: item.burial_date ?? "",
        approved_by: item.approved_by ?? currentUser?.id ?? "",
        special_requirements: item.special_requirements ?? "",
        memorial_text: item.memorial_text ?? "",
      });
    } else {
      setForm((f) => ({
        ...f,
        approved_by: currentUser?.id ?? "",
      }));
    }
  }, [isEdit, item, currentUser?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        status: isEdit ? undefined : "Confirmed",
      };
      const url = isEdit
        ? `${API_BASE}/admin/burial-schedules/${encodeURIComponent(item.id ?? item.uid)}`
        : `${API_BASE}/admin/burial-schedules`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json().catch(() => ({}));
      toast.success(isEdit ? "Schedule updated successfully." : "Schedule created successfully.");
      onSaved?.(data);
    } catch (e) {
      console.error("save error:", e);
      toast.error(isEdit ? "Failed to update schedule." : "Failed to create schedule.");
    } finally {
      setSaving(false);
    }
  };

  const approverName = `${currentUser?.first_name ?? ""} ${currentUser?.last_name ?? ""}`.trim();
  const highlightedId = String(form.plot_id || "");

  const modalMapShapes = useMemo(() => fcToMapShapes(fc, highlightedId), [fc, highlightedId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-6xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Burial Schedule" : "Add Burial Schedule"}</DialogTitle>
          <DialogDescription>
            Fill in the details then save. The map highlights the selected plot.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT: form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Deceased Name</Label>
              <Input
                value={form.deceased_name}
                onChange={(e) => set("deceased_name", e.target.value)}
                placeholder="e.g. Hazel Emphasis"
              />
            </div>

            <div className="space-y-2">
              <Label>Plot</Label>
              <Select value={String(form.plot_id || "")} onValueChange={(v) => set("plot_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plot" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(plots) && plots.length > 0 ? (
                    plots.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.plot_name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-slate-500">No available plots</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Family Contact</Label>
              <Select
                value={String(form.family_contact || "")}
                onValueChange={(v) => set("family_contact", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select family contact" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(visitors) && visitors.length > 0 ? (
                    visitors.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.full_name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-slate-500">No visitors found</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Approved By</Label>
              <Input value={approverName || "—"} disabled />
            </div>

            {/* Birth & Death dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Birth Date</Label>
                <Input
                  type="date"
                  max={todayStr}
                  value={form.birth_date?.slice(0, 10) || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v && v > todayStr) set("birth_date", todayStr);
                    else set("birth_date", v);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Death Date</Label>
                <Input
                  type="date"
                  max={todayStr}
                  value={form.death_date?.slice(0, 10) || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v && v > todayStr) set("death_date", todayStr);
                    else set("death_date", v);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Burial Date</Label>
              <Input
                type="date"
                value={form.burial_date?.slice(0, 10) || ""}
                onChange={(e) => set("burial_date", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Special Requirements</Label>
              <textarea
                className="w-full min-h-[84px] rounded-md border bg-transparent p-2 text-sm"
                value={form.special_requirements}
                onChange={(e) => set("special_requirements", e.target.value)}
                placeholder="e.g., religious rites, flowers, accessibility, etc."
              />
            </div>

            <div className="space-y-2">
              <Label>Memorial Text</Label>
              <textarea
                className="w-full min-h-[84px] rounded-md border bg-transparent p-2 text-sm"
                value={form.memorial_text}
                onChange={(e) => set("memorial_text", e.target.value)}
                placeholder="Optional inscription"
              />
            </div>
          </div>

          {/* RIGHT: map */}
          <div className="space-y-2 md:pl-1">
            <Label className="sr-only">Plot Map</Label>
            <div className="h-64 md:h-[520px] rounded-md overflow-hidden border">
              <CemeteryMap
                center={CEMETERY_CENTER}
                zoom={19}
                clickable={true}
                showGeofence={true}
                enableDrawing={false}
                polygons={modalMapShapes.polygons}
                markers={modalMapShapes.markers}
                onEditPlot={(poly) => {
                  if (poly?.id) set("plot_id", String(poly.id));
                  else if (poly?.properties) {
                    const pid = poly.properties.id ?? poly.properties.uid;
                    if (pid != null) set("plot_id", String(pid));
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Selecting a plot highlights it on the map. You can also click a plot on the map to
              select it.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save Changes" : "Create Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
