// frontend/src/views/admin/pages/MaintenanceSchedules.jsx
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
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Badge } from "../../../components/ui/badge";
import {
  Eye,
  Search,
  CalendarDays,
  UserCircle2,
  ShieldCheck,
  CheckCircle2,
  Clock4,
} from "lucide-react";

import { Toaster, toast } from "sonner";

import CemeteryMap, { CEMETERY_CENTER } from "../../../components/map/CemeteryMap.jsx";

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
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useMemo(() => auth?.user ?? null, [auth]);
}

/* --------------------------- helpers --------------------------- */
const fmtDateLong = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

const fmtTime = (t) => (t ? String(t).slice(0, 5) : "");

const normalizeStatus = (raw) => {
  const n = String(raw || "").toLowerCase();
  if (!n) return "Unknown";
  if (n === "pending") return "Pending";
  if (n === "scheduled") return "Scheduled";
  if (n === "completed") return "Completed";
  if (n === "reschedule_requested") return "Reschedule Requested";
  if (n === "cancelled" || n === "canceled") return "Cancelled";
  return n.charAt(0).toUpperCase() + n.slice(1);
};

const statusColor = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "completed") return "bg-indigo-600 text-white";
  if (v === "scheduled") return "bg-emerald-600 text-white";
  if (v === "reschedule_requested") return "bg-amber-500 text-white";
  if (v === "cancelled" || v === "canceled") return "bg-rose-600 text-white";
  return "bg-slate-500 text-white"; // pending/unknown
};

const getRowPlotId = (r) =>
  r?.plot_id ?? r?.plotId ?? r?.plot?.id ?? r?.plot ?? r?.grave_plot_id ?? null;

