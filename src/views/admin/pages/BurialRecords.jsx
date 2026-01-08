// frontend/src/views/admin/pages/BurialRecords.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuth } from "../../../utils/auth";
import { Toaster } from "sonner";

import { RefreshCcw, Search, Loader2, XCircle, MapPin, Info } from "lucide-react";

// shadcn/ui
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "../../../components/ui/alert";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../../components/ui/select";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "/api";

/* ---------------- small debounce hook ---------------- */
function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ---------------- utils ---------------- */
function formatDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function extractList(body) {
  if (Array.isArray(body)) return body;

  const candidates = [
    body?.data,
    body?.data?.rows,
    body?.data?.records,
    body?.records,
    body?.rows,
    body?.result,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function extractPlotRows(body) {
  // GeoJSON FeatureCollection
  if (body?.type === "FeatureCollection" && Array.isArray(body?.features)) {
    return body.features.map((f) => ({
      ...(f?.properties || {}),
      geometry: f?.geometry || null,
    }));
  }

  // plain array or wrapped array
  if (Array.isArray(body)) return body;

  const arr = extractList(body);
  if (Array.isArray(arr) && arr.length) return arr;

  return [];
}

function isTruthyStr(v) {
  return v != null && String(v).trim() !== "";
}

function statusBadgeProps(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "available")
    return { label: "Available", className: "bg-emerald-600 hover:bg-emerald-600" };
  if (s === "reserved")
    return { label: "Reserved", className: "bg-amber-500 hover:bg-amber-500" };
  if (s === "occupied")
    return { label: "Occupied", className: "bg-rose-600 hover:bg-rose-600" };
  return { label: statusRaw || "—", className: "bg-slate-500 hover:bg-slate-500" };
}

const safeLower = (v) => String(v || "").toLowerCase();

export default function BurialRecords() {
  const auth = getAuth();
  const token = auth?.token;

  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const ENDPOINTS = useMemo(
    () => ({
      listPlots: `${API_BASE}/plot/`,
      plotDetails: (idOrUid) => `${API_BASE}/admin/plot/${encodeURIComponent(idOrUid)}`,
    }),
    []
  );

  // data state
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // search
  const [qInput, setQInput] = useState("");
  const q = useDebouncedValue(qInput, 180);

  // NEW: filters for deceased list
  const [deceasedOnly, setDeceasedOnly] = useState(true); // ✅ default ON
  const [statusFilter, setStatusFilter] = useState("occupied"); // ✅ default occupied

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // details modal
  const [open, setOpen] = useState(false);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsErr, setDetailsErr] = useState("");
  const [details, setDetails] = useState(null);

  /* ---------------- API helpers ---------------- */
  const fetchAny = useCallback(
    async (url, opts = {}) => {
      const res = await fetch(url, {
        ...opts,
        headers: {
          ...authHeader,
          Accept: "application/json",
          ...(opts.headers || {}),
        },
      });

      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();

      if (!res.ok) {
        const msg =
          typeof body === "string" ? body : body?.error || body?.message || JSON.stringify(body);
        throw new Error(msg || `HTTP ${res.status}`);
      }

      return body;
    },
    [authHeader]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const body = await fetchAny(ENDPOINTS.listPlots);
      const list = extractPlotRows(body);

      // ✅ always keep data consistent
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      setRows([]);
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [ENDPOINTS.listPlots, fetchAny]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------- filters ---------------- */
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();

    return (rows || [])
      .filter((r) => {
        // ✅ deceased list filter (plots.person_full_name)
        if (deceasedOnly && !isTruthyStr(r?.person_full_name)) return false;

        // ✅ status filter
        const s = safeLower(r?.status);
        if (statusFilter !== "all" && s !== safeLower(statusFilter)) return false;

        return true;
      })
      .filter((r) => {
        if (!text) return true;

        const bag = [
          r?.id,
          r?.uid,
          r?.plot_name,
          r?.plot_code,
          r?.plot_type,
          r?.status,
          r?.person_full_name,
          r?.date_of_birth,
          r?.date_of_death,
          r?.next_of_kin_name,
          r?.contact_phone,
          r?.contact_email,
          r?.notes,
        ]
          .filter((v) => v != null)
          .map((v) => String(v).toLowerCase())
          .join(" ");

        return bag.includes(text);
      });
  }, [rows, q, deceasedOnly, statusFilter]);

  // reset to page 1 when filters/search changes
  useEffect(() => {
    setPage(1);
  }, [q, pageSize, deceasedOnly, statusFilter]);

  const totalPages = useMemo(() => {
    const n = Math.ceil((filtered?.length || 0) / pageSize);
    return n > 0 ? n : 1;
  }, [filtered, pageSize]);

  useEffect(() => {
    setPage((p) => {
      if (p < 1) return 1;
      if (p > totalPages) return totalPages;
      return p;
    });
  }, [totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return (filtered || []).slice(start, end);
  }, [filtered, page, pageSize]);

  const showingRange = useMemo(() => {
    const total = filtered.length;
    if (!total) return { from: 0, to: 0, total: 0 };
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return { from, to, total };
  }, [filtered.length, page, pageSize]);

  /* ---------------- actions ---------------- */
  const openDetails = useCallback(
    async (row) => {
      const idOrUid = row?.id ?? row?.uid;
      if (!idOrUid) return;

      setOpen(true);
      setDetails(null);
      setDetailsErr("");
      setDetailsBusy(true);

      try {
        const body = await fetchAny(ENDPOINTS.plotDetails(idOrUid));
        setDetails(body);
      } catch (e) {
        setDetailsErr(String(e?.message || e));
      } finally {
        setDetailsBusy(false);
      }
    },
    [ENDPOINTS, fetchAny]
  );

  return (
    <div className="p-6 space-y-6">
      <Toaster richColors expand={false} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Burial Records (from Plots)</h1>
          <p className="text-sm text-muted-foreground">
            This list is taken from plots.person_full_name (deceased), not from graves table.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading} title="Refresh">
            <RefreshCcw className={["mr-2 h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
            Refresh
          </Button>
        </div>
      </div>

      {err ? (
        <Alert variant="destructive" className="border-rose-200">
          <AlertTitle className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Failed to load plots
          </AlertTitle>
          <AlertDescription className="break-words">{err}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
            <div className="space-y-1">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Search by deceased name, plot name, id, uid, status…"
                  className="pl-9 w-[520px] max-w-full"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 justify-between lg:justify-end">
              <div className="min-w-[180px]">
                <Label className="text-xs text-slate-500">Show</Label>
                <Select value={deceasedOnly ? "deceased" : "all"} onValueChange={(v) => setDeceasedOnly(v === "deceased")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deceased">Deceased only</SelectItem>
                    <SelectItem value="all">All plots</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[180px]">
                <Label className="text-xs text-slate-500">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[160px]">
                <Label className="text-xs text-slate-500">Rows per page</Label>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Rows" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-slate-600">
                {showingRange.total ? (
                  <>
                    Showing <span className="font-medium">{showingRange.from}</span>–
                    <span className="font-medium">{showingRange.to}</span> of{" "}
                    <span className="font-medium">{showingRange.total}</span>
                  </>
                ) : (
                  <>Showing 0 of 0</>
                )}
              </div>
            </div>
          </div>

          {/* Pagination controls */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-500">
              Page <span className="font-medium">{page}</span> of{" "}
              <span className="font-medium">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage(1)} disabled={page <= 1}>
                First
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Deceased list in plots</CardTitle>
      
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : !filtered.length ? (
            <div className="text-sm text-slate-600">
              No rows found. 
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plot ID</TableHead>
                    <TableHead>Plot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deceased (person_full_name)</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>DOD</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paged.map((r) => {
                    const idOrUid = r?.id ?? r?.uid ?? Math.random();
                    const s = statusBadgeProps(r?.status);

                    return (
                      <TableRow key={String(idOrUid)}>
                        <TableCell className="font-medium">
                          {r?.id ?? "—"}
                          {r?.uid ? (
                            <div className="text-xs text-slate-500">uid: {String(r.uid)}</div>
                          ) : null}
                        </TableCell>

                        <TableCell>
                          <div className="text-sm font-medium text-slate-900">
                            {r?.plot_name ?? r?.plot_code ?? "—"}
                          </div>
                          {isTruthyStr(r?.uid) ? (
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              plot_uid: {String(r.uid)}
                            </div>
                          ) : null}
                        </TableCell>

                        <TableCell>
                          <Badge className={s.className}>{s.label}</Badge>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm font-medium text-slate-900">
                            {r?.person_full_name ?? "—"}
                          </div>
                        </TableCell>

                        <TableCell className="text-sm">{formatDate(r?.date_of_birth)}</TableCell>
                        <TableCell className="text-sm">{formatDate(r?.date_of_death)}</TableCell>

                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openDetails(r)}>
                            <Info className="mr-2 h-4 w-4" />
                            Details
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

      {/* Details Modal */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setDetails(null);
            setDetailsErr("");
            setDetailsBusy(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[860px] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Plot Details</DialogTitle>
            <DialogDescription>Information loaded from /api/admin/plot/:id</DialogDescription>
          </DialogHeader>

          {detailsErr ? (
            <Alert variant="destructive" className="border-rose-200">
              <AlertTitle className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Failed to load details
              </AlertTitle>
              <AlertDescription className="break-words">{detailsErr}</AlertDescription>
            </Alert>
          ) : null}

          {detailsBusy ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading details…
            </div>
          ) : details ? (
            <div className="text-sm space-y-2">
              <div className="rounded-md border p-3 bg-white">
                <div className="text-xs text-slate-500">Person Full Name</div>
                <div className="font-medium">{details.person_full_name ?? "—"}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-md border p-3 bg-white">
                  <div className="text-xs text-slate-500">Date of Birth</div>
                  <div className="font-medium">{formatDate(details.date_of_birth)}</div>
                </div>
                <div className="rounded-md border p-3 bg-white">
                  <div className="text-xs text-slate-500">Date of Death</div>
                  <div className="font-medium">{formatDate(details.date_of_death)}</div>
                </div>
              </div>

              <div className="rounded-md border p-3 bg-white">
                <div className="text-xs text-slate-500">Notes</div>
                <div className="whitespace-pre-wrap">{details.notes ?? "—"}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">No details.</div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              type="button"
              onClick={() => setOpen(false)}
              disabled={detailsBusy}
            >
              Close
            </Button>
            <Button type="button" onClick={load} disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
