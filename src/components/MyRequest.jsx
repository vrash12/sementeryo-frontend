import React, { useCallback, useEffect, useMemo, useState } from "react";

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
  FileText,
  UserRound,
} from "lucide-react";

const RAW_API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

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
  return auth?.accessToken || auth?.token || auth?.jwt || auth?.access_token || "";
}

function getUserId(auth) {
  const id =
    auth?.user?.id ??
    auth?.user?.user_id ??
    auth?.user?.userId ??
    auth?.id ??
    auth?.user_id ??
    auth?.userId ??
    null;

  if (typeof id === "string" && id.trim() !== "" && !Number.isNaN(Number(id))) return Number(id);
  return id;
}

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

const PATHS = {
  burialList: (userId) => [
    `/visitor/my-burial-requests/${encodeURIComponent(userId)}`,
    `/visitor/burial-requests/${encodeURIComponent(userId)}`,
  ],
  maintenanceList: (userId) => [
    `/visitor/my-maintenance-schedule/${encodeURIComponent(userId)}`,
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
  if (v === "confirmed") return "completed";
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

function pickBurialDate(r) {
  return r?.scheduled_date || r?.burial_date || r?.service_date || r?.date || null;
}
function pickBurialTime(r) {
  return r?.scheduled_time || r?.burial_time || r?.service_time || r?.time || null;
}
function pickPlotLabel(r) {
  return r?.plot_code || r?.plot_name || r?.plot_uid || r?.plot_id || "—";
}
function pickRequestNote(r) {
  return r?.notes || r?.description || r?.remarks || "";
}
function pickRequestedOn(r) {
  return r?.created_at || r?.requested_at || r?.updated_at || null;
}

function burialGroups(rows) {
  const grouped = {
    pending: [],
    approved: [],
    completed: [],
    cancelled: [],
    rejected: [],
    other: [],
  };

  for (const row of rows || []) {
    const s = normStatus(row?.status);
    if (grouped[s]) grouped[s].push(row);
    else grouped.other.push(row);
  }

  const sortByNewest = (arr) =>
    [...arr].sort((a, b) => {
      const ta = new Date(pickRequestedOn(a) || 0).getTime();
      const tb = new Date(pickRequestedOn(b) || 0).getTime();
      return tb - ta;
    });

  return [
    { key: "pending", title: "Pending", rows: sortByNewest(grouped.pending) },
    { key: "approved", title: "Approved", rows: sortByNewest(grouped.approved) },
    { key: "completed", title: "Completed", rows: sortByNewest(grouped.completed) },
    { key: "cancelled", title: "Cancelled", rows: sortByNewest(grouped.cancelled) },
    { key: "rejected", title: "Rejected", rows: sortByNewest(grouped.rejected) },
    { key: "other", title: "Other", rows: sortByNewest(grouped.other) },
  ].filter((g) => g.rows.length);
}

export default function MyRequest({ open: openProp, onOpenChange: onOpenChangeProp }) {
  const [internalOpen, setInternalOpen] = useState(true);
  const open = openProp ?? internalOpen;
  const onOpenChange = onOpenChangeProp ?? setInternalOpen;

  const [auth, setAuth] = useState(() => readAuth());
  const [authReady, setAuthReady] = useState(false);

  const refreshAuth = useCallback(() => {
    setAuth(readAuth());
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (!e.key || e.key === "auth") setAuth(readAuth());
    };
    const onAuthChanged = () => setAuth(readAuth());

    window.addEventListener("storage", onStorage);
    window.addEventListener("auth:changed", onAuthChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth:changed", onAuthChanged);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setAuthReady(false);
      return;
    }
    refreshAuth();
    setAuthReady(true);
  }, [open, refreshAuth]);

  const token = useMemo(() => getToken(auth), [auth]);
  const requestOwnerId = useMemo(() => getUserId(auth), [auth]);

  const API_BASES = useMemo(() => {
    const b = String(RAW_API_BASE || "").replace(/\/+$/, "");
    const candidates = [];
    if (b) candidates.push(b);
    if (b && !/\/api$/i.test(b)) candidates.push(`${b}/api`);
    candidates.push("/api");
    candidates.push("");
    return [...new Set(candidates)];
  }, []);

  const expandUrls = useCallback(
    (paths) => paths.flatMap((p) => API_BASES.map((base) => `${base}${p}`)),
    [API_BASES]
  );

  const [tab, setTab] = useState("burial");
  const [burial, setBurial] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState({ burial: false, maintenance: false });
  const [msg, setMsg] = useState({ type: "", text: "" });

  const ensureFreshAuthOrShowError = useCallback(() => {
    const latest = readAuth();
    const latestToken = getToken(latest);
    const latestId = getUserId(latest);

    if (!latestId) {
      setMsg({ type: "error", text: "Missing user id. Please login again." });
      return { ok: false, token: "", id: null };
    }
    if (!latestToken) {
      setMsg({ type: "error", text: "Missing token. Please login again." });
      return { ok: false, token: "", id: latestId };
    }

    if (latest) setAuth(latest);
    return { ok: true, token: latestToken, id: latestId };
  }, []);

  const fetchList = useCallback(
    async (which) => {
      const checked = ensureFreshAuthOrShowError();
      if (!checked.ok) return;

      const setList = which === "burial" ? setBurial : setMaintenance;

      const urls =
        which === "burial"
          ? expandUrls(PATHS.burialList(checked.id))
          : expandUrls(PATHS.maintenanceList(checked.id));

      setLoading((l) => ({ ...l, [which]: true }));
      setMsg((m) => (m.type === "error" ? { type: "", text: "" } : m));

      try {
        const reqHeaders = {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${checked.token}`,
        };

        const { body } = await fetchFirstOk(urls, { headers: reqHeaders });
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
    [ensureFreshAuthOrShowError, expandUrls]
  );

  useEffect(() => {
    if (!open || !authReady) return;
    if (!token || !requestOwnerId) {
      setMsg({ type: "error", text: "Please login again." });
      return;
    }

    fetchList("burial");
    fetchList("maintenance");
  }, [open, authReady, token, requestOwnerId, fetchList]);

  async function handleCancel(which, id) {
    setMsg({ type: "", text: "" });

    const list = which === "burial" ? burial : maintenance;
    const setList = which === "burial" ? setBurial : setMaintenance;
    const original = [...list];

    setList((rows) =>
      rows.map((r) =>
        String(r.id ?? r.request_id ?? r.reference_no) === String(id)
          ? { ...r, status: "cancelled" }
          : r
      )
    );

    try {
      const checked = ensureFreshAuthOrShowError();
      if (!checked.ok) throw new Error("Not authenticated");

      const urls =
        which === "burial"
          ? expandUrls(PATHS.cancelBurial(id))
          : expandUrls(PATHS.cancelMaintenance(id));

      const reqHeaders = {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${checked.token}`,
      };

      try {
        await fetchFirstOk(urls, {
          method: "PATCH",
          headers: reqHeaders,
          body: JSON.stringify({ reason: "user-cancelled" }),
        });
      } catch {
        await fetchFirstOk(urls, {
          method: "POST",
          headers: reqHeaders,
          body: JSON.stringify({ reason: "user-cancelled" }),
        });
      }

      setMsg({ type: "ok", text: "Request cancelled." });
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
      <DialogContent className="sm:max-w-5xl bg-white/90 backdrop-blur border-white/60 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
            My Requests
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Track pending, completed, and cancelled requests with request dates and details.
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
              <div className="text-sm text-slate-600">
                Showing completed, pending, and cancelled burial requests with request dates and person details.
              </div>
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

            <BurialRequestSections rows={burial} loading={loading.burial} onCancel={handleCancel} />
          </TabsContent>

          <TabsContent value="maintenance" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing maintenance requests and their corresponding request notes.
              </div>
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

            <MaintenanceRequestGrid
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
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  const normalized = normStatus(status);
  switch (normalized) {
    case "approved":
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
          {normalized || "unknown"}
        </Badge>
      );
  }
}

function statusIcon(status) {
  switch (normStatus(status)) {
    case "approved":
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

function SectionTitle({ title, count }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-white/60 px-3 py-2">
      <div className="font-semibold text-slate-900">{title}</div>
      <Badge variant="outline">{count}</Badge>
    </div>
  );
}

function BurialRequestSections({ rows, loading, onCancel }) {
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
          <CardTitle className="text-base text-slate-700">No burial requests yet</CardTitle>
          <CardDescription className="text-slate-600">
            Submit a burial request and it will appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sections = burialGroups(rows);

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.key} className="space-y-3">
          <SectionTitle title={section.title} count={section.rows.length} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {section.rows.map((r) => {
              const id = r.id ?? r.request_id ?? r.reference_no ?? "-";
              const status = normStatus(r.status);
              const isClosed = ["cancelled", "rejected", "completed"].includes(status);

              return (
                <Card
                  key={`burial-${id}`}
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
                          <div className="flex items-center gap-2">
                            <UserRound className="h-4 w-4 text-slate-400" />
                            <span className="truncate">
                              Person requested:{" "}
                              <span className="font-medium text-slate-800">
                                {r.deceased_name ?? "—"}
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-slate-400" />
                            <span>
                              Requested on: {fmtDateShort(pickRequestedOn(r))}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-slate-400" />
                            <span>
                              Burial date: {fmtDateShort(pickBurialDate(r))} • {fmtTime(pickBurialTime(r))}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <span className="truncate">Plot: {pickPlotLabel(r)}</span>
                          </div>
                        </CardDescription>
                      </div>

                      <div className="shrink-0">
                        <StatusBadge status={status} />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="relative space-y-3">
                    <Separator className="bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />

                    <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-3">
                      <div className="rounded-xl border bg-white/60 p-2">
                        <div className="text-xs text-slate-500">Birth date</div>
                        <div className="font-medium">{fmtDateShort(r.birth_date)}</div>
                      </div>
                      <div className="rounded-xl border bg-white/60 p-2">
                        <div className="text-xs text-slate-500">Death date</div>
                        <div className="font-medium">{fmtDateShort(r.death_date)}</div>
                      </div>
                      <div className="rounded-xl border bg-white/60 p-2">
                        <div className="text-xs text-slate-500">Burial date</div>
                        <div className="font-medium">{fmtDateShort(r.burial_date)}</div>
                      </div>
                    </div>

                    {r.death_certificate_url ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-700">
                        <FileText className="h-4 w-4" />
                        Death certificate uploaded
                      </div>
                    ) : null}

                    {pickRequestNote(r) ? (
                      <div className="text-sm text-slate-700 whitespace-pre-wrap">
                        {pickRequestNote(r)}
                      </div>
                    ) : null}

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 shadow-md hover:shadow-lg transition-all hover:border-rose-300"
                        onClick={() => onCancel("burial", id)}
                        disabled={isClosed || status === "approved"}
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
        </div>
      ))}
    </div>
  );
}

function MaintenanceRequestGrid({ rows, loading, onCancel }) {
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
          <CardTitle className="text-base text-slate-700">No maintenance requests yet</CardTitle>
          <CardDescription className="text-slate-600">
            Submit a maintenance request and it will appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(pickRequestedOn(a) || 0).getTime();
    const tb = new Date(pickRequestedOn(b) || 0).getTime();
    return tb - ta;
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {sorted.map((r) => {
        const id = r.id ?? r.request_id ?? r.reference_no ?? "-";
        const status = normStatus(r.status);
        const isClosed = ["cancelled", "rejected", "completed"].includes(status);

        return (
          <Card
            key={`maintenance-${id}`}
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
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      <span className="truncate">
                        Person requested:{" "}
                        <span className="font-medium text-slate-800">
                          {r.deceased_name || "—"}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      <span>
                        Requested on: {fmtDateShort(pickRequestedOn(r))}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-slate-400" />
                      <span className="truncate">
                        Priority: <span className="font-medium text-slate-800">{r.priority || "—"}</span>
                      </span>
                    </div>

                    {(r.plot_code || r.plot_name || r.plot_id) ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="truncate">
                          Plot: {r.plot_code || r.plot_name || r.plot_id}
                        </span>
                      </div>
                    ) : null}
                  </CardDescription>
                </div>

                <div className="shrink-0">
                  <StatusBadge status={status} />
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative space-y-3">
              <Separator className="bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />

              <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <div className="rounded-xl border bg-white/60 p-2">
                  <div className="text-xs text-slate-500">Preferred date</div>
                  <div className="font-medium">{fmtDateShort(r.preferred_date)}</div>
                </div>
                <div className="rounded-xl border bg-white/60 p-2">
                  <div className="text-xs text-slate-500">Preferred time</div>
                  <div className="font-medium">{fmtTime(r.preferred_time)}</div>
                </div>
              </div>

              {pickRequestNote(r) ? (
                <div className="text-sm text-slate-700 whitespace-pre-wrap">
                  {pickRequestNote(r)}
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 shadow-md hover:shadow-lg transition-all hover:border-rose-300"
                  onClick={() => onCancel("maintenance", id)}
                  disabled={isClosed || status === "approved"}
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