/* -------------------- GeoJSON ➜ CemeteryMap helpers -------------------- */
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

  const isHighlighted = highlightedId && id && String(id) === String(highlightedId);

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
    if (rings[0]) pushPolygonFromRing(rings[0], id || `poly-${Math.random().toString(36).slice(2)}`);
    return out;
  }

  if (type === "MultiPolygon") {
    const polys = Array.isArray(coords) ? coords : [];
    polys.forEach((polyCoords, idx) => {
      const rings = Array.isArray(polyCoords) ? polyCoords : [];
      if (rings[0]) pushPolygonFromRing(rings[0], `${id || "poly"}-${idx}`);
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

/* =======================================================================
   PAGE: Admin MaintenanceSchedules (based on maintenance_requests)
========================================================================== */
export default function MaintenanceSchedules() {
  const currentUser = useAuthUser();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [fc, setFc] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);

  // modals
  const [viewItem, setViewItem] = useState(null);
  const [scheduleItem, setScheduleItem] = useState(null);
  const [completeItem, setCompleteItem] = useState(null);
  const isAnyModalOpen = !!viewItem || !!scheduleItem || !!completeItem;

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const qs =
        statusFilter && statusFilter !== "All"
          ? `?status=${encodeURIComponent(statusFilter)}`
          : "";

      const url = `${API_BASE}/admin/maintenance-requests${qs}`;
      console.log("[Admin Maintenance] GET", url);

      const res = await fetch(url, {
        headers: authHeaders({ Accept: "application/json" }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Failed: ${res.status}`);
      }

      // backend returns: { ok: true, data: [...] }
      const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setRows(arr);
    } catch (e) {
      console.error("[Admin Maintenance] fetch error:", e);
      toast.error(e?.message || "Failed to load maintenance requests.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchPlotsGeo = useCallback(async () => {
    try {
      const url = `${API_BASE}/plot/`;
      const res = await fetch(url, { headers: authHeaders() });
      const json = await res.json().catch(() => null);
      setFc(json || null);
    } catch (e) {
      console.error("[plot geojson] fetch error:", e);
      setFc(null);
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchPlotsGeo();
  }, [fetchList, fetchPlotsGeo]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows.filter((r) => {
      const text =
        [
          r.deceased_name,
          r.description,
          r.priority,
          r.status,
          r.requester_name,
          r.assigned_staff_name,
          r.family_contact,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase() || "";

      const passQ = !needle || text.includes(needle);
      return passQ;
    });
  }, [rows, q]);

  const highlightedPlotId = useMemo(() => {
    const id = getRowPlotId(hoveredRow) ?? getRowPlotId(viewItem) ?? null;
    return id != null ? String(id) : null;
  }, [hoveredRow, viewItem]);

  const mapShapes = useMemo(() => fcToMapShapes(fc, highlightedPlotId), [fc, highlightedPlotId]);

  return (
    <div className="w-full">
      <Toaster richColors expand={false} />

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl">Maintenance Requests</CardTitle>
          <CardDescription>
            View visitor requests, schedule them, and mark as completed.
          </CardDescription>
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
                  placeholder="Search name / requester / status…"
                  className="pl-8 w-[280px]"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="pending">pending</SelectItem>
                  <SelectItem value="scheduled">scheduled</SelectItem>
                  <SelectItem value="completed">completed</SelectItem>
                  <SelectItem value="reschedule_requested">reschedule_requested</SelectItem>
                  <SelectItem value="cancelled">cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="secondary" onClick={fetchList}>
              Refresh
            </Button>
          </div>

          <Separator className="my-2" />

          {/* table */}
          <div className="rounded-lg border">
            <div className="grid grid-cols-12 px-4 py-3 text-xs font-medium text-slate-500">
              <div className="col-span-3">Deceased / Request</div>
              <div className="col-span-2">Priority</div>
              <div className="col-span-3">Preferred</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right pr-1">Actions</div>
            </div>
            <Separator />

            <ScrollArea className="max-h-[56vh]">
              {loading ? (
                <div className="p-6 text-sm text-slate-500">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No requests found.</div>
              ) : (
                filtered.map((r) => {
                  const status = String(r.status || "").toLowerCase();
                  const isCompleted = status === "completed";
                  const isCancelled = status === "cancelled" || status === "canceled";

                  return (
                    <div
                      key={r.id ?? r.uid ?? Math.random()}
                      className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-slate-50"
                      onMouseEnter={() => setHoveredRow(r)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <div className="col-span-3 flex items-start gap-2">
                        <UserCircle2 className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {r.deceased_name || "—"}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            Requester: {r.requester_name || r.family_contact || "—"}
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2">
                        <Badge variant="secondary">{String(r.priority || "—")}</Badge>
                      </div>

                      <div className="col-span-3 flex items-center gap-2 text-slate-700">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        <span className="truncate">
                          {r.preferred_date ? fmtDateLong(r.preferred_date) : "—"}{" "}
                          {fmtTime(r.preferred_time)}
                        </span>
                      </div>

                      <div className="col-span-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${statusColor(
                            r.status
                          )}`}
                        >
                          {normalizeStatus(r.status)}
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
                          onClick={() => setScheduleItem(r)}
                          title="Schedule"
                          disabled={isCompleted || isCancelled}
                        >
                          <Clock4 className="h-4 w-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => setCompleteItem(r)}
                          title="Complete"
                          disabled={isCompleted || isCancelled}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </div>

          {/* Map under table */}
          <div className="mt-4 rounded-md overflow-hidden border">
            <div className="px-4 py-2 text-sm text-slate-500">Plot Map</div>
            {!isAnyModalOpen && (
              <div className="mt-4 h-[50vh]">
                <CemeteryMap
                  center={CEMETERY_CENTER}
                  zoom={19}
                  clickable={false}
                  showGeofence={true}
                  enableDrawing={false}
                  polygons={mapShapes.polygons}
                  markers={mapShapes.markers}
                  onEditPlot={() => {}}
                />
              </div>
            )}
            <div className="px-4 pb-3 text-xs text-slate-500">
              Note: Plot highlighting only works if your maintenance_requests rows contain a plot_id.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View modal */}
      <ViewModal item={viewItem} onOpenChange={(o) => !o && setViewItem(null)} fc={fc} />

      {/* Schedule modal */}
      <ScheduleModal
        item={scheduleItem}
        onOpenChange={(o) => !o && setScheduleItem(null)}
        currentUser={currentUser}
        onSaved={async () => {
          setScheduleItem(null);
          await fetchList();
        }}
      />

      {/* Complete modal */}
      <CompleteModal
        item={completeItem}
        onOpenChange={(o) => !o && setCompleteItem(null)}
        onSaved={async () => {
          setCompleteItem(null);
          await fetchList();
        }}
      />
    </div>
  );
}

/* -------------------------- view-only modal -------------------------- */
function Field({ label, children }) {
  return (
    <div className="grid grid-cols-4 gap-3 items-start">
      <Label className="text-slate-500 col-span-1">{label}</Label>
      <div className="col-span-3 break-words">{children}</div>
    </div>
  );
}

function ViewModal({ item, onOpenChange, fc }) {
  const open = !!item;
  const plotId = item?.plot_id != null ? String(item.plot_id) : "";

  const shapes = useMemo(() => fcToMapShapes(fc, plotId), [fc, plotId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Maintenance Request Details</DialogTitle>
          <DialogDescription>Full details for this request.</DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-4">
            <Field label="Deceased Name">
              <Badge variant="secondary">{item.deceased_name || "—"}</Badge>
            </Field>

            <Field label="Requester">
              {item.requester_name || item.family_contact || "—"}
            </Field>

            <Field label="Priority">{item.priority || "—"}</Field>

            <Field label="Preferred">
              {item.preferred_date ? fmtDateLong(item.preferred_date) : "—"}{" "}
              {fmtTime(item.preferred_time)}
            </Field>

            <Field label="Scheduled">
              {item.scheduled_date ? (
                <>
                  {fmtDateLong(item.scheduled_date)} {fmtTime(item.scheduled_time)}
                  {item.assigned_staff_name ? (
                    <>
                      {" "}
                      • Staff: <span className="font-medium">{item.assigned_staff_name}</span>
                    </>
                  ) : null}
                </>
              ) : (
                "—"
              )}
            </Field>

            <Field label="Status">
              <span
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${statusColor(
                  item.status
                )}`}
              >
                {normalizeStatus(item.status)}
              </span>
            </Field>

            <Field label="Description">{item.description || "—"}</Field>

            <Field label="Plot ID">{plotId || "—"}</Field>

            <Separator />

            <div className="space-y-2">
              <Label className="text-slate-500">Plot Map</Label>
              <div className="h-[46vh] rounded-md overflow-hidden border">
                <CemeteryMap
                  center={CEMETERY_CENTER}
                  zoom={19}
                  clickable={false}
                  showGeofence={true}
                  enableDrawing={false}
                  polygons={shapes.polygons}
                  markers={shapes.markers}
                  onEditPlot={() => {}}
                />
              </div>
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

/* -------------------------- schedule modal -------------------------- */
function ScheduleModal({ item, onOpenChange, onSaved }) {
  const open = !!item;
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    scheduled_date: "",
    scheduled_time: "",
    assigned_staff_id: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      scheduled_date: item?.scheduled_date?.slice(0, 10) || "",
      scheduled_time: item?.scheduled_time?.slice(0, 5) || "",
      assigned_staff_id: item?.assigned_staff_id != null ? String(item.assigned_staff_id) : "",
    });
  }, [open, item]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    try {
      if (!item?.id) throw new Error("Missing request id");
      if (!form.scheduled_date || !form.scheduled_time) {
        throw new Error("scheduled_date and scheduled_time are required");
      }

      setSaving(true);

      const payload = {
        scheduled_date: form.scheduled_date,
        scheduled_time: form.scheduled_time,
        assigned_staff_id: form.assigned_staff_id ? Number(form.assigned_staff_id) : null,
      };

      const url = `${API_BASE}/admin/maintenance/${encodeURIComponent(String(item.id))}/schedule`;
      console.log("[Admin Maintenance] PATCH", url, payload);

      const res = await fetch(url, {
        method: "PATCH",
        headers: authHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `Failed: ${res.status}`);

      toast.success("Scheduled successfully.");
      onSaved?.(data);
    } catch (e) {
      console.error("schedule error:", e);
      toast.error(e?.message || "Failed to schedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Maintenance</DialogTitle>
          <DialogDescription>
            This updates the request and sets status to <b>scheduled</b>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Scheduled Date</Label>
            <Input
              type="date"
              value={form.scheduled_date}
              onChange={(e) => set("scheduled_date", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Scheduled Time</Label>
            <Input
              type="time"
              value={form.scheduled_time}
              onChange={(e) => set("scheduled_time", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Assigned Staff ID (optional)</Label>
            <Input
              value={form.assigned_staff_id}
              onChange={(e) => set("assigned_staff_id", e.target.value)}
              placeholder="e.g. 2"
            />
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Uses: PATCH /admin/maintenance/:id/schedule
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Scheduling…" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- complete modal -------------------------- */
function CompleteModal({ item, onOpenChange, onSaved }) {
  const open = !!item;
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setNotes(String(item?.completion_notes || ""));
  }, [open, item]);

  const submit = async () => {
    try {
      if (!item?.id) throw new Error("Missing request id");

      setSaving(true);

      const payload = { completion_notes: notes.trim() || null };
      const url = `${API_BASE}/admin/maintenance/${encodeURIComponent(String(item.id))}/complete`;

      console.log("[Admin Maintenance] PATCH", url, payload);

      const res = await fetch(url, {
        method: "PATCH",
        headers: authHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `Failed: ${res.status}`);

      toast.success("Marked as completed.");
      onSaved?.(data);
    } catch (e) {
      console.error("complete error:", e);
      toast.error(e?.message || "Failed to complete.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete Maintenance</DialogTitle>
          <DialogDescription>
            This sets status to <b>completed</b> and writes completion notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Completion Notes (optional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Cleaned area and removed weeds"
          />
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Uses: PATCH /admin/maintenance/:id/complete
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Completing…" : "Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
