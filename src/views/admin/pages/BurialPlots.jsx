// frontend/src/views/admin/pages/BurialPlots.jsx
import { useEffect, useMemo, useState, useCallback, memo, useRef } from "react";

import { getAuth } from "../../../utils/auth";
import { editPlot } from "../js/edit-plot";

import {
  TriangleAlert,
  QrCode,
  Download,
  Expand,
  Wand2,
  Info,
  RefreshCcw,
  Loader2,
  CalendarClock,
  XCircle,
  Copy,
  Bell,
  CheckCircle2,
  XCircle as RejectIcon,
  CreditCard,

  // ✅ Burial icons
  Skull,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "../../../components/ui/button";
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
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "../../../components/ui/alert";

import CemeteryMap, {
  CEMETERY_CENTER as GOOGLE_CENTER,
} from "../../../components/map/CemeteryMap";

import { Toaster, toast } from "sonner";

const CemeteryMapMemo = memo(CemeteryMap);

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "/api";

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
function centroidOfFeature(feature) {
  try {
    if (!feature?.geometry) return null;
    const geom = feature.geometry;

    if (geom.type === "Point") {
      const [lng, lat] = geom.coordinates || [];
      if (typeof lat === "number" && typeof lng === "number") return [lat, lng];
      return null;
    }

    const collectCoords = () => {
      const coords = [];

      if (geom.type === "Polygon") {
        const outer = geom.coordinates?.[0] || [];
        for (const [lng, lat] of outer) {
          if (typeof lat === "number" && typeof lng === "number")
            coords.push({ lat, lng });
        }
      } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates || []) {
          const outer = poly?.[0] || [];
          for (const [lng, lat] of outer) {
            if (typeof lat === "number" && typeof lng === "number")
              coords.push({ lat, lng });
          }
        }
      }

      return coords;
    };

    const coords = collectCoords();
    if (!coords.length) return null;

    let minLat = coords[0].lat;
    let maxLat = coords[0].lat;
    let minLng = coords[0].lng;
    let maxLng = coords[0].lng;

    for (const { lat, lng } of coords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
  } catch {
    return null;
  }
}

function statusBadgeProps(statusRaw) {
  const s = String(statusRaw || "").trim().toLowerCase();
  if (s === "available")
    return {
      label: "Available",
      className: "bg-emerald-600 hover:bg-emerald-600",
    };
  if (s === "reserved")
    return {
      label: "Reserved",
      className: "bg-amber-500 hover:bg-amber-500",
    };
  if (s === "occupied")
    return {
      label: "Occupied",
      className: "bg-rose-600 hover:bg-rose-600",
    };
  return {
    label: statusRaw || "—",
    className: "bg-slate-500 hover:bg-slate-500",
  };
}

function reservationBadgeProps(statusRaw) {
  const s = String(statusRaw || "").trim().toLowerCase();
  if (s === "pending")
    return { label: "Pending", className: "bg-amber-500 hover:bg-amber-500" };
  if (s === "approved")
    return {
      label: "Approved",
      className: "bg-emerald-600 hover:bg-emerald-600",
    };
  if (s === "rejected")
    return { label: "Rejected", className: "bg-rose-600 hover:bg-rose-600" };
  if (s === "cancelled" || s === "canceled")
    return { label: "Cancelled", className: "bg-slate-500 hover:bg-slate-500" };
  return { label: statusRaw || "—", className: "bg-slate-500 hover:bg-slate-500" };
}

function paymentBadgeProps(paymentStatusRaw) {
  const s = String(paymentStatusRaw || "").trim().toLowerCase();
  if (!s || s === "unpaid")
    return { label: "Unpaid", className: "bg-slate-500 hover:bg-slate-500" };
  if (s === "submitted")
    return { label: "Submitted", className: "bg-amber-500 hover:bg-amber-500" };
  if (s === "validated")
    return { label: "Validated", className: "bg-blue-600 hover:bg-blue-600" };
  if (s === "approved")
    return { label: "Approved", className: "bg-emerald-600 hover:bg-emerald-600" };
  if (s === "rejected")
    return { label: "Rejected", className: "bg-rose-600 hover:bg-rose-600" };
  return { label: paymentStatusRaw || "—", className: "bg-slate-500 hover:bg-slate-500" };
}

function paymentIsAccepted(paymentStatusRaw) {
  return String(paymentStatusRaw || "").trim().toLowerCase() === "approved";
}
function reservationIsDone(statusRaw) {
  const s = String(statusRaw || "").trim().toLowerCase();
  return s !== "pending";
}

function todayISOInManila() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;

  return `${y}-${m}-${d}`;
}

function toDateInputValue(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatPrice(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function parseNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getLatLngFromRow(row) {
  if (!row) return null;
  const lat =
    row.lat != null ? parseNum(row.lat) :
    row.latitude != null ? parseNum(row.latitude) : null;
  const lng =
    row.lng != null ? parseNum(row.lng) :
    row.longitude != null ? parseNum(row.longitude) : null;

  if (lat == null || lng == null) return null;
  return { lat, lng };
}

/* ---------------- QR helpers ---------------- */
function buildAutoQrTokenFromRow(row) {
  if (!row) return "";
  const coords = getLatLngFromRow(row);

  const payload = {
    _type: "grave",
    id: row.id ?? null,
    uid: row.uid ?? null,
    plot_name: row.plot_name ?? null,
    plot_type: row.plot_type ?? null,
    status: row.status ?? null,
    price: row.price ?? null,
    person_full_name: row.person_full_name ?? null,
    date_of_birth: row.date_of_birth ?? null,
    date_of_death: row.date_of_death ?? null,
    photo_url: row.photo_url ?? null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  };

  return JSON.stringify(payload);
}

function resolveQrTokenFromRow(row) {
  if (!row) return "";
  const direct =
    row.qr_token ??
    row.qr_value ??
    row.qr_data ??
    row.qr ??
    row.qrUrl ??
    row.qr_url ??
    row.qrText ??
    row.qr_text;

  if (direct && String(direct).trim()) return String(direct).trim();
  return buildAutoQrTokenFromRow(row);
}

async function makeQrDataUrl(text, opts = {}) {
  const mod = await import("qrcode");
  const toDataURL = mod.toDataURL || mod.default?.toDataURL;
  if (typeof toDataURL !== "function")
    throw new Error("qrcode.toDataURL not available");

  return await toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    ...opts,
  });
}

