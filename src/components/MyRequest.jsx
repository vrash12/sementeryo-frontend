// frontend/src/components/MyRequest.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";

import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Alert, AlertDescription } from "./ui/alert";

import {
  ClipboardList,
  Wrench,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  RefreshCw,
  CalendarDays,
  MapPin,
  Flag,
  MessageSquareText,
} from "lucide-react";

/**
 * IMPORTANT:
 * - Your backend is mounted under /api (e.g. /api/visitor/...)
 * - Some dev setups use VITE_API_BASE_URL like:
 *   - "/api"
 *   - "http://localhost:5000/api"
 *   - "http://localhost:5000"  (missing /api)
 *
 * This component tries multiple base candidates so it works in all cases.
 */
const RAW_API_BASE =
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

function getToken(auth) {
  return auth?.accessToken || auth?.token || auth?.jwt || "";
}

function getUserId(auth) {
  // backend expects visitor user id for :family_contact
  return auth?.user?.id ?? auth?.user?.user_id ?? null;
}

/* --------------------------- fetch helper --------------------------- */
async function fetchFirstOk(urls, options) {
  let lastErr = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, options);
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json")
        ? await res.json().catch(() => ({}))
        : await res.text().catch(() => "");

      if (res.ok) return { res, body, url };

      const msg =
        typeof body === "string"
          ? body
          : body?.message || body?.error || `HTTP ${res.status}`;

      // if 404, try next candidate URL
      if (res.status === 404) {
        lastErr = new Error(msg);
        continue;
      }

      throw new Error(msg);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("Request failed");
}

/* --------------------------- endpoints --------------------------- */
/**
 * These are "candidate" paths because backend routes can differ between versions.
 * We'll try each until it finds one that returns 200.
 */
const PATHS = {
  burialList: (userId) => [
    `/visitor/my-burial-requests/${encodeURIComponent(userId)}`,
    `/visitor/burial-requests/${encodeURIComponent(userId)}`,
  ],
  maintenanceList: (userId) => [
    `/visitor/my-maintenance-requests/${encodeURIComponent(userId)}`,
    `/visitor/maintenance-requests/${encodeURIComponent(userId)}`,
  ],

  cancelBurial: (reqId) => [
    `/visitor/request-burial/cancel/${encodeURIComponent(reqId)}`,
    `/visitor/burial-request/${encodeURIComponent(reqId)}/cancel`,
    `/visitor/cancel-burial-request/${encodeURIComponent(reqId)}`,
  ],
  cancelMaintenance: (reqId) => [
    `/visitor/request-maintenance/cancel/${encodeURIComponent(reqId)}`,
    `/visitor/maintenance-request/${encodeURIComponent(reqId)}/cancel`,
    `/visitor/cancel-maintenance-request/${encodeURIComponent(reqId)}`,
  ],
};

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}

function normStatus(s) {
  const v = safeLower(s || "pending");
  if (v === "canceled") return "cancelled";
  return v;
}

