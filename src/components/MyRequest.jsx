import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { RefreshCcw, Search, Loader2, XCircle, Info } from "lucide-react";

// shadcn/ui
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "../../../components/ui/alert";
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
function getToken(auth) {
  return auth?.accessToken || auth?.token || auth?.jwt || "";
}

/* --------------------------- small debounce hook --------------------------- */
function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* --------------------------- fetch helper (fallback endpoints) --------------------------- */
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

      // allow fallback to other endpoints
      if (res.status === 404) {
        lastErr = new Error(
          typeof body === "string"
            ? body
            : body?.message || body?.error || `404 ${url}`
        );
        continue;
      }

      const m =
        typeof body === "string"
          ? body
          : body?.message || body?.error || `HTTP ${res.status}`;
      throw new Error(m);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("Request failed");
}

/* --------------------------- helpers --------------------------- */
const safeLower = (v) => String(v || "").toLowerCase();
const isTruthyStr = (v) => v != null && String(v).trim() !== "";

function extractArray(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.rows)) return body.rows;
  if (Array.isArray(body?.records)) return body.records;
  if (Array.isArray(body?.result)) return body.result;
  if (Array.isArray(body?.data?.rows)) return body.data.rows;
  if (Array.isArray(body?.data?.records)) return body.data.records;
  return [];
}

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(statusRaw) {
  const s = safeLower(statusRaw);
  if (s === "approved" || s === "completed")
    return { label: statusRaw || "Approved", cls: "bg-emerald-600 hover:bg-emerald-600" };
  if (s === "scheduled")
    return { label: "Scheduled", cls: "bg-sky-600 hover:bg-sky-600" };
  if (s === "pending")
    return { label: "Pending", cls: "bg-amber-500 hover:bg-amber-500" };
  if (s === "cancelled" || s === "canceled" || s === "rejected")
    return { label: statusRaw || "Cancelled", cls: "bg-rose-600 hover:bg-rose-600" };
  return { label: statusRaw || "—", cls: "bg-slate-600 hover:bg-slate-600" };
}

function typeBadge(kind) {
  const k = safeLower(kind);
  if (k === "reservation") return { label: "Reservation", cls: "bg-indigo-600 hover:bg-indigo-600" };
  if (k === "inquiry" || k === "inquire") return { label: "Inquiry", cls: "bg-fuchsia-600 hover:bg-fuchsia-600" };
  if (k === "maintenance") return { label: "Maintenance", cls: "bg-teal-600 hover:bg-teal-600" };
  if (k === "burial") return { label: "Burial", cls: "bg-emerald-700 hover:bg-emerald-700" };
  return { label: kind || "—", cls: "bg-slate-500 hover:bg-slate-500" };
}

function getPlotId(r) {
  return (
    r?.plot_id ??
    r?.plotId ??
    r?.grave_plot_id ??
    r?.plot?.id ??
    r?.plot ??
    null
  );
}

function getCreatedAt(r) {
  return (
    r?.created_at ??
    r?.createdAt ??
    r?.requested_at ??
    r?.requestedAt ??
    r?.date_created ??
    r?.updated_at ??
    r?.updatedAt ??
    null
  );
}

function getStatus(r) {
  return r?.status ?? r?.state ?? r?.request_status ?? r?.approval_status ?? "pending";
}

function getDeceasedName(r) {
  return (
    r?.deceased_name ??
    r?.person_full_name ??
    r?.personFullName ??
    r?.name ??
    r?.full_name ??
    null
  );
}

function getSummary(kind, r) {
  const k = safeLower(kind);
  if (k === "maintenance") return r?.description || "Maintenance request";
  if (k === "burial") return "Burial scheduling request";
  if (k === "reservation") return r?.remarks || r?.notes || "Plot reservation request";
  if (k === "inquiry" || k === "inquire") return r?.message || r?.remarks || "Inquiry";
  return "Request";
}