/* ---------------- backend helpers ---------------- */
function extractList(body) {
  if (Array.isArray(body)) return body;
  const candidates = [
    body?.data,
    body?.data?.rows,
    body?.data?.reservations,
    body?.reservations,
    body?.rows,
    body?.result,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function reservationPlotKeyCandidates(r) {
  const raw = [
    r?.plot_id,
    r?.plotId,
    r?.plot?.id,
    r?.plot?.plot_id,
    r?.plot_uid,
    r?.plotUid,
    r?.plot?.uid,
    r?.plot?.plot_uid,
  ];
  return raw
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
    .map((v) => String(v));
}
function getReceiptUrlFromReservation(r) {
  return String(
    r?.payment_receipt_url ??
      r?.receipt_url ??
      r?.receiptUrl ??
      r?.payment_receipt ??
      r?.paymentReceipt ??
      r?.paymentReceiptUrl ??
      r?.proof_url ??
      r?.proofUrl ??
      r?.proof ??
      r?.payment_proof ??
      r?.payment_proof_url ??
      r?.gcash_receipt_url ??
      r?.gcashReceiptUrl ??
      ""
  ).trim();
}

/* ---------------- Reservations Panel ---------------- */
const ReservationsPanel = memo(function ReservationsPanel({
  plotLabel,
  reservations,
  loading,
  error,
  onRefresh,
  onCancel,
  onValidatePayment,
  onApprovePayment,
  onReject,
  focusReservationId,
}) {

  const runAction = async (fn, id, fallbackMsg) => {
  try {
    await fn?.(id);
  } catch (e) {
    toast.error(String(e?.message || fallbackMsg || "Action failed"));
  }
};

  const summary = useMemo(() => {
    const list = reservations || [];
    const pending = list.filter((r) => String(r?.status || "").trim().toLowerCase() === "pending").length;
    const approved = list.filter((r) => String(r?.status || "").trim().toLowerCase() === "approved").length;
    const rejected = list.filter((r) => String(r?.status || "").trim().toLowerCase() === "rejected").length;
    const cancelled = list.filter((r) => {
      const s = String(r?.status || "").trim().toLowerCase();
      return s === "cancelled" || s === "canceled";
    }).length;

    const active = list.filter((r) => {
      const s = String(r?.status || "").trim().toLowerCase();
      return s === "pending" || s === "approved";
    }).length;

    const paid = list.filter((r) => paymentIsAccepted(r?.payment_status)).length;

    return { pending, approved, rejected, cancelled, active, paid };
  }, [reservations]);

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Reservations for this Plot
          </span>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onRefresh?.()}
            disabled={loading}
          >
            <RefreshCcw className={["mr-2 h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
            Refresh
          </Button>
        </CardTitle>

        <CardDescription>
          Reservations linked to: <span className="font-medium">{plotLabel || "—"}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge className={summary.pending ? "bg-amber-500 hover:bg-amber-500" : "bg-slate-500 hover:bg-slate-500"}>
            Pending: {summary.pending}
          </Badge>
          <Badge className={summary.approved ? "bg-emerald-600 hover:bg-emerald-600" : "bg-slate-500 hover:bg-slate-500"}>
            Approved: {summary.approved}
          </Badge>
          <Badge className={summary.rejected ? "bg-rose-600 hover:bg-rose-600" : "bg-slate-500 hover:bg-slate-500"}>
            Rejected: {summary.rejected}
          </Badge>
          <Badge className="bg-slate-500 hover:bg-slate-500">Cancelled: {summary.cancelled}</Badge>
          <Badge
            className={summary.paid ? "bg-emerald-600 hover:bg-emerald-600" : "bg-slate-500 hover:bg-slate-500"}
            title="Payment accepted (payment_status=approved)"
          >
            Payment Accepted: {summary.paid}
          </Badge>
        </div>

        {summary.active > 0 ? (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTitle className="flex items-center gap-2 text-amber-800">
              <Info className="h-4 w-4" />
              This plot already has an active reservation
            </AlertTitle>
            <AlertDescription className="text-amber-800">
              There {summary.active === 1 ? "is" : "are"} {summary.active} active reservation
              {summary.active === 1 ? "" : "s"} (pending/approved).
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive" className="border-rose-200">
            <AlertTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Failed to load reservations
            </AlertTitle>
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading reservations…
          </div>
        ) : !reservations?.length ? (
          <div className="text-sm text-slate-600">No reservations found for this plot.</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Reserved For</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Accepted?</TableHead>
                  <TableHead>Done?</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {reservations.map((r) => {
                  const b = reservationBadgeProps(r.status);
                  const created = r.created_at ? String(r.created_at).slice(0, 10) : "—";

                  const statusLower = String(r.status || "").trim().toLowerCase();

                  const canCancel =
                    statusLower !== "cancelled" &&
                    statusLower !== "canceled" &&
                    statusLower !== "rejected";

                  const isFocused =
                    focusReservationId != null && String(r.id) === String(focusReservationId);

                  const done = reservationIsDone(r.status);

                  const payBadge = paymentBadgeProps(r.payment_status);
                  const accepted = paymentIsAccepted(r.payment_status);

                  const paymentLower = String(r.payment_status || "").trim().toLowerCase();

                  // ✅ FIX: support multiple possible receipt fields
                  const receiptUrl = getReceiptUrlFromReservation(r);
                  const hasReceipt = Boolean(receiptUrl);

                  // ✅ Validate allowed if pending + payment is submitted/unpaid/empty/pending
                  const canValidate =
                    statusLower === "pending" &&
                    (paymentLower === "submitted" ||
                      paymentLower === "unpaid" ||
                      paymentLower === "" ||
                      paymentLower === "pending");

          const canApprovePay =
  statusLower === "pending" &&
  (paymentLower === "validated" || paymentLower === "submitted");
                  return (
                    <TableRow
                      key={r.id ?? `${created}-${Math.random()}`}
                      className={isFocused ? "bg-amber-50" : ""}
                    >
                      <TableCell className="font-medium">{r.id ?? "—"}</TableCell>

                      <TableCell>
                        <div className="text-sm">
                          {r.reserved_for_name ?? "—"}
                          <div className="text-xs text-slate-500">{r.reserved_for_email ?? ""}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge className={b.className}>{b.label}</Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={payBadge.className}>{payBadge.label}</Badge>
                          {hasReceipt ? (
                            <a
                              href={receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 underline"
                              title="Open uploaded receipt"
                            >
                              receipt
                            </a>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell>
                        {accepted ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-600 text-sm">
                            <XCircle className="h-4 w-4" />
                            No
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        {done ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 text-sm">
                            <Loader2 className="h-4 w-4" />
                            Not yet
                          </span>
                        )}
                      </TableCell>

                      <TableCell>{created}</TableCell>

                      <TableCell className="max-w-[220px] truncate" title={r.notes ?? ""}>
                        {r.notes ?? "—"}
                      </TableCell>

                      <TableCell className="text-right">
                        {statusLower === "pending" ? (
                          <div className="flex justify-end gap-2 flex-wrap">
                   <Button
  type="button"
  size="sm"
  disabled={!canApprovePay}
  onClick={() => runAction(onApprovePayment, r.id, "Approve failed")}
>
  <CheckCircle2 className="mr-2 h-4 w-4" />
  Approve
</Button>

<Button
  type="button"
  size="sm"
  variant="outline"
  disabled={!canValidate || !hasReceipt}
  onClick={() => runAction(onValidatePayment, r.id, "Validate failed")}
>
  <CreditCard className="mr-2 h-4 w-4" />
  Validate
</Button>

<Button
  type="button"
  size="sm"
  variant="destructive"
  onClick={() => runAction(onReject, r.id, "Reject failed")}
>
  <RejectIcon className="mr-2 h-4 w-4" />
  Reject
</Button>

                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={!canCancel}
                            onClick={async () => {
                              if (!canCancel) return;
                              if (!window.confirm("Cancel this reservation?")) return;
                              await onCancel?.(r.id);
                            }}
                          >
                            Cancel
                          </Button>
                        )}
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
  );
});

/* ---------------- Burial Record Dialog ---------------- */
function BurialRecordDialog({ open, onOpenChange, maxToday, users, initial, onSave }) {
  const [draft, setDraft] = useState(() => initial || {});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(initial || {});
    setBusy(false);
  }, [open, initial]);

  const submit = async () => {
    setBusy(true);
    try {
      await onSave?.(draft);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Skull className="h-5 w-5" />
            {draft?.id || draft?.uid ? "Edit Burial Record" : "Add Burial Record"}
          </DialogTitle>
          <DialogDescription>Saved into the graves table.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Deceased Name</Label>
            <Input
              value={draft.deceased_name ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, deceased_name: e.target.value }))}
              placeholder="e.g. Juan Dela Cruz"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Birth Date</Label>
            <Input
              type="date"
              max={maxToday}
              value={toDateInputValue(draft.birth_date)}
              onChange={(e) => setDraft((d) => ({ ...d, birth_date: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Death Date</Label>
            <Input
              type="date"
              max={maxToday}
              value={toDateInputValue(draft.death_date)}
              onChange={(e) => setDraft((d) => ({ ...d, death_date: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Burial Date</Label>
            <Input
              type="date"
              value={toDateInputValue(draft.burial_date)}
              onChange={(e) => setDraft((d) => ({ ...d, burial_date: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Family Contact (Visitor User)</Label>
            <select
              value={draft.family_contact ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, family_contact: e.target.value || null }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
            >
              <option value="">— None —</option>
              {(users || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.last_name}, {u.first_name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Headstone Type</Label>
            <Input
              value={draft.headstone_type ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, headstone_type: e.target.value }))}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Active?</Label>
            <select
              value={String(draft.is_active ?? true)}
              onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.value === "true" }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Memorial Text</Label>
            <Input
              value={draft.memorial_text ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, memorial_text: e.target.value }))}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Photo URL (optional)</Label>
            <Input
              value={draft.photo_url ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, photo_url: e.target.value }))}
              placeholder="/uploads/..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !String(draft.deceased_name || "").trim()}>
            {busy ? "Saving..." : "Save Burial Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Burial Records Panel ---------------- */
const BurialRecordsPanel = memo(function BurialRecordsPanel({
  plotLabel,
  records,
  loading,
  error,
  onRefresh,
  onAdd,
  onEdit,
  onDelete,
}) {
  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Skull className="h-4 w-4" />
            Burial Records (This Plot)
          </span>

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
              <RefreshCcw className={["mr-2 h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={onAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
        </CardTitle>

        <CardDescription>
          Linked to: <span className="font-medium">{plotLabel || "—"}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        {error ? (
          <Alert variant="destructive" className="border-rose-200">
            <AlertTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Failed to load burial records
            </AlertTitle>
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading burial records…
          </div>
        ) : !records?.length ? (
          <div className="text-sm text-slate-600">No burial records for this plot.</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Deceased Name</TableHead>
                  <TableHead>Birth</TableHead>
                  <TableHead>Death</TableHead>
                  <TableHead>Burial</TableHead>
                  <TableHead>Family Contact</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id ?? r.uid ?? Math.random()}>
                    <TableCell className="font-medium">{r.id ?? r.uid ?? "—"}</TableCell>
                    <TableCell>{r.deceased_name ?? "—"}</TableCell>
                    <TableCell>{r.birth_date ? String(r.birth_date).slice(0, 10) : "—"}</TableCell>
                    <TableCell>{r.death_date ? String(r.death_date).slice(0, 10) : "—"}</TableCell>
                    <TableCell>{r.burial_date ? String(r.burial_date).slice(0, 10) : "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={r.family_contact_name ?? ""}>
                      {r.family_contact_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Button type="button" size="sm" variant="outline" onClick={() => onEdit?.(r)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => onDelete?.(r)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

/* ---------------- QR UI ---------------- */
const QrPanel = memo(function QrPanel({
  title = "QR Code",
  hasToken,
  dataUrl,
  downloadName,
  hint,
  onEditToken,
}) {
  const [zoomOpen, setZoomOpen] = useState(false);

  if (!hasToken) {
    return (
      <Card className="border-slate-200 bg-white/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            {title}
          </CardTitle>
          <CardDescription>No QR token available.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 bg-white/80 backdrop-blur shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            {title}
          </span>

          <div className="flex items-center gap-2">
            {onEditToken ? (
              <Button type="button" size="sm" variant="outline" onClick={onEditToken}>
                Edit QR
              </Button>
            ) : null}
          </div>
        </CardTitle>
        {hint ? <CardDescription>{hint}</CardDescription> : null}
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
          <div className="relative">
            <div className="rounded-md border bg-white p-2">
              {dataUrl ? (
                <img
                  src={dataUrl}
                  alt="QR Code"
                  className="h-[140px] w-[140px] mx-auto object-contain cursor-zoom-in"
                  onClick={() => setZoomOpen(true)}
                  title="Click to enlarge"
                />
              ) : (
                <div className="h-[140px] w-[140px] mx-auto grid place-items-center text-sm text-slate-500">
                  Generating…
                </div>
              )}
            </div>

            {dataUrl ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute -top-2 -right-2 h-8 w-8 shadow"
                onClick={() => setZoomOpen(true)}
                title="Enlarge"
              >
                <Expand className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {dataUrl ? (
                <a href={dataUrl} download={downloadName || "grave-qr.png"}>
                  <Button type="button" variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download QR
                  </Button>
                </a>
              ) : null}
            </div>

            <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-slate-500" />
              <div>
                QR is generated from the current plot details (lat/lng + key info). Use “Edit QR” if you want a custom
                token.
              </div>
            </div>
          </div>
        </div>

        <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>QR Preview</DialogTitle>
              <DialogDescription>Ready to print (PNG)</DialogDescription>
            </DialogHeader>
            <div className="grid place-items-center">
              {dataUrl ? (
                <img
                  src={dataUrl}
                  alt="QR Code Large"
                  className="w-[420px] max-w-full rounded-md border bg-white p-3 object-contain"
                />
              ) : (
                <div className="w-[420px] max-w-full h-[420px] rounded-md border bg-slate-50 grid place-items-center text-sm text-slate-500">
                  Generating…
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setZoomOpen(false)}>
                Close
              </Button>
              {dataUrl ? (
                <a href={dataUrl} download={downloadName || "grave-qr.png"}>
                  <Button>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </a>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
});

/* ---------------- QR Edit Modal ---------------- */
function QrTokenEditorDialog({ open, onOpenChange, initialToken, autoToken, onSave }) {
  const [draft, setDraft] = useState(initialToken || "");
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(initialToken || "");
    setErr("");
    setPreviewUrl("");
  }, [open, initialToken]);

  useEffect(() => {
    if (!open) return;

    const t = setTimeout(() => {
      const text = (draft || "").trim();
      if (!text) {
        setPreviewUrl("");
        setErr("");
        return;
      }

      let alive = true;
      setBusy(true);
      setErr("");

      (async () => {
        try {
          const url = await makeQrDataUrl(text, { width: 420 });
          if (!alive) return;
          setPreviewUrl(url);
        } catch (e) {
          if (!alive) return;
          setErr(String(e?.message || e));
          setPreviewUrl("");
        } finally {
          if (alive) setBusy(false);
        }
      })();

      return () => {
        alive = false;
      };
    }, 280);

    return () => clearTimeout(t);
  }, [draft, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[980px] max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Edit QR Token
          </DialogTitle>
          <DialogDescription>
            Paste a token (JSON / link / text). The visitor scanner will use this to locate the grave.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[calc(85vh-150px)]">
          <div className="lg:col-span-2 rounded-xl border bg-white/70 backdrop-blur p-4 overflow-auto">
            <div className="flex items-center justify-between">
              <div className="font-medium text-slate-800">Preview</div>
              {busy ? <div className="text-xs text-slate-500">Generating…</div> : null}
            </div>

            <div className="mt-3 grid place-items-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="QR Preview"
                  className="w-[360px] max-w-full rounded-lg border bg-white p-3 object-contain"
                />
              ) : (
                <div className="w-[360px] max-w-full h-[360px] rounded-lg border bg-slate-50 grid place-items-center text-sm text-slate-500">
                  {draft.trim() ? "Generating…" : "Paste a token to preview"}
                </div>
              )}
            </div>

            {err ? (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
                {err}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(draft);
                    toast.success("Draft token copied.");
                  } catch {
                    toast.error("Copy failed.");
                  }
                }}
                disabled={!draft.trim()}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy draft
              </Button>

              {previewUrl ? (
                <a href={previewUrl} download="grave-qr-preview.png">
                  <Button type="button" variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download preview
                  </Button>
                </a>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-3 rounded-xl border bg-white/70 backdrop-blur p-4 overflow-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-slate-800">Token</div>
                <div className="text-xs text-slate-500">
                  Tip: JSON with <code className="px-1 py-0.5 bg-slate-100 rounded">lat</code> and{" "}
                  <code className="px-1 py-0.5 bg-slate-100 rounded">lng</code> is ideal.
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDraft(autoToken || "")}
                disabled={!autoToken}
                title="Generate token from current plot fields"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Use auto token
              </Button>
            </div>

            <div className="mt-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder='{"_type":"grave","lat":15.000,"lng":120.000,...}'
                className="min-h-[260px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => onSave?.(draft.trim())} disabled={!draft.trim()}>
                Save token
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Reservation Requests Card ---------------- */
const ReservationRequestsCard = memo(function ReservationRequestsCard({
  pending,
  loading,
  error,
  onRefresh,
  onOpenRequest,
}) {
  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Visitor Reservation Requests{" "}
            <Badge className={pending?.length ? "bg-amber-500 hover:bg-amber-500" : "bg-slate-500 hover:bg-slate-500"}>
              {pending?.length ?? 0}
            </Badge>
          </span>

          <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCcw className={["mr-2 h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          New pending requests will appear here. Click <span className="font-medium">Request</span> to open the plot.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        {error ? (
          <Alert variant="destructive" className="border-rose-200">
            <AlertTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Failed to load requests
            </AlertTitle>
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading requests…
          </div>
        ) : !pending?.length ? (
          <div className="text-sm text-slate-600">No pending reservation requests right now.</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Plot</TableHead>
                  <TableHead>Reserved For</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Accepted?</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pending.map((r) => {
                  const created = r.created_at ? String(r.created_at).slice(0, 10) : "—";
                  const plotLabel =
                    r.plot_name ??
                    r.plot?.plot_name ??
                    r.plot_id ??
                    r.plot_uid ??
                    r.plotId ??
                    r.plotUid ??
                    "—";

                  const payBadge = paymentBadgeProps(r.payment_status);
                  const accepted = paymentIsAccepted(r.payment_status);

                  return (
                    <TableRow key={r.id ?? `${created}-${Math.random()}`}>
                      <TableCell className="font-medium">{r.id ?? "—"}</TableCell>
                      <TableCell>{String(plotLabel)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {r.reserved_for_name ?? "—"}
                          <div className="text-xs text-slate-500">{r.reserved_for_email ?? ""}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge className={payBadge.className}>{payBadge.label}</Badge>
                      </TableCell>

                      <TableCell>
                        {accepted ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-600 text-sm">
                            <XCircle className="h-4 w-4" />
                            No
                          </span>
                        )}
                      </TableCell>

                      <TableCell>{created}</TableCell>
                      <TableCell className="max-w-[260px] truncate" title={r.notes ?? ""}>
                        {r.notes ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" onClick={() => onOpenRequest?.(r)}>
                          Request
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
  );
});

export default function BurialPlots() {
  const [fc, setFc] = useState(null);
  const [roadsFc, setRoadsFc] = useState(null);

  const [error, setError] = useState(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const [qInput, setQInput] = useState("");
  const q = useDebouncedValue(qInput, 180);

  const maxToday = useMemo(() => todayISOInManila(), []);

  // ✅ Photo upload state
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoObjectUrlRef = useRef("");

  // map view state
  const [mapCenter, setMapCenter] = useState(GOOGLE_CENTER);
  const [mapZoom, setMapZoom] = useState(19);

  // dialogs
  const [editOpen, setEditOpen] = useState(false);
  const [modalRow, setModalRow] = useState(null);

  // QR state
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrErr, setQrErr] = useState("");
  const [qrEditOpen, setQrEditOpen] = useState(false);

  // Focus a reservation (when opened from Requests)
  const [focusReservationId, setFocusReservationId] = useState(null);
  const [openedFromRequest, setOpenedFromRequest] = useState(false);

  const auth = getAuth();
  const token = auth?.token;

  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const EMPTY_ARR = useMemo(() => [], []);

  // reservations per plot
  const [plotReservations, setPlotReservations] = useState([]);
  const [resLoading, setResLoading] = useState(false);
  const [resError, setResError] = useState("");

  // requests list
  const [pendingReqs, setPendingReqs] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const lastPendingIdsRef = useRef(new Set());

  // ✅ Burial records per plot
  const [burialRecords, setBurialRecords] = useState([]);
  const [burialLoading, setBurialLoading] = useState(false);
  const [burialError, setBurialError] = useState("");

  // ✅ Burial record dialog
  const [burialDialogOpen, setBurialDialogOpen] = useState(false);
  const [burialDraft, setBurialDraft] = useState(null);

  // ✅ visitor users for family_contact picker
  const [visitorUsers, setVisitorUsers] = useState([]);
  const [visitorUsersError, setVisitorUsersError] = useState("");

  const ADMIN_ENDPOINTS = useMemo(
    () => ({
      reservations: `${API_BASE}/admin/reservations`,
      cancelReservation: (id) => `${API_BASE}/admin/cancel-reservation/${encodeURIComponent(id)}`,
      validatePayment: (id) => `${API_BASE}/admin/reservations/${encodeURIComponent(id)}/validate-payment`,
      approvePayment: (id) => `${API_BASE}/admin/reservations/${encodeURIComponent(id)}/approve-payment`,
      rejectReservation: (id) => `${API_BASE}/admin/reservations/${encodeURIComponent(id)}/reject`,

      // ✅ Burial records (matches your admin.routes.js: GET/POST/PATCH at /burial-records)
      burialRecords: `${API_BASE}/admin/burial-records`,
      deleteBurial: (id) => `${API_BASE}/admin/burial-records/${encodeURIComponent(id)}`,

      // ✅ visitor users (matches your admin.routes.js: GET /users/visitors)
      visitorUsers: `${API_BASE}/admin/users/visitors`,
    }),
    []
  );

  useEffect(() => {
    return () => {
      if (photoObjectUrlRef.current) {
        URL.revokeObjectURL(photoObjectUrlRef.current);
        photoObjectUrlRef.current = "";
      }
    };
  }, []);

  const handlePickPhoto = useCallback(
    (e) => {
      const file = e.target.files?.[0] || null;

      if (photoObjectUrlRef.current) {
        URL.revokeObjectURL(photoObjectUrlRef.current);
        photoObjectUrlRef.current = "";
      }

      setPhotoFile(file);

      if (file) {
        const url = URL.createObjectURL(file);
        photoObjectUrlRef.current = url;
        setPhotoPreviewUrl(url);
      } else {
        setPhotoPreviewUrl(String(modalRow?.photo_url || "").trim());
      }
    },
    [modalRow?.photo_url]
  );

  useEffect(() => {
    if (!editOpen) return;
    if (photoFile) return;
    setPhotoPreviewUrl(String(modalRow?.photo_url || "").trim());
  }, [editOpen, modalRow?.photo_url, photoFile]);

  const fetchAllReservationsAdmin = useCallback(async () => {
    const url = ADMIN_ENDPOINTS.reservations;
    const res = await fetch(url, { headers: { ...authHeader, Accept: "application/json" } });
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) {
      const msg = typeof body === "string" ? body : body?.message || JSON.stringify(body);
      throw new Error(msg || "Failed to load reservations.");
    }
    return extractList(body);
  }, [ADMIN_ENDPOINTS.reservations, authHeader]);

  const loadReservationsForPlot = useCallback(
    async ({ id, uid } = {}) => {
      const keys = new Set(
        [id, uid]
          .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
          .map((v) => String(v))
      );

      if (!keys.size) {
        setPlotReservations([]);
        setResError("");
        return;
      }

      setResLoading(true);
      setResError("");

      try {
        const all = await fetchAllReservationsAdmin();

        const filtered = all.filter((r) => {
          const cands = reservationPlotKeyCandidates(r);
          return cands.some((k) => keys.has(String(k)));
        });

        filtered.sort((a, b) => {
          const da = new Date(a?.created_at || 0).getTime();
          const db = new Date(b?.created_at || 0).getTime();
          return db - da;
        });

        setPlotReservations(filtered);
      } catch (e) {
        setPlotReservations([]);
        setResError(String(e?.message || e));
      } finally {
        setResLoading(false);
      }
    },
    [fetchAllReservationsAdmin]
  );

  const cancelReservationAdmin = useCallback(
    async (reservationId) => {
      const res = await fetch(ADMIN_ENDPOINTS.cancelReservation(reservationId), {
        method: "PATCH",
        headers: { ...authHeader, Accept: "application/json" },
      });
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = typeof body === "string" ? body : body?.message || JSON.stringify(body);
        throw new Error(msg || "Failed to cancel reservation.");
      }
      toast.success("Reservation cancelled.");
      return body;
    },
    [ADMIN_ENDPOINTS, authHeader]
  );

  const validatePaymentAdmin = useCallback(
    async (reservationId) => {
      const url = ADMIN_ENDPOINTS.validatePayment(reservationId);
      const res = await fetch(url, { method: "PATCH", headers: { ...authHeader, Accept: "application/json" } });
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = typeof body === "string" ? body : body?.message || JSON.stringify(body);
        throw new Error(msg || `Failed: ${res.status}`);
      }
      toast.success("Payment validated.");
      return body;
    },
    [ADMIN_ENDPOINTS, authHeader]
  );

  const approvePaymentAdmin = useCallback(
    async (reservationId) => {
      const url = ADMIN_ENDPOINTS.approvePayment(reservationId);
      const res = await fetch(url, { method: "PATCH", headers: { ...authHeader, Accept: "application/json" } });
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = typeof body === "string" ? body : body?.message || JSON.stringify(body);
        throw new Error(msg || `Failed: ${res.status}`);
      }
      toast.success("Payment approved (accepted).");
      return body;
    },
    [ADMIN_ENDPOINTS, authHeader]
  );

  const rejectReservationAdmin = useCallback(
    async (reservationId) => {
      const url = ADMIN_ENDPOINTS.rejectReservation(reservationId);
      const res = await fetch(url, { method: "PATCH", headers: { ...authHeader, Accept: "application/json" } });
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = typeof body === "string" ? body : body?.message || JSON.stringify(body);
        throw new Error(msg || `Failed: ${res.status}`);
      }
      toast.success("Reservation rejected.");
      return body;
    },
    [ADMIN_ENDPOINTS, authHeader]
  );

  const fetchPlotDetails = useCallback(
    async (idOrUid) => {
      const res = await fetch(`${API_BASE}/admin/plot/${encodeURIComponent(idOrUid)}`, { headers: authHeader });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    [authHeader]
  );

  const fetchPlots = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/plot/`, { headers: authHeader });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const json = await res.json();
      setFc(json);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, [authHeader]);

  const fetchRoads = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/plot/road-plots`);
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const body = ct.includes("application/json") ? await res.json() : await res.text();
        throw new Error(ct.includes("application/json") ? JSON.stringify(body) : body.slice(0, 200));
      }
      const json = await res.json();
      setRoadsFc(json);
    } catch (e) {
      console.error("Failed to load road plots:", e);
    }
  }, []);

  useEffect(() => {
    fetchPlots();
    fetchRoads();
  }, [fetchPlots, fetchRoads]);

  // ✅ rows (for lookup)
  const rows = useMemo(() => {
    if (!fc?.features) return [];
    return fc.features.map((f) => {
      const p = f.properties || {};
      const c = centroidOfFeature(f);

      return {
        id: p.id != null ? String(p.id) : undefined,
        uid: p.uid != null ? String(p.uid) : undefined,
        plot_name: p.plot_name,
        plot_type: p.plot_type,
        size_sqm: p.size_sqm,
        price: p.price,
        status: p.status,
        lat: c ? c[0] : null,
        lng: c ? c[1] : null,
        qr_token: p.qr_token ?? p.qr_value ?? p.qr_data ?? p.qr ?? p.qr_url ?? null,
        photo_url: p.photo_url || p.photo || null,
        _feature: f,
      };
    });
  }, [fc]);

  const plotPolygons = useMemo(() => {
    if (!fc?.features) return [];
    return fc.features
      .map((f) => {
        const geom = f.geometry;
        if (!geom) return null;

        let coords = [];
        if (geom.type === "Polygon") {
          const outer = geom.coordinates?.[0] || [];
          coords = outer
            .map(([lng, lat]) =>
              typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null
            )
            .filter(Boolean);
        } else if (geom.type === "MultiPolygon") {
          const outer = geom.coordinates?.[0]?.[0] || [];
          coords = outer
            .map(([lng, lat]) =>
              typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null
            )
            .filter(Boolean);
        } else return null;

        if (!coords.length) return null;

        const lats = coords.map((p) => p.lat);
        const lngs = coords.map((p) => p.lng);
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

        const props = f.properties || {};
        const status = (props.status || "").toLowerCase();

        let fillColor = "#10b981";
        if (status === "reserved") fillColor = "#f59e0b";
        else if (status === "occupied") fillColor = "#ef4444";

        return {
          id: props.id ?? undefined,
          uid: props.uid,
          plot_name: props.plot_name,
          plot_type: props.plot_type,
          size_sqm: props.size_sqm,
          status: props.status,
          price: props.price,
          photo_url: props.photo_url || props.photo || null,
          qr_token: props.qr_token ?? props.qr_value ?? props.qr_data ?? props.qr ?? props.qr_url ?? null,
          lat: centerLat,
          lng: centerLng,
          _feature: f,
          path: coords,
          options: {
            strokeColor: fillColor,
            strokeOpacity: 1,
            strokeWeight: 1.2,
            fillColor,
            fillOpacity: 0.5,
          },
        };
      })
      .filter(Boolean);
  }, [fc]);

  const roadLines = useMemo(() => {
    if (!roadsFc?.features) return [];

    return roadsFc.features
      .map((f) => {
        const g = f.geometry;
        if (!g) return null;

        let coords = [];
        if (g.type === "LineString") {
          coords =
            g.coordinates?.map(([lng, lat]) =>
              typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null
            ) || [];
        } else if (g.type === "MultiLineString") {
          coords = (g.coordinates || []).flatMap((seg) =>
            (seg || []).map(([lng, lat]) =>
              typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null
            )
          );
        } else return null;

        coords = coords.filter(Boolean);
        if (!coords.length) return null;

        const props = f.properties || {};
        return {
          id: props.id ?? props.uid ?? undefined,
          path: coords,
          options: { strokeColor: "#facc15", strokeOpacity: 1, strokeWeight: 3 },
        };
      })
      .filter(Boolean);
  }, [roadsFc]);

  // ✅ filter polygons by search + onlyAvailable
  const visiblePlotPolygons = useMemo(() => {
    const text = q.trim().toLowerCase();

    return (plotPolygons || []).filter((p) => {
      const statusLower = String(p.status || "").toLowerCase();
      if (onlyAvailable && statusLower !== "available") return false;

      if (!text) return true;

      return (
        String(p.id ?? "").toLowerCase().includes(text) ||
        String(p.uid ?? "").toLowerCase().includes(text) ||
        String(p.plot_name ?? "").toLowerCase().includes(text) ||
        String(p.plot_type ?? "").toLowerCase().includes(text) ||
        String(p.status ?? "").toLowerCase().includes(text) ||
        String(p.price ?? "").toLowerCase().includes(text)
      );
    });
  }, [plotPolygons, q, onlyAvailable]);

  const selectedPlotKey = useMemo(() => {
    const k = modalRow?.id ?? modalRow?.uid ?? null;
    return k != null ? String(k) : null;
  }, [modalRow?.id, modalRow?.uid]);

  const modalCoords = useMemo(() => getLatLngFromRow(modalRow), [modalRow]);
  const modalMapCenter = useMemo(() => modalCoords || GOOGLE_CENTER, [modalCoords]);
  const modalMapZoom = useMemo(() => (modalCoords ? 21 : 19), [modalCoords]);

  const modalPolygons = useMemo(() => {
    if (!plotPolygons?.length) return [];
    if (!selectedPlotKey) return plotPolygons;

    return plotPolygons.map((p) => {
      const isSelected =
        (p.id != null && String(p.id) === selectedPlotKey) ||
        (p.uid != null && String(p.uid) === selectedPlotKey);

      const base = p.options || {};

      if (isSelected) {
        return {
          ...p,
          options: {
            ...base,
            strokeColor: "#2563eb",
            strokeOpacity: 1,
            strokeWeight: 4.5,
            fillColor: "#60a5fa",
            fillOpacity: 0.65,
            zIndex: 999,
          },
        };
      }

      return {
        ...p,
        options: {
          ...base,
          strokeOpacity: Math.min(base.strokeOpacity ?? 1, 0.35),
          fillOpacity: Math.min(base.fillOpacity ?? 0.5, 0.18),
        },
      };
    });
  }, [plotPolygons, selectedPlotKey]);

  // ✅ visitor users fetch (for family_contact)
  const fetchVisitorUsers = useCallback(async () => {
    setVisitorUsersError("");
    try {
      const res = await fetch(ADMIN_ENDPOINTS.visitorUsers, {
        headers: { ...authHeader, Accept: "application/json" },
      });
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = typeof body === "string" ? body : body?.message || JSON.stringify(body);
        throw new Error(msg || "Failed to load visitor users");
      }
      setVisitorUsers(Array.isArray(body) ? body : extractList(body));
    } catch (e) {
      setVisitorUsers([]);
      setVisitorUsersError(String(e?.message || e));
    }
  }, [ADMIN_ENDPOINTS.visitorUsers, authHeader]);

  // ✅ burial records fetch for this plot
  const loadBurialForPlot = useCallback(
    async ({ plot_id, plot_uid }) => {
      setBurialLoading(true);
      setBurialError("");
      try {
        const qs = new URLSearchParams();
        if (plot_id) qs.set("plot_id", String(plot_id));
        else if (plot_uid) qs.set("plot_uid", String(plot_uid));

        const url = `${ADMIN_ENDPOINTS.burialRecords}?${qs.toString()}`;
        const res = await fetch(url, { headers: { ...authHeader, Accept: "application/json" } });
        const ct = res.headers.get("content-type") || "";
        const body = ct.includes("application/json") ? await res.json() : await res.text();
        if (!res.ok) {
          const msg = typeof body === "string" ? body : body?.message || JSON.stringify(body);
          throw new Error(msg || "Failed to load burial records");
        }
        setBurialRecords(Array.isArray(body) ? body : extractList(body));
      } catch (e) {
        setBurialRecords([]);
        setBurialError(String(e?.message || e));
      } finally {
        setBurialLoading(false);
      }
    },
    [ADMIN_ENDPOINTS.burialRecords, authHeader]
  );

  const createBurialRecord = useCallback(
    async (payload) => {
      const res = await fetch(ADMIN_ENDPOINTS.burialRecords, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = typeof body === "string" ? body : body?.message || JSON.stringify(body);
        throw new Error(msg || "Failed to add burial record.");
      }
      toast.success("Burial record added.");
      return body;
    },
    [ADMIN_ENDPOINTS.burialRecords, authHeader]
  );

  // ✅ FIX: matches backend PATCH /burial-records (no /:id)
  const updateBurialRecord = useCallback(
    async (_idOrUid, payload) => {
      const res = await fetch(ADMIN_ENDPOINTS.burialRecords, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = typeof body === "string" ? body : body?.message || JSON.stringify(body);
        throw new Error(msg || "Failed to update burial record.");
      }
      toast.success("Burial record updated.");
      return body;
    },
    [ADMIN_ENDPOINTS.burialRecords, authHeader]
  );

  const removeBurialRecord = useCallback(
    async (idOrUid) => {
      const res = await fetch(ADMIN_ENDPOINTS.deleteBurial(idOrUid), {
        method: "DELETE",
        headers: { ...authHeader, Accept: "application/json" },
      });
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = typeof body === "string" ? body : body?.message || JSON.stringify(body);
        throw new Error(msg || "Failed to delete burial record.");
      }
      toast.success("Burial record deleted.");
      return body;
    },
    [ADMIN_ENDPOINTS, authHeader]
  );

  // ✅ open edit
  const openEdit = useCallback(
    async (polyOrRow) => {
      const feature = polyOrRow?._feature;
      const props = feature?.properties || polyOrRow?._feature?.properties || {};

      const row = {
        id: polyOrRow?.id ?? (props.id != null ? String(props.id) : ""),
        uid: polyOrRow?.uid ?? (props.uid != null ? String(props.uid) : ""),

        plot_name: polyOrRow?.plot_name ?? props.plot_name ?? "",
        plot_type: polyOrRow?.plot_type ?? props.plot_type ?? "",
        status: polyOrRow?.status ?? props.status ?? "",

        lat: polyOrRow?.lat ?? null,
        lng: polyOrRow?.lng ?? null,

        price: props.price ?? polyOrRow?.price ?? "",

        person_full_name: "",
        date_of_birth: "",
        date_of_death: "",
        next_of_kin_name: "",
        contact_phone: "",
        contact_email: "",
        notes: "",
        photo_url: props.photo_url ?? polyOrRow?.photo_url ?? "",
        qr_token:
          props.qr_token ??
          props.qr_value ??
          props.qr_data ??
          props.qr ??
          props.qr_url ??
          polyOrRow?.qr_token ??
          null,
      };

      // reset local photo preview
      setPhotoFile(null);
      if (photoObjectUrlRef.current) {
        URL.revokeObjectURL(photoObjectUrlRef.current);
        photoObjectUrlRef.current = "";
      }
      setPhotoPreviewUrl(String(row.photo_url || "").trim());

      setModalRow(row);
      setEditOpen(true);

      const key = row.id || row.uid;
      if (!key) return;

      try {
        const details = await fetchPlotDetails(key);

        setModalRow((m) =>
          m
            ? {
                ...m,
                person_full_name: details.person_full_name ?? "",
                date_of_birth: details.date_of_birth ?? "",
                date_of_death: details.date_of_death ?? "",
                next_of_kin_name: details.next_of_kin_name ?? "",
                contact_phone: details.contact_phone ?? "",
                contact_email: details.contact_email ?? "",
                notes: details.notes ?? "",
                photo_url: details.photo_url ?? m.photo_url ?? "",
                lat: details.lat ?? m.lat,
                lng: details.lng ?? m.lng,
                price: details.price ?? m.price ?? "",
                status: details.status ?? m.status,
                plot_name: details.plot_name ?? m.plot_name,
                plot_type: details.plot_type ?? m.plot_type,
                qr_token:
                  details.qr_token ??
                  details.qr_value ??
                  details.qr_data ??
                  details.qr ??
                  details.qr_url ??
                  m.qr_token ??
                  null,
              }
            : m
        );
      } catch (e) {
        toast.error(e?.message || "Failed to load plot details.");
      }
    },
    [fetchPlotDetails]
  );

  const handleEditPlotFromMap = useCallback(
    (poly) => {
      setOpenedFromRequest(false);
      setFocusReservationId(null);
      openEdit(poly);
    },
    [openEdit]
  );

  // load reservations + burials when modal opens
  useEffect(() => {
    if (!editOpen || !modalRow) return;
    loadReservationsForPlot({ id: modalRow?.id, uid: modalRow?.uid });
    loadBurialForPlot({ plot_id: modalRow?.id, plot_uid: modalRow?.uid });
    fetchVisitorUsers();
  }, [
    editOpen,
    modalRow?.id,
    modalRow?.uid,
    loadReservationsForPlot,
    loadBurialForPlot,
    fetchVisitorUsers,
  ]);

  const resolvedToken = useMemo(() => {
    if (!editOpen || !modalRow) return "";
    return resolveQrTokenFromRow(modalRow);
  }, [editOpen, modalRow]);

  const debouncedToken = useDebouncedValue(resolvedToken, 350);

  useEffect(() => {
    let alive = true;

    if (!editOpen) {
      setQrDataUrl("");
      setQrErr("");
      return;
    }

    if (!debouncedToken) {
      setQrDataUrl("");
      setQrErr("");
      return;
    }

    setQrErr("");
    setQrDataUrl("");

    (async () => {
      try {
        const url = await makeQrDataUrl(debouncedToken);
        if (!alive) return;
        setQrDataUrl(url);
      } catch (e) {
        if (!alive) return;
        setQrErr(String(e?.message || e));
        setQrDataUrl("");
      }
    })();

    return () => {
      alive = false;
    };
  }, [editOpen, debouncedToken]);

  const autoTokenForModalRow = useMemo(
    () => buildAutoQrTokenFromRow(modalRow),
    [modalRow]
  );

  // ✅ photo upload API (your backend already supports it)
  const uploadPlotPhoto = useCallback(
    async ({ plotKey, file }) => {
      if (!plotKey) throw new Error("Missing plot id/uid for upload.");
      if (!file) throw new Error("No file selected.");

      const form = new FormData();
      form.append("photo", file);

      const res = await fetch(`${API_BASE}/admin/plot/${encodeURIComponent(plotKey)}/photo`, {
        method: "POST",
        headers: { ...authHeader, Accept: "application/json" },
        body: form,
      });

      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();

      if (!res.ok) {
        const msg = typeof body === "string" ? body : body?.message || JSON.stringify(body);
        throw new Error(msg || "Failed to upload photo.");
      }

      const url = body?.photo_url || body?.url || body?.data?.photo_url || body?.data?.url;
      if (!url) throw new Error("Upload succeeded but server returned no photo_url.");
      return String(url);
    },
    [authHeader]
  );

  const handleEditSubmit = useCallback(
    async (payload) => {
      try {
        let nextPayload = { ...payload };
        const plotKey = nextPayload.id || nextPayload.uid;

        if (photoFile) {
          setPhotoUploading(true);
          const uploadedUrl = await uploadPlotPhoto({ plotKey, file: photoFile });
          nextPayload.photo_url = uploadedUrl;
        }

        await editPlot(nextPayload);
        toast.success("Plot updated successfully.");
        await fetchPlots();

        await loadReservationsForPlot({ id: modalRow?.id, uid: modalRow?.uid });
        await loadBurialForPlot({ plot_id: modalRow?.id, plot_uid: modalRow?.uid });

        setEditOpen(false);
        setModalRow(null);
        setOpenedFromRequest(false);
        setFocusReservationId(null);

        setPhotoFile(null);
        if (photoObjectUrlRef.current) {
          URL.revokeObjectURL(photoObjectUrlRef.current);
          photoObjectUrlRef.current = "";
        }
        setPhotoPreviewUrl("");
      } catch (err) {
        toast.error(err?.message || "Failed to update plot.");
      } finally {
        setPhotoUploading(false);
      }
    },
    [fetchPlots, loadReservationsForPlot, loadBurialForPlot, modalRow?.id, modalRow?.uid, photoFile, uploadPlotPhoto]
  );

  // pending requests polling
  const refreshPendingRequests = useCallback(async () => {
    setPendingLoading(true);
    setPendingError("");

    try {
      const all = await fetchAllReservationsAdmin();
      const pending = all.filter((r) => String(r?.status || "").trim().toLowerCase() === "pending");

      const nextIds = new Set(pending.map((r) => String(r?.id)).filter(Boolean));
      const prevIds = lastPendingIdsRef.current;

      let hasNew = false;
      for (const id of nextIds) {
        if (!prevIds.has(id)) {
          hasNew = true;
          break;
        }
      }

      if (hasNew && prevIds.size > 0) {
        toast("New reservation request received.", { richColors: true });
      }

      lastPendingIdsRef.current = nextIds;
      setPendingReqs(pending);
    } catch (e) {
      setPendingError(String(e?.message || e));
    } finally {
      setPendingLoading(false);
    }
  }, [fetchAllReservationsAdmin]);

  useEffect(() => {
    refreshPendingRequests();
    const t = setInterval(() => refreshPendingRequests(), 15000);
    return () => clearInterval(t);
  }, [refreshPendingRequests]);

  const openFromRequest = useCallback(
    async (reservation) => {
      if (!reservation) return;

      setOpenedFromRequest(true);
      setFocusReservationId(reservation?.id ?? null);

      const keys = reservationPlotKeyCandidates(reservation);
      const key = keys[0] || null;

      let found = null;
      for (const r of rows) {
        if (!r) continue;
        if (r.id && keys.includes(String(r.id))) found = r;
        if (!found && r.uid && keys.includes(String(r.uid))) found = r;
        if (found) break;
      }

      if (found) {
        if (found.lat != null && found.lng != null) {
          setMapCenter({ lat: found.lat, lng: found.lng });
          setMapZoom((z) => (z < 19 ? 19 : z));
        }
        await openEdit(found);
        return;
      }

      if (!key) {
        toast.error("This request has no plot reference (plot_id/plot_uid).");
        return;
      }

      try {
        const details = await fetchPlotDetails(key);

        const prep = {
          id: details.id != null ? String(details.id) : "",
          uid: details.uid != null ? String(details.uid) : "",
          plot_name: details.plot_name ?? "",
          plot_type: details.plot_type ?? "",
          status: details.status ?? "",
          lat: details.lat ?? null,
          lng: details.lng ?? null,
          price: details.price ?? "",
          person_full_name: details.person_full_name ?? "",
          date_of_birth: details.date_of_birth ?? "",
          date_of_death: details.date_of_death ?? "",
          next_of_kin_name: details.next_of_kin_name ?? "",
          contact_phone: details.contact_phone ?? "",
          contact_email: details.contact_email ?? "",
          notes: details.notes ?? "",
          photo_url: details.photo_url ?? "",
          qr_token:
            details.qr_token ??
            details.qr_value ??
            details.qr_data ??
            details.qr ??
            details.qr_url ??
            null,
        };

        setModalRow(prep);
        setEditOpen(true);

        if (prep.lat != null && prep.lng != null) {
          setMapCenter({ lat: prep.lat, lng: prep.lng });
          setMapZoom((z) => (z < 19 ? 19 : z));
        }
      } catch (e) {
        toast.error(e?.message || "Failed to open plot for this request.");
      }
    },
    [rows, openEdit, fetchPlotDetails]
  );

  return (
    <div className="p-6 space-y-6">
      <Toaster richColors expand={false} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Burial Plots</h1>
          <p className="text-sm text-muted-foreground">
            Click a plot on the map to edit. Burial Records are managed inside the plot editor.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <Label>Search</Label>
                <Input
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Search plot name, type, status, price…"
                  className="w-[320px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <Switch checked={onlyAvailable} onCheckedChange={setOnlyAvailable} />
                <span className="text-sm">Only Available</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ReservationRequestsCard
        pending={pendingReqs}
        loading={pendingLoading}
        error={pendingError}
        onRefresh={refreshPendingRequests}
        onOpenRequest={openFromRequest}
      />

      {error && (
        <Alert variant="destructive" className="border-rose-200">
          <AlertTitle className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" />
            Failed to load plots
          </AlertTitle>
          <AlertDescription className="break-words">{error}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Map</CardTitle>
          <CardDescription>Click any plot on the map to edit it.</CardDescription>
        </CardHeader>
        <CardContent className="h-[60vh]">
          <div className="h-full rounded-md overflow-hidden border relative">
            <CemeteryMapMemo
              center={mapCenter}
              zoom={mapZoom}
              clickable={true}
              showGeofence={true}
              restrictToGeofence={true}
              markers={EMPTY_ARR}
              polygons={visiblePlotPolygons}
              polylines={roadLines}
              onEditPlot={handleEditPlotFromMap}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) {
            setModalRow(null);
            setOpenedFromRequest(false);
            setFocusReservationId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[1180px] max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit Plot</DialogTitle>
            <DialogDescription>
              {openedFromRequest
                ? "If opened from Requests, validate/approve payment in Reservations."
                : "Update plot details. Burial Records are on the left; QR + reservations are on the right."}
            </DialogDescription>
          </DialogHeader>

          {modalRow && (
            <form
              onSubmit={(e) => {
                e.preventDefault();

                const payload = {
                  id: modalRow.id ?? "",
                  uid: modalRow.uid ?? "",
                  status: (modalRow.status ?? "").toString().trim(),
                  price: modalRow.price === "" || modalRow.price == null ? null : Number(modalRow.price),

                  person_full_name: (modalRow.person_full_name ?? "").toString().trim(),
                  date_of_birth: (modalRow.date_of_birth ?? "").toString().trim(),
                  date_of_death: (modalRow.date_of_death ?? "").toString().trim(),
                  next_of_kin_name: (modalRow.next_of_kin_name ?? "").toString().trim(),
                  contact_phone: (modalRow.contact_phone ?? "").toString().trim(),
                  contact_email: (modalRow.contact_email ?? "").toString().trim(),
                  notes: (modalRow.notes ?? "").toString(),

                  photo_url: (modalRow.photo_url ?? "").toString().trim(),
                  qr_token: modalRow.qr_token ? String(modalRow.qr_token) : null,
                };

                handleEditSubmit(payload);
              }}
              className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[calc(85vh-150px)]"
            >
              <div className="lg:col-span-3 overflow-auto pr-1 space-y-4">
                <Card className="bg-white/80 backdrop-blur border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Plot</CardTitle>
                    <CardDescription>Core plot fields</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Plot Name</Label>
                      <Input
                        value={modalRow.plot_name ?? ""}
                        readOnly
                        className="text-slate-500 border-slate-200 bg-slate-50"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Photo (Upload)</Label>
                      <Input type="file" accept="image/*" onChange={handlePickPhoto} disabled={photoUploading} />
                      <div className="text-xs text-slate-500">
                        Upload happens when you click <span className="font-medium">Save</span>.
                      </div>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label>Photo Preview</Label>
                      {String(photoPreviewUrl || "").trim() ? (
                        <img
                          src={String(photoPreviewUrl).trim()}
                          alt="Plot/Deceased"
                          className="w-full max-h-[240px] object-contain rounded-md border bg-white"
                        />
                      ) : (
                        <div className="text-sm text-slate-600">No photo selected.</div>
                      )}
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Status</Label>
                      <select
                        value={modalRow.status ?? ""}
                        onChange={(e) => setModalRow((m) => ({ ...m, status: e.target.value }))}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                      >
                        <option value="">— Select Status —</option>
                        <option value="available">Available</option>
                        <option value="reserved">Reserved</option>
                        <option value="occupied">Occupied</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Price per Grave</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={modalRow.price ?? ""}
                        onChange={(e) => setModalRow((m) => ({ ...m, price: e.target.value }))}
                        placeholder="e.g. 25000"
                      />
                    </div>

                    <div className="text-xs text-slate-500 sm:col-span-2">
                      Display: {statusBadgeProps(modalRow.status).label} • {formatPrice(modalRow.price)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Personal Information</CardTitle>
                    <CardDescription>Stored in plots table (used by search-by-name).</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Full Name</Label>
                      <Input
                        value={modalRow.person_full_name ?? ""}
                        onChange={(e) => setModalRow((m) => ({ ...m, person_full_name: e.target.value }))}
                        placeholder="e.g. Juan Dela Cruz"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        max={maxToday}
                        value={toDateInputValue(modalRow.date_of_birth)}
                        onChange={(e) => setModalRow((m) => ({ ...m, date_of_birth: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Date of Death</Label>
                      <Input
                        type="date"
                        max={maxToday}
                        value={toDateInputValue(modalRow.date_of_death)}
                        onChange={(e) => setModalRow((m) => ({ ...m, date_of_death: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Next of Kin</Label>
                      <Input
                        value={modalRow.next_of_kin_name ?? ""}
                        onChange={(e) => setModalRow((m) => ({ ...m, next_of_kin_name: e.target.value }))}
                        placeholder="e.g. Maria Dela Cruz"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Contact Phone</Label>
                      <Input
                        value={modalRow.contact_phone ?? ""}
                        onChange={(e) => setModalRow((m) => ({ ...m, contact_phone: e.target.value }))}
                        placeholder="e.g. +63 9xx xxx xxxx"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Contact Email</Label>
                      <Input
                        value={modalRow.contact_email ?? ""}
                        onChange={(e) => setModalRow((m) => ({ ...m, contact_email: e.target.value }))}
                        placeholder="e.g. family@email.com"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Notes</Label>
                      <Input
                        value={modalRow.notes ?? ""}
                        onChange={(e) => setModalRow((m) => ({ ...m, notes: e.target.value }))}
                        placeholder="Optional notes"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* ✅ Burial Records feature */}
                <BurialRecordsPanel
                  plotLabel={modalRow?.plot_name || modalRow?.id || modalRow?.uid}
                  records={burialRecords}
                  loading={burialLoading}
                  error={burialError}
                  onRefresh={() => loadBurialForPlot({ plot_id: modalRow?.id, plot_uid: modalRow?.uid })}
                  onAdd={() => {
                    setBurialDraft({
                      plot_id: modalRow?.id || null,
                      deceased_name: modalRow?.person_full_name || "",
                      birth_date: modalRow?.date_of_birth || "",
                      death_date: modalRow?.date_of_death || "",
                      burial_date: "",
                      family_contact: null,
                      headstone_type: "",
                      memorial_text: "",
                      photo_url: modalRow?.photo_url || "",
                      is_active: true,
                    });
                    setBurialDialogOpen(true);
                  }}
                  onEdit={(r) => {
                    setBurialDraft({
                      ...r,
                      plot_id: r.plot_id ?? modalRow?.id ?? null,
                    });
                    setBurialDialogOpen(true);
                  }}
                  onDelete={async (r) => {
                    const idOrUid = r?.id ?? r?.uid;
                    if (!idOrUid) return;
                    if (!window.confirm("Delete this burial record?")) return;

                    await removeBurialRecord(idOrUid);
                    await fetchPlots();
                    await loadBurialForPlot({ plot_id: modalRow?.id, plot_uid: modalRow?.uid });
                  }}
                />

                {visitorUsersError ? (
                  <Alert variant="destructive" className="border-rose-200">
                    <AlertTitle className="flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Visitor users list failed
                    </AlertTitle>
                    <AlertDescription className="break-words">{visitorUsersError}</AlertDescription>
                  </Alert>
                ) : null}
              </div>

              <div className="lg:col-span-2 overflow-auto pr-1 space-y-4">
                <QrPanel
                  title="Grave QR Code"
                  hasToken={Boolean(resolvedToken)}
                  dataUrl={qrDataUrl}
                  downloadName={`grave-qr-${modalRow.id || modalRow.uid || "plot"}.png`}
                  hint="Print this QR and place it on the grave marker."
                  onEditToken={() => setQrEditOpen(true)}
                />

                {qrErr ? (
                  <Alert variant="destructive" className="border-rose-200">
                    <AlertTitle className="flex items-center gap-2">
                      <TriangleAlert className="h-4 w-4" />
                      QR generation failed
                    </AlertTitle>
                    <AlertDescription className="break-words">
                      {qrErr}
                      <div className="mt-2 text-xs text-rose-700">
                        Install dependency:{" "}
                        <code className="px-1 py-0.5 bg-rose-50 rounded">npm i qrcode</code>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : null}

                <ReservationsPanel
                  plotLabel={modalRow?.plot_name || modalRow?.id || modalRow?.uid}
                  reservations={plotReservations}
                  loading={resLoading}
                  error={resError}
                  focusReservationId={focusReservationId}
                  onRefresh={() => loadReservationsForPlot({ id: modalRow?.id, uid: modalRow?.uid })}
                  onCancel={async (reservationId) => {
                    await cancelReservationAdmin(reservationId);
                    await fetchPlots();
                    await refreshPendingRequests();
                    await loadReservationsForPlot({ id: modalRow?.id, uid: modalRow?.uid });
                  }}
                  onValidatePayment={async (reservationId) => {
                    await validatePaymentAdmin(reservationId);
                    await fetchPlots();
                    await refreshPendingRequests();
                    await loadReservationsForPlot({ id: modalRow?.id, uid: modalRow?.uid });
                  }}
                  onApprovePayment={async (reservationId) => {
                    await approvePaymentAdmin(reservationId);
                    await fetchPlots();
                    await refreshPendingRequests();
                    await loadReservationsForPlot({ id: modalRow?.id, uid: modalRow?.uid });
                  }}
                  onReject={async (reservationId) => {
                    await rejectReservationAdmin(reservationId);
                    await fetchPlots();
                    await refreshPendingRequests();
                    await loadReservationsForPlot({ id: modalRow?.id, uid: modalRow?.uid });
                  }}
                />

                <Card className="bg-white/80 backdrop-blur border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Location on Map</CardTitle>
                    <CardDescription>
                      Selected plot is highlighted in <span className="text-blue-600 font-medium">blue</span>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] rounded-md overflow-hidden border-2 border-blue-500 ring-2 ring-blue-200">
                      <CemeteryMapMemo
                        center={modalMapCenter}
                        zoom={modalMapZoom}
                        clickable={true}
                        restrictToGeofence={true}
                        polygons={modalPolygons}
                        showLegend={false}
                        polylines={roadLines}
                        markers={EMPTY_ARR}
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                    Close
                  </Button>
                  <Button type="submit">Save</Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <QrTokenEditorDialog
        open={qrEditOpen}
        onOpenChange={setQrEditOpen}
        initialToken={modalRow?.qr_token || ""}
        autoToken={autoTokenForModalRow}
        onSave={(nextToken) => {
          setModalRow((m) => (m ? { ...m, qr_token: nextToken || null } : m));
          toast.success("QR token updated in this form.");
          setQrEditOpen(false);
        }}
      />

      <BurialRecordDialog
        open={burialDialogOpen}
        onOpenChange={setBurialDialogOpen}
        maxToday={maxToday}
        users={visitorUsers}
        initial={burialDraft}
        onSave={async (draft) => {
          const plot_id = modalRow?.id;
          if (!plot_id) throw new Error("Missing plot_id");

          const payload = {
            id: draft?.id ?? undefined,
            uid: draft?.uid ?? undefined,
            plot_id,
            deceased_name: String(draft?.deceased_name || "").trim(),
            birth_date: draft?.birth_date || null,
            death_date: draft?.death_date || null,
            burial_date: draft?.burial_date || null,
            family_contact: draft?.family_contact ? String(draft.family_contact) : null,
            headstone_type: draft?.headstone_type || null,
            memorial_text: draft?.memorial_text || null,
            photo_url: draft?.photo_url || null,
            is_active: typeof draft?.is_active === "boolean" ? draft.is_active : true,
          };

          if (draft?.id || draft?.uid) {
            await updateBurialRecord(draft.id || draft.uid, payload);
          } else {
            await createBurialRecord(payload);
          }

          await fetchPlots();
          await loadBurialForPlot({ plot_id: modalRow?.id, plot_uid: modalRow?.uid });

          // optional: refresh modalRow from backend (keeps person_full_name/date synced)
          try {
            const details = await fetchPlotDetails(modalRow?.id || modalRow?.uid);
            setModalRow((m) => (m ? { ...m, ...details } : m));
          } catch {}
        }}
      />
    </div>
  );
}