function fmtDateShort(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(t) {
  if (!t) return "—";
  return String(t);
}

// Burial request date/time fields can vary in your DB
function pickBurialDate(r) {
  return r?.scheduled_date || r?.burial_date || r?.service_date || r?.date || null;
}
function pickBurialTime(r) {
  return r?.scheduled_time || r?.burial_time || r?.service_time || r?.time || null;
}
function pickPlotLabel(r) {
  return r?.plot_code || r?.plot_name || r?.plot_uid || r?.plot_id || "—";
}

/* ============================================================================

   Component

   ✅ FIX INCLUDED:
   - If you render <MyRequest /> as a PAGE (no props), it will open by default.
   - If you render it as a MODAL (controlled), pass open/onOpenChange normally.

============================================================================ */
export default function MyRequest({ open: openProp, onOpenChange: onOpenChangeProp }) {
  // If open prop is missing, default to open (so it works as a page).
  const [internalOpen, setInternalOpen] = useState(true);
  const open = openProp ?? internalOpen;
  const onOpenChange = onOpenChangeProp ?? setInternalOpen;

  const auth = useMemo(() => readAuth(), []);
  const token = useMemo(() => getToken(auth), [auth]);
  const requestOwnerId = useMemo(() => getUserId(auth), [auth]);

  // Build base candidates (robust against missing /api in env)
  const API_BASES = useMemo(() => {
    const b = String(RAW_API_BASE || "").replace(/\/+$/, "");
    const candidates = [];

    if (b) candidates.push(b);
    // if env is host-only (no /api), try adding /api
    if (b && !/\/api$/i.test(b)) candidates.push(`${b}/api`);

    // always try relative /api
    candidates.push("/api");
    // and also try empty base as last resort
    candidates.push("");

    return [...new Set(candidates)];
  }, []);

  const headers = useMemo(
    () => ({
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  const [tab, setTab] = useState("burial");
  const [burial, setBurial] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState({ burial: false, maintenance: false });
  const [msg, setMsg] = useState({ type: "", text: "" });

  const expandUrls = useCallback(
    (paths) => paths.flatMap((p) => API_BASES.map((base) => `${base}${p}`)),
    [API_BASES]
  );

  const fetchList = useCallback(
    async (which) => {
      if (!requestOwnerId) {
        setMsg({ type: "error", text: "Missing user id, please login again." });
        return;
      }
      if (!token) {
        setMsg({ type: "error", text: "Missing token, please login again." });
        return;
      }

      const setList = which === "burial" ? setBurial : setMaintenance;

      const urls =
        which === "burial"
          ? expandUrls(PATHS.burialList(requestOwnerId))
          : expandUrls(PATHS.maintenanceList(requestOwnerId));

      setLoading((l) => ({ ...l, [which]: true }));
      setMsg({ type: "", text: "" });

      try {
        const { body } = await fetchFirstOk(urls, { headers });
        const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        setList(rows);
      } catch (err) {
        setMsg({
          type: "error",
          text: err?.message || "Unable to fetch requests.",
        });
        setList([]);
      } finally {
        setLoading((l) => ({ ...l, [which]: false }));
      }
    },
    [expandUrls, headers, requestOwnerId, token]
  );

  useEffect(() => {
    if (!open) return;
    fetchList("burial");
    fetchList("maintenance");
  }, [open, fetchList]);

  async function handleCancel(which, id) {
    setMsg({ type: "", text: "" });

    const list = which === "burial" ? burial : maintenance;
    const setList = which === "burial" ? setBurial : setMaintenance;
    const original = [...list];

    // optimistic UI
    setList((rows) =>
      rows.map((r) =>
        String(r.id ?? r.request_id ?? r.reference_no) === String(id)
          ? { ...r, status: "cancelled" }
          : r
      )
    );

    try {
      const urls =
        which === "burial"
          ? expandUrls(PATHS.cancelBurial(id))
          : expandUrls(PATHS.cancelMaintenance(id));

      // try PATCH first, fallback to POST
      try {
        await fetchFirstOk(urls, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ reason: "user-cancelled" }),
        });
      } catch {
        await fetchFirstOk(urls, {
          method: "POST",
          headers,
          body: JSON.stringify({ reason: "user-cancelled" }),
        });
      }

      setMsg({ type: "ok", text: "Request cancelled." });

      // refresh list
      await fetchList(which);

      setTimeout(() => {
        setMsg((m) => (m.type === "ok" ? { type: "", text: "" } : m));
      }, 2500);
    } catch (err) {
      setList(original);
      setMsg({
        type: "error",
        text: err?.message || "Unable to cancel the request.",
      });
    }
  }

  const burialCount = burial?.length ?? 0;
  const maintenanceCount = maintenance?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl bg-white/90 backdrop-blur border-white/60 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
            My Requests
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Track your submitted requests and next steps.
          </DialogDescription>
        </DialogHeader>

        {msg.text ? (
          <Alert
            variant={msg.type === "error" ? "destructive" : "default"}
            className={
              msg.type === "error"
                ? "mb-3 bg-rose-50/90 backdrop-blur border-rose-200 shadow-md"
                : "mb-3 border-emerald-200 bg-emerald-50/90 backdrop-blur text-emerald-700 shadow-md"
            }
          >
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gradient-to-br from-emerald-50/80 to-cyan-50/80 backdrop-blur border border-emerald-100 shadow-md">
            <TabsTrigger
              value="burial"
              className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <ClipboardList className="h-4 w-4" />
              Burial Requests
              <Badge variant="secondary" className="ml-1">
                {burialCount}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="maintenance"
              className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <Wrench className="h-4 w-4" />
              Maintenance Requests
              <Badge variant="secondary" className="ml-1">
                {maintenanceCount}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="burial" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">Showing your burial requests.</div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fetchList("burial")}
                disabled={loading.burial}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            <RequestGrid
              type="burial"
              rows={burial}
              loading={loading.burial}
              onCancel={handleCancel}
            />
          </TabsContent>

          <TabsContent value="maintenance" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">Showing your maintenance requests.</div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fetchList("maintenance")}
                disabled={loading.maintenance}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            <RequestGrid
              type="maintenance"
              rows={maintenance}
              loading={loading.maintenance}
              onCancel={handleCancel}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================

   UI Pieces

============================================================================ */
function SkeletonCard() {
  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
      <CardHeader className="pb-2">
        <div className="h-4 w-40 animate-pulse rounded bg-gradient-to-r from-emerald-200 to-cyan-200" />
        <div className="mt-2 h-3 w-28 animate-pulse rounded bg-gradient-to-r from-slate-200 to-slate-300" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-gradient-to-r from-slate-200 to-slate-300" />
        <div className="h-10 w-full animate-pulse rounded bg-gradient-to-r from-slate-200 to-slate-300" />
        <div className="ml-auto h-8 w-24 animate-pulse rounded bg-gradient-to-r from-slate-200 to-slate-300" />
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  switch (status) {
    case "approved":
    case "confirmed":
      return (
        <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md">
          Approved
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md">
          Pending
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-md">
          Rejected
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-gradient-to-r from-slate-500 to-gray-500 text-white shadow-md">
          Cancelled
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md">
          Completed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="capitalize shadow-sm">
          {status || "unknown"}
        </Badge>
      );
  }
}

function statusIcon(status) {
  switch (status) {
    case "approved":
    case "confirmed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "pending":
      return <Clock className="h-4 w-4 text-amber-500" />;
    case "rejected":
      return <XCircle className="h-4 w-4 text-rose-600" />;
    case "cancelled":
      return <XCircle className="h-4 w-4 text-slate-500" />;
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-indigo-600" />;
    default:
      return <ClipboardList className="h-4 w-4 text-slate-500" />;
  }
}

function RequestGrid({ type, rows, loading, onCancel }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <Card className="border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader>
          <CardTitle className="text-base text-slate-700">No requests yet</CardTitle>
          <CardDescription className="text-slate-600">
            Submit a request and it will appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sorted = [...rows].sort((a, b) => {
    const sa = normStatus(a.status);
    const sb = normStatus(b.status);
    const ga = sa === "pending" ? 0 : 1;
    const gb = sb === "pending" ? 0 : 1;
    if (ga !== gb) return ga - gb;

    const ta = new Date(a.created_at || a.updated_at || 0).getTime();
    const tb = new Date(b.created_at || b.updated_at || 0).getTime();
    return tb - ta;
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {sorted.map((r) => {
        const id = r.id ?? r.request_id ?? r.reference_no ?? "-";
        const status = normStatus(r.status);

        const isClosed = status === "cancelled" || status === "rejected" || status === "completed";

        return (
          <Card
            key={`${type}-${id}`}
            className="relative overflow-hidden border-emerald-100/50 bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300"
          >
            <CardHeader className="relative pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base text-slate-900 font-semibold">
                    <span className="inline-flex items-center gap-2">
                      {statusIcon(status)}
                      <span className="truncate">Request #{id}</span>
                    </span>
                  </CardTitle>

                  <CardDescription className="mt-1 space-y-1 text-slate-600">
                    {type === "burial" ? (
                      <>
                        <div className="flex items-center gap-2">
                          <MessageSquareText className="h-4 w-4 text-slate-400" />
                          <span className="truncate">
                            Deceased:{" "}
                            <span className="font-medium text-slate-800">
                              {r.deceased_name ?? "—"}
                            </span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-slate-400" />
                          <span>
                            {fmtDateShort(pickBurialDate(r))}{" "}
                            <span className="text-slate-400">•</span>{" "}
                            {fmtTime(pickBurialTime(r))}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          <span className="truncate">Plot: {pickPlotLabel(r)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-slate-400" />
                          <span className="truncate">
                            Type:{" "}
                            <span className="font-medium text-slate-800">
                              {r.request_type || r.category || "—"}
                            </span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-slate-400" />
                          <span className="truncate">
                            Priority:{" "}
                            <span className="font-medium text-slate-800">
                              {r.priority || "—"}
                            </span>
                          </span>
                        </div>

                        {r.plot_code || r.plot_name || r.plot_id ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <span className="truncate">
                              Plot: {r.plot_code || r.plot_name || r.plot_id}
                            </span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </CardDescription>
                </div>

                <div className="shrink-0">
                  <StatusBadge status={status} />
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative space-y-3">
              <Separator className="bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />

              {r.notes || r.description ? (
                <div className="text-sm text-slate-700 whitespace-pre-wrap">
                  {r.notes || r.description}
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 shadow-md hover:shadow-lg transition-all hover:border-rose-300"
                  onClick={() => onCancel(type, id)}
                  disabled={isClosed || status === "approved" || status === "confirmed"}
                  title={isClosed ? "This request is already closed" : "Cancel this request"}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
