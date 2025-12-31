// frontend/src/components/MyRequest.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
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
} from "lucide-react";

// 🔧 Base URL
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

// Endpoints
const PATHS = {
  burialList: (id) => `/visitor/my-burial-requests/${encodeURIComponent(id)}`,
  maintenanceList: (id) => `/visitor/my-maintenance-requests/${encodeURIComponent(id)}`,
  cancelBurial: (id) => `/visitor/request-burial/cancel/${encodeURIComponent(id)}`,
  cancelMaintenance: (id) => `/request-maintenance/cancel/${encodeURIComponent(id)}`,
};

export default function MyRequest({ open, onOpenChange }) {
  // read auth once per render
  const authRaw = typeof window !== "undefined" ? localStorage.getItem("auth") : null;
  const auth = useMemo(() => {
    try {
      return authRaw ? JSON.parse(authRaw) : null;
    } catch {
      return null;
    }
  }, [authRaw]);

  // stable id to use for requests
  const requestOwnerId = useMemo(
    () =>
      auth?.user?.id ??
      auth?.user?.user_id ??
      auth?.user?.phone ??
      auth?.user?.family_contact ??
      null,
    [auth]
  );

  // stable headers
  const headers = useMemo(
    () => ({
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    }),
    [auth?.token]
  );

  const [tab, setTab] = useState("burial");
  const [burial, setBurial] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState({ burial: false, maintenance: false });
  const [msg, setMsg] = useState({ type: "", text: "" });

  // ---- fetch lists (stable deps) ----
  const fetchList = useCallback(
    async (which) => {
      if (!requestOwnerId) {
        setMsg({ type: "error", text: "Missing user identifier for requests." });
        return;
      }

      const setList = which === "burial" ? setBurial : setMaintenance;
      const url =
        which === "burial"
          ? `${API_BASE}${PATHS.burialList(requestOwnerId)}`
          : `${API_BASE}${PATHS.maintenanceList(requestOwnerId)}`;

      setLoading((l) => ({ ...l, [which]: true }));
      setMsg({ type: "", text: "" });

      try {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Failed to load ${which} requests (${res.status})`);
        const json = await res.json().catch(() => ({}));
        const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        setList(rows);
      } catch (err) {
        setMsg({ type: "error", text: err.message || "Unable to fetch requests." });
      } finally {
        setLoading((l) => ({ ...l, [which]: false }));
      }
    },
    [requestOwnerId, headers]
  );

  // load on open
  useEffect(() => {
    if (!open) return;
    fetchList("burial");
    fetchList("maintenance");
  }, [open, fetchList]);

  // ---- cancel request (per type) ----
  async function handleCancel(which, id) {
    setMsg({ type: "", text: "" });
    const list = which === "burial" ? burial : maintenance;
    const setList = which === "burial" ? setBurial : setMaintenance;

    // optimistic update
    const original = [...list];
    setList((rows) =>
      rows.map((r) =>
        String(r.id ?? r.request_id) === String(id) ? { ...r, status: "cancelled" } : r
      )
    );

    try {
      const url =
        which === "burial"
          ? `${API_BASE}${PATHS.cancelBurial(id)}`
          : `${API_BASE}${PATHS.cancelMaintenance(id)}`;

      const res = await fetch(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ reason: "user-cancelled" }),
      });
      if (!res.ok) throw new Error(`Cancel failed (${res.status})`);

      setMsg({ type: "ok", text: "Request cancelled." });
      setTimeout(() => {
        setMsg((m) => (m.type === "ok" ? { type: "", text: "" } : m));
      }, 2500);
    } catch (err) {
      setList(original); // revert
      setMsg({ type: "error", text: err.message || "Unable to cancel the request." });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl bg-white/90 backdrop-blur border-white/60 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
            My Requests
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Track your submitted requests and next steps.
          </DialogDescription>
        </DialogHeader>

        {/* Alert */}
        {msg.text ? (
          <Alert
            variant={msg.type === "error" ? "destructive" : "default"}
            className={msg.type === "error" ? "mb-3 bg-rose-50/90 backdrop-blur border-rose-200 shadow-md" : "mb-3 border-emerald-200 bg-emerald-50/90 backdrop-blur text-emerald-700 shadow-md"}
          >
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gradient-to-br from-emerald-50/80 to-cyan-50/80 backdrop-blur border border-emerald-100 shadow-md">
            <TabsTrigger value="burial" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <ClipboardList className="h-4 w-4" /> Burial Requests
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <Wrench className="h-4 w-4" /> Maintenance Requests
            </TabsTrigger>
          </TabsList>

          <TabsContent value="burial" className="mt-4">
            <SectionHeader
              title="Burial Requests"
              description="Requests related to burial scheduling and verification."
              onRefresh={() => fetchList("burial")}
              loading={loading.burial}
            />
            <RequestGrid type="burial" rows={burial} loading={loading.burial} onCancel={handleCancel} />
          </TabsContent>

          <TabsContent value="maintenance" className="mt-4">
            <SectionHeader
              title="Maintenance Requests"
              description="Requests for plot or grounds maintenance."
              onRefresh={() => fetchList("maintenance")}
              loading={loading.maintenance}
            />
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

/* ---------- helpers for status + sorting + formatting ---------- */
function normStatus(s) {
  return String(s || "pending").toLowerCase();
}

function pickTimestamp(row) {
  const candidates = [
    row.created_at,
    row.submitted_at,
    row.request_date,
    row.updated_at,
    row.date,
    row.created,
  ];
  for (const v of candidates) {
    const t = v ? new Date(v).getTime() : NaN;
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function formatDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/* ---------- Subcomponents ---------- */

function SectionHeader({ title, description, onRefresh, loading }) {
  return (
    <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
      <div>
        <h3 className="text-base font-semibold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">{title}</h3>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="shadow-md hover:shadow-lg transition-all">
        {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        Refresh
      </Button>
    </div>
  );
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
          <CardDescription className="text-slate-600">Submit a request and it will appear here.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Sort: pending first, then others; newest first within each group
  const sorted = [...rows].sort((a, b) => {
    const sa = normStatus(a.status);
    const sb = normStatus(b.status);
    const ga = sa === "pending" ? 0 : 1;
    const gb = sb === "pending" ? 0 : 1;
    if (ga !== gb) return ga - gb;
    return pickTimestamp(b) - pickTimestamp(a);
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {sorted.map((r) => {
        const id = r.id ?? r.request_id ?? r.reference_no ?? "-";
        const deceased = r.deceased_name ?? r.deceased ?? r.name ?? "—";
        const status = normStatus(r.status);

        // new lines for details
        const createdAt = r.created_at ?? r.submitted_at ?? r.request_date ?? r.date ?? null;
        const burialDate = r.burial_date ?? r.burialDate ?? null;

        const nextStep =
          status === "approved"
            ? type === "burial"
              ? "Next Step: Proceed to office and submit required documents."
              : "Next Step: Proceed to office and submit payment."
            : null;

        return (
          <div key={`${type}-${id}`} className="relative group">
            {/* backdrop shadow */}
            <div className="absolute -inset-1 bg-gradient-to-br from-emerald-400/15 via-cyan-400/10 to-blue-400/15 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            <Card className="relative overflow-hidden border-emerald-100/50 bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
              {/* subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-cyan-400/5"></div>

              <CardHeader className="relative pb-2">
                <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900 font-semibold">Request ID: {id}</CardTitle>

                  <CardDescription className="mt-1 space-y-1 text-slate-600">
                    <div>
                      Deceased Name:{" "}
                      <span className="font-medium text-foreground">{deceased}</span>
                    </div>

                    {type === "burial" && (
                      <>
                        <div>
                          Burial Date:{" "}
                          <span className="font-medium text-foreground">
                            {formatDate(burialDate)}
                          </span>
                        </div>
                        <div>
                          Requested on:{" "}
                          <span className="font-medium text-foreground">
                            {formatDate(createdAt)}
                          </span>
                        </div>
                      </>
                    )}

                    {type === "maintenance" && (
                      <div>
                        Requested on:{" "}
                        <span className="font-medium text-foreground">
                          {formatDate(createdAt)}
                        </span>
                      </div>
                    )}
                  </CardDescription>
                </div>
                <StatusBadge status={status} />
              </div>
            </CardHeader>

            <CardContent className="relative space-y-3">
              <Separator className="bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
              <div className="text-sm">
                <div className="mb-1 font-medium text-slate-900">Status</div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  {statusIcon(status)}
                  <span className="capitalize font-medium">{status}</span>
                </div>
              </div>

              {nextStep ? (
                <div className="rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-3 text-sm text-amber-800 font-medium shadow-sm">
                  {nextStep}
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 shadow-md hover:shadow-lg transition-all hover:border-rose-300"
                  onClick={() => onCancel(type, id)}
                  disabled={status === "cancelled" || status === "rejected"}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        );
      })}
    </div>
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
        <div className="ml-auto h-8 w-24 animate-pulse rounded bg-gradient-to-r from-slate-200 to-slate-300" />
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  switch (status) {
    case "approved":
      return <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-md">Approved</Badge>;
    case "pending":
      return <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md">Pending</Badge>;
    case "rejected":
      return <Badge className="bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white shadow-md">Rejected</Badge>;
    case "cancelled":
      return <Badge className="bg-gradient-to-r from-slate-500 to-gray-500 hover:from-slate-600 hover:to-gray-600 text-white shadow-md">Cancelled</Badge>;
    default:
      return (
        <Badge variant="secondary" className="capitalize shadow-sm">
          {status}
        </Badge>
      );
  }
}

function statusIcon(status) {
  switch (status) {
    case "approved":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "pending":
      return <Clock className="h-4 w-4 text-amber-500" />;
    case "rejected":
      return <XCircle className="h-4 w-4 text-rose-600" />;
    case "cancelled":
      return <XCircle className="h-4 w-4 text-slate-500" />;
    default:
      return <ClipboardList className="h-4 w-4 text-muted-foreground" />;
  }
}