export default function MyRequests() {
  const navigate = useNavigate();

  const auth = useMemo(() => readAuth(), []);
  const currentUser = auth?.user || {};
  const token = getToken(auth);

  const role = String(currentUser?.role || "").toLowerCase();
  const isVisitorLoggedIn = !!token && role === "visitor" && !!currentUser?.id;

  const headersAuth = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // UI state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rows, setRows] = useState([]); // normalized combined list

  // filters
  const [qInput, setQInput] = useState("");
  const q = useDebouncedValue(qInput, 200);

  const [typeFilter, setTypeFilter] = useState("all"); // all | reservation | inquiry | maintenance | burial

  // details dialog
  const [open, setOpen] = useState(false);
  const [activeRow, setActiveRow] = useState(null);

  const loadAll = useCallback(async () => {
    if (!isVisitorLoggedIn) return;

    setLoading(true);
    setErr("");

    const uid = encodeURIComponent(String(currentUser.id));

    // ✅ Your Inquire.jsx already uses these maintenance + burial endpoints,
    // so we reuse the same patterns here.
    const endpoints = {
      maintenance: [
        `${API_BASE}/visitor/my-maintenance-schedule/${uid}`,
      ],
      burial: [
        `${API_BASE}/visitor/my-burial-requests/${uid}`,
        `${API_BASE}/visitor/burial-requests/${uid}`,
      ],

      // ⚠️ These two depend on your backend routes.
      // Add/adjust the endpoints to match your actual API.
      reservation: [
        `${API_BASE}/visitor/my-reservations/${uid}`,
        `${API_BASE}/visitor/reservations/${uid}`,
        `${API_BASE}/reservation/my/${uid}`,
      ],
      inquiry: [
        `${API_BASE}/visitor/my-inquiries/${uid}`,
        `${API_BASE}/visitor/inquiries/${uid}`,
        `${API_BASE}/inquire/my/${uid}`,
      ],
    };

    try {
      const results = await Promise.allSettled(
        Object.entries(endpoints).map(async ([kind, urls]) => {
          const { body } = await fetchFirstOk(urls, { headers: headersAuth });
          const list = extractArray(body);
          return { kind, list: Array.isArray(list) ? list : [] };
        })
      );

      const combined = [];

      for (const r of results) {
        if (r.status === "fulfilled") {
          const { kind, list } = r.value;

          list.forEach((item) => {
            combined.push({
              kind,
              id: item?.id ?? item?.uid ?? item?.request_id ?? item?.reservation_id ?? null,
              status: getStatus(item),
              created_at: getCreatedAt(item),
              plot_id: getPlotId(item),
              deceased_name: getDeceasedName(item),
              summary: getSummary(kind, item),
              raw: item,
            });
          });
        } else {
          // If an API isn't implemented yet, it might 404 — don't hard-fail the page.
          const msg = String(r.reason?.message || r.reason || "");
          // keep as warning only
          if (msg && !safeLower(msg).includes("404")) {
            setErr((prev) => prev || msg);
          }
        }
      }

      // newest first
      combined.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });

      setRows(combined);
    } catch (e) {
      setRows([]);
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [API_BASE, headersAuth, isVisitorLoggedIn, currentUser.id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();

    return (rows || [])
      .filter((r) => {
        if (typeFilter === "all") return true;
        return safeLower(r.kind) === safeLower(typeFilter);
      })
      .filter((r) => {
        if (!text) return true;
        const bag = [
          r.kind,
          r.id,
          r.status,
          r.plot_id,
          r.deceased_name,
          r.summary,
          r.created_at,
        ]
          .filter((v) => v != null)
          .map((v) => String(v).toLowerCase())
          .join(" ");
        return bag.includes(text);
      });
  }, [rows, q, typeFilter]);

  const counts = useMemo(() => {
    const c = { all: rows.length, reservation: 0, inquiry: 0, maintenance: 0, burial: 0 };
    rows.forEach((r) => {
      const k = safeLower(r.kind);
      if (c[k] != null) c[k] += 1;
    });
    return c;
  }, [rows]);

  const openDetails = (row) => {
    setActiveRow(row);
    setOpen(true);
  };

  const goToSourcePage = (row) => {
    const k = safeLower(row?.kind);
    if (k === "reservation") return navigate("/visitor/reservation");
    if (k === "maintenance") return navigate("/visitor/inquire?type=maintenance");
    if (k === "burial") return navigate("/visitor/inquire?type=burial");
    if (k === "inquiry" || k === "inquire") return navigate("/visitor/inquire");
    return;
  };

  const displayName = `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Requests</h1>
          <p className="text-sm text-muted-foreground">
            Reservations, inquiries, maintenance requests, and burial scheduling requests—combined in one place.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCcw className={["mr-2 h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
            Refresh
          </Button>
        </div>
      </div>

      {!isVisitorLoggedIn ? (
        <Alert variant="destructive" className="border-rose-200">
          <AlertTitle className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Not logged in
          </AlertTitle>
          <AlertDescription>
            Please login as a visitor to view your requests.
          </AlertDescription>
        </Alert>
      ) : null}

      {err ? (
        <Alert variant="destructive" className="border-rose-200">
          <AlertTitle className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Some requests failed to load
          </AlertTitle>
          <AlertDescription className="break-words">{err}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Search by type, status, plot id, deceased name…"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({counts.all})</SelectItem>
                  <SelectItem value="reservation">Reservation ({counts.reservation})</SelectItem>
                  <SelectItem value="inquiry">Inquiry ({counts.inquiry})</SelectItem>
                  <SelectItem value="maintenance">Maintenance ({counts.maintenance})</SelectItem>
                  <SelectItem value="burial">Burial ({counts.burial})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border bg-white/60 p-3">
              <div className="text-xs text-slate-500">Signed in</div>
              <div className="mt-1 font-semibold text-slate-900 truncate">
                {displayName || "Visitor"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Total requests: <span className="font-medium text-slate-700">{counts.all}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Requests</CardTitle>
          <CardDescription>
            Click “Details” to inspect the raw record. Use “Open page” to go to the source feature.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : !filtered.length ? (
            <div className="text-sm text-slate-600">
              No requests found.
              <div className="mt-2 text-xs text-slate-500">
                Tip: If Maintenance/Burial counts are 0, check if your backend endpoints exist and return data.
              </div>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Deceased / Summary</TableHead>
                    <TableHead>Plot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.map((r, idx) => {
                    const t = typeBadge(r.kind);
                    const s = statusBadge(r.status);
                    return (
                      <TableRow key={`${r.kind}-${r.id ?? idx}`}>
                        <TableCell>
                          <Badge className={t.cls}>{t.label}</Badge>
                        </TableCell>

                        <TableCell className="font-medium">
                          {r.id ?? "—"}
                        </TableCell>

                        <TableCell>
                          <div className="text-sm font-medium text-slate-900">
                            {r.deceased_name || "—"}
                          </div>
                          <div className="text-xs text-slate-600">
                            {r.summary || "—"}
                          </div>
                        </TableCell>

                        <TableCell className="text-sm">
                          {r.plot_id != null ? `#${String(r.plot_id)}` : "—"}
                        </TableCell>

                        <TableCell>
                          <Badge className={s.cls}>{s.label}</Badge>
                        </TableCell>

                        <TableCell className="text-sm">
                          {fmtDateTime(r.created_at)}
                        </TableCell>

                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => openDetails(r)}>
                            <Info className="mr-2 h-4 w-4" />
                            Details
                          </Button>
                          <Button size="sm" onClick={() => goToSourcePage(r)}>
                            Open page
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-slate-500">
        Quick links:{" "}
        <NavLink className="underline" to="/visitor/inquire">
          Requests (Inquire)
        </NavLink>{" "}
        •{" "}
        <NavLink className="underline" to="/visitor/reservation">
          Reservation
        </NavLink>
      </div>

      {/* Details Dialog */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setActiveRow(null);
        }}
      >
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>Raw record (for debugging)</DialogDescription>
          </DialogHeader>

          {activeRow ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="rounded-md border p-3 bg-white">
                  <div className="text-xs text-slate-500">Type</div>
                  <div className="font-medium">{activeRow.kind}</div>
                </div>
                <div className="rounded-md border p-3 bg-white">
                  <div className="text-xs text-slate-500">Status</div>
                  <div className="font-medium">{activeRow.status}</div>
                </div>
                <div className="rounded-md border p-3 bg-white">
                  <div className="text-xs text-slate-500">Plot</div>
                  <div className="font-medium">{activeRow.plot_id != null ? `#${activeRow.plot_id}` : "—"}</div>
                </div>
              </div>

              <div className="rounded-md border p-3 bg-white">
                <div className="text-xs text-slate-500 mb-2">JSON</div>
                <pre className="text-xs whitespace-pre-wrap break-words">
                  {JSON.stringify(activeRow.raw, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            {activeRow ? (
              <Button onClick={() => goToSourcePage(activeRow)}>
                Open page
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
