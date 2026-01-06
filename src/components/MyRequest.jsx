// frontend/src/components/MyRequest.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Alert, AlertDescription } from "./ui/alert";
import { ClipboardList, Wrench, CheckCircle2, Clock, XCircle, X, RefreshCw } from "lucide-react";


const API_BASE =
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
  return auth?.accessToken || auth?.token || auth?.jwt || "";
}

function getUserId(auth) {
  // IMPORTANT: backend expects the visitor user id for :family_contact
  return auth?.user?.id ?? auth?.user?.user_id ?? null;
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
  burialList: (id) => [
    `/visitor/my-burial-requests/${encodeURIComponent(id)}`,
    `/visitor/burial-requests/${encodeURIComponent(id)}`,
  ],
  maintenanceList: (id) => [
    `/visitor/my-maintenance-requests/${encodeURIComponent(id)}`,
    `/visitor/maintenance-requests/${encodeURIComponent(id)}`,
  ],
  cancelBurial: (id) => [
    `/visitor/request-burial/cancel/${encodeURIComponent(id)}`,
    `/visitor/burial-request/${encodeURIComponent(id)}/cancel`,
    `/visitor/cancel-burial-request/${encodeURIComponent(id)}`,
  ],
  cancelMaintenance: (id) => [
    `/visitor/request-maintenance/cancel/${encodeURIComponent(id)}`,
  ],
};

export default function MyRequest({ open, onOpenChange }) {
  const auth = useMemo(() => readAuth(), []);
  const token = useMemo(() => getToken(auth), [auth]);
  const requestOwnerId = useMemo(() => getUserId(auth), [auth]);

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
          ? PATHS.burialList(requestOwnerId).map((p) => `${API_BASE}${p}`)
          : PATHS.maintenanceList(requestOwnerId).map((p) => `${API_BASE}${p}`);

      setLoading((l) => ({ ...l, [which]: true }));
      setMsg({ type: "", text: "" });

      try {
        const { body } = await fetchFirstOk(urls, { headers });
        const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        setList(rows);
      } catch (err) {
        setMsg({ type: "error", text: err.message || "Unable to fetch requests." });
        setList([]);
      } finally {
        setLoading((l) => ({ ...l, [which]: false }));
      }
    },
    [requestOwnerId, token, headers]
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

    setList((rows) =>
      rows.map((r) =>
        String(r.id ?? r.request_id) === String(id)
          ? { ...r, status: which === "burial" ? "canceled" : "cancelled" }
          : r
      )
    );

    try {
      const urls =
        which === "burial"
          ? PATHS.cancelBurial(id).map((p) => `${API_BASE}${p}`)
          : PATHS.cancelMaintenance(id).map((p) => `${API_BASE}${p}`);

      await fetchFirstOk(urls, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ reason: "user-cancelled" }),
      });

      setMsg({ type: "ok", text: "Request cancelled." });
      setTimeout(() => {
        setMsg((m) => (m.type === "ok" ? { type: "", text: "" } : m));
      }, 2500);

      fetchList(which);
    } catch (err) {
      setList(original);
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
            <TabsTrigger value="burial" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <ClipboardList className="h-4 w-4" /> Burial Requests
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <Wrench className="h-4 w-4" /> Maintenance Requests
            </TabsTrigger>
          </TabsList>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function normStatus(s) {
  const v = String(s || "pending").toLowerCase();
  if (v === "canceled") return "cancelled";
  return v;
}

// keep your existing helpers and components below,
// update disable checks to include both spellings

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

  const sorted = [...rows].sort((a, b) => {
    const sa = normStatus(a.status);
    const sb = normStatus(b.status);
    const ga = sa === "pending" ? 0 : 1;
    const gb = sb === "pending" ? 0 : 1;
    if (ga !== gb) return ga - gb;
    return (new Date(b.created_at || b.updated_at || 0)).getTime() - (new Date(a.created_at || a.updated_at || 0)).getTime();
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {sorted.map((r) => {
        const id = r.id ?? r.request_id ?? r.reference_no ?? "-";
        const status = normStatus(r.status);

        return (
          <Card key={`${type}-${id}`} className="relative overflow-hidden border-emerald-100/50 bg-white/80 backdrop-blur hover:shadow-lg transition-all duration-300">
            <CardHeader className="relative pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900 font-semibold">Request ID: {id}</CardTitle>
                  <CardDescription className="mt-1 space-y-1 text-slate-600">
                    <div>Deceased Name: <span className="font-medium text-foreground">{r.deceased_name ?? "—"}</span></div>
                  </CardDescription>
                </div>
                <StatusBadge status={status} />
              </div>
            </CardHeader>

            <CardContent className="relative space-y-3">
              <Separator className="bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
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
