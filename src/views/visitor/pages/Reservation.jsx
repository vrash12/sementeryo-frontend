// frontend/src/views/visitor/pages/Reservation.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  MapPin,
  CheckCircle2,
  Loader2,
  Search,
  XCircle,
  Info,
  ClipboardList,
  ShieldAlert,
  RefreshCcw,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Trash2,
} from "lucide-react";

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert";

import CemeteryMap, {
  CEMETERY_CENTER as GOOGLE_CENTER,
} from "../../../components/map/CemeteryMap";

import { Toaster, toast } from "sonner";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";
const IMG_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL_IMAGE) ||
  API_BASE;

const DRAFT_KEY = "reservationDraft_v3"; // bumped because we changed draft shape

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
function isFutureYMD(ymd, todayYMD) {
  const v = String(ymd || "").trim();
  if (!v) return false;
  return v > String(todayYMD || "");
}

function isBeforeYMD(a, b) {
  const aa = String(a || "").trim();
  const bb = String(b || "").trim();
  if (!aa || !bb) return false;
  return aa < bb;
}

/* --------------------------- helpers --------------------------- */
const resolveAssetUrl = (p) => {
  if (!p) return null;
  try {
    return new URL(p, IMG_BASE.replace(/\/+$/, "") + "/").toString();
  } catch {
    return p;
  }
};

const buildInquireLink = ({ plotId, reservationId, deceasedName }) => {
  const sp = new URLSearchParams();
  if (plotId != null) sp.set("plot_id", String(plotId));
  if (reservationId != null) sp.set("reservation_id", String(reservationId));
  if (deceasedName) sp.set("deceased_name", String(deceasedName));
  return `/visitor/inquire?${sp.toString()}`;
};

const ENDPOINTS = {
  plots: `${API_BASE}/plot/`,
  reservePlot: `${API_BASE}/visitor/reserve-plot`,
  myReservations: `${API_BASE}/visitor/my-reservations`,
  cancelReservation: (id) =>
    `${API_BASE}/visitor/cancel-reservation/${encodeURIComponent(id)}`,

};

function formatPrice(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function todayISODateLocal() {
  // Returns YYYY-MM-DD in the user's local timezone (safe for <input type="date" />)
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function statusBadgeProps(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "available")
    return {
      label: "Available",
      className: "bg-emerald-600 hover:bg-emerald-600",
    };
  if (s === "reserved")
    return { label: "Reserved", className: "bg-amber-500 hover:bg-amber-500" };
  if (s === "occupied")
    return { label: "Occupied", className: "bg-rose-600 hover:bg-rose-600" };
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
  return {
    label: statusRaw || "—",
    className: "bg-slate-500 hover:bg-slate-500",
  };
}

function centroidOfFeature(feature) {
  try {
    if (!feature?.geometry) return null;
    const geom = feature.geometry;

    if (geom.type === "Point") {
      const [lng, lat] = geom.coordinates || [];
      if (typeof lat === "number" && typeof lng === "number") return [lat, lng];
      return null;
    }

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
    } else {
      return null;
    }

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

function formatBlockLabelValue(label, value) {
  const v = String(value || "").trim();
  if (!v) return null;
  return `${label}: ${v}`;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json")
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => "");

  if (!res.ok) {
    const msg =
      typeof body === "string"
        ? body
        : body?.message || body?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return body;
}

/* --------------------------- UI bits --------------------------- */
function Stepper({ step }) {
  const steps = [
    { n: 1, label: "Enter details", icon: Info, hint: "Visitor & deceased info" },
    { n: 2, label: "Pick on map", icon: MapPin, hint: "Select an available plot" },
    { n: 3, label: "Confirm & submit", icon: ClipboardList, hint: "Review then submit" },
 { n: 4, label: "Wait approval", icon: CheckCircle2, hint: "Admin reviews your request" },
  ];

  const pct =
    steps.length <= 1
      ? 100
      : Math.round(
          ((Math.max(1, Math.min(step, steps.length)) - 1) /
            (steps.length - 1)) *
            100
        );

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">Progress</div>
        <div className="rounded-full border bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-700">
          Step {step}/{steps.length}
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        {steps.map((s) => {
          const Icon = s.icon;
          const active = step === s.n;
          const done = step > s.n;

          return (
            <div
              key={s.n}
              className={[
                "group rounded-2xl border p-3 transition-all",
                "bg-white/75 backdrop-blur",
                done
                  ? "border-emerald-200 shadow-sm"
                  : active
                  ? "border-blue-200 shadow-sm ring-1 ring-blue-200/60"
                  : "border-slate-200 hover:border-slate-300 hover:shadow-sm",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "grid h-10 w-10 place-items-center rounded-2xl border transition",
                    done
                      ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                      : active
                      ? "bg-blue-100 border-blue-200 text-blue-700"
                      : "bg-slate-50 border-slate-200 text-slate-700 group-hover:bg-slate-100",
                  ].join(" ")}
                >
                  {done ? "✓" : <Icon className="h-4 w-4" />}
                </div>

                <div className="min-w-0">
                  <div className="text-[10px] text-slate-500">Step {s.n}</div>
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {s.label}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{s.hint}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
      <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        Available
      </span>
      <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        Reserved
      </span>
      <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
        Occupied
      </span>
      <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
        Selected
      </span>
    </div>
  );
}

function StatPill({ label, value, dotClass }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-white/70 px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <span className={["h-2.5 w-2.5 rounded-full", dotClass].join(" ")} />
        {label}
      </div>
      <div className="text-sm font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}

function StatusTimeline({ status}) {
  const s = String(status || "").toLowerCase();
  const submittedDone = !!status;

  const approvedDone = s === "approved";

  const items = [
    {
      title: "Submitted",
      desc: "Reservation sent to admin",
      done: submittedDone,
      icon: ClipboardList,
    },
 
    {
      title: "Approved",
      desc: "Admin approved your request",
      done: approvedDone,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm font-bold text-slate-900">Progress</div>

      <div className="mt-3 space-y-3">
        {items.map((it, idx) => {
          const Icon = it.icon;
          return (
            <div key={it.title} className="flex items-start gap-3">
              <div
                className={[
                  "mt-0.5 h-8 w-8 rounded-2xl border grid place-items-center",
                  it.done
                    ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                    : "bg-slate-50 border-slate-200 text-slate-600",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">
                    {it.title}
                  </div>
                  <div className="text-xs text-slate-500">
                    {it.done ? "Done" : "Pending"}
                  </div>
                </div>
                <div className="text-xs text-slate-500">{it.desc}</div>

                {idx !== items.length - 1 ? (
                  <div className="mt-3 h-px w-full bg-slate-200/70" />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {s === "rejected" ? (
        <div className="mt-4 rounded-2xl border bg-rose-50 p-3 text-sm text-rose-900">
          <div className="font-semibold">Rejected</div>
          <div className="text-xs text-rose-800 mt-1">
            Please contact the admin for details.
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------- name helpers --------------------------- */
function joinName(first, last) {
  const f = String(first || "").trim();
  const l = String(last || "").trim();
  const full = `${f} ${l}`.trim();
  return full || "";
}

export default function Reservation() {
  const auth = useMemo(() => readAuth(), []);
  const token = useMemo(() => getToken(auth), [auth]);

  const role = auth?.user?.role || null;
  const isVisitorLoggedIn = Boolean(auth?.user && role === "visitor");

  const jsonHeaders = useMemo(() => {
    const h = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

const todayISO = useMemo(() => todayISODateLocal(), []);


  /* =====================================================================================
     ✅ Applicant is now the logged-in visitor.
     - We keep ONLY a small "applicantMeta" state for values not guaranteed in profile
       (relationship is always required; contact/address can be used as fallback overrides).
  ===================================================================================== */
  const visitor = auth?.user || {};

  const visitorFullName = useMemo(() => {
    const direct =
      visitor.full_name ||
      visitor.name ||
      visitor.profile_name ||
      joinName(visitor.first_name, visitor.last_name) ||
      visitor.username ||
      visitor.email ||
      "";
    return String(direct || "").trim();
  }, [visitor]);

  const visitorEmail = useMemo(() => String(visitor.email || "").trim(), [visitor]);

  const visitorPhone = useMemo(() => {
    return String(
      visitor.phone || visitor.contact_number || visitor.contact || visitor.mobile || ""
    ).trim();
  }, [visitor]);

  const visitorAddress = useMemo(() => String(visitor.address || "").trim(), [visitor]);

  const [applicantMeta, setApplicantMeta] = useState({
    relationship: "",
    contact_number: "",
    address: "",
  });

  // deceased info
  const [deceased, setDeceased] = useState({
    full_name: "",
    date_of_death: "",
    date_of_burial: "",
    age: "",
    remarks: "",
  });

  // data
  const [plotsFc, setPlotsFc] = useState(null);
  const [loadingPlots, setLoadingPlots] = useState(false);
  const [plotsError, setPlotsError] = useState("");

 const burialDateInFuture = useMemo(() => {
   return isFutureYMD(deceased.date_of_burial, todayISO);
 }, [deceased.date_of_burial, todayISO]);

 const burialBeforeDeath = useMemo(() => {
   return isBeforeYMD(deceased.date_of_burial, deceased.date_of_death);
 }, [deceased.date_of_burial, deceased.date_of_death]);

  const deathDateInFuture = useMemo(() => {
    const dod = deceased.date_of_death || "";
    if (!dod) return false;
    return dod > todayISO; // YYYY-MM-DD compare works
  }, [deceased.date_of_death, todayISO]);

  // reservations
  const [myReservations, setMyReservations] = useState([]);
  const [loadingReservations, setLoadingReservations] = useState(false);

  // wizard state
  const [step, setStep] = useState(1);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [notes, setNotes] = useState("");

  // reservation created
  const [activeReservation, setActiveReservation] = useState(null);



  // UI state
  const [q, setQ] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // confirm cancel dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState(null);

  // draft saved info
  const [draftStatus, setDraftStatus] = useState("Idle"); // Idle | Restored | Saved

  // map view
  const [mapCenter, setMapCenter] = useState(GOOGLE_CENTER);
  const [mapZoom, setMapZoom] = useState(19);

  // polling for approval
  const pollRef = useRef(null);



  // computed applicant (visitor profile + overrides)
  const applicant = useMemo(() => {
    const contact = String(applicantMeta.contact_number || visitorPhone || "").trim();
    const address = String(applicantMeta.address || visitorAddress || "").trim();
    const relationship = String(applicantMeta.relationship || "").trim();

    return {
      full_name: visitorFullName,
      email: visitorEmail,
      contact_number: contact,
      address,
      relationship,
      _source: {
        hasProfilePhone: Boolean(visitorPhone),
        hasProfileAddress: Boolean(visitorAddress),
      },
    };
  }, [applicantMeta, visitorPhone, visitorAddress, visitorEmail, visitorFullName]);

  // scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // restore draft (once)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);

      // applicantMeta
      if (d?.applicantMeta) {
        setApplicantMeta((prev) => ({ ...prev, ...d.applicantMeta }));
      } else if (d?.applicant) {
        // backward support
        setApplicantMeta((prev) => ({
          ...prev,
          relationship: d?.applicant?.relationship ?? prev.relationship,
          contact_number: d?.applicant?.contact_number ?? prev.contact_number,
          address: d?.applicant?.address ?? prev.address,
        }));
      }

      if (d?.deceased) {
        const safeDeceased = { ...d.deceased };

        const today = todayISODateLocal();
        if (safeDeceased.date_of_death && String(safeDeceased.date_of_death) > today) {
          safeDeceased.date_of_death = "";
        }

        setDeceased((prev) => ({ ...prev, ...safeDeceased }));
      }

      if (typeof d?.notes === "string") setNotes(d.notes);
      if (typeof d?.onlyAvailable === "boolean") setOnlyAvailable(d.onlyAvailable);

      setDraftStatus("Restored");
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autosave draft (debounced)
  const draftTimerRef = useRef(null);
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            applicantMeta,
            deceased,
            notes,
            onlyAvailable,
            savedAt: new Date().toISOString(),
          })
        );
        setDraftStatus("Saved");
      } catch {
        // ignore
      }
    }, 450);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [applicantMeta, deceased, notes, onlyAvailable]);

  const normalizeGeoJson = (body) => {
    if (body?.type === "FeatureCollection") return body;
    if (body?.data?.type === "FeatureCollection") return body.data;
    return body;
  };

  const fetchPlots = useCallback(async () => {
    if (!API_BASE) {
      setPlotsError("Missing VITE_API_BASE_URL. Please configure your .env.");
      return;
    }

    setLoadingPlots(true);
    setPlotsError("");
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const body = await fetchJson(ENDPOINTS.plots, { headers });
      setPlotsFc(normalizeGeoJson(body));
    } catch (e) {
      setPlotsError(e?.message || "Failed to load plots.");
    } finally {
      setLoadingPlots(false);
    }
  }, [token]);

  const fetchMyReservations = useCallback(async () => {
    if (!isVisitorLoggedIn) return [];
    setLoadingReservations(true);
    try {
      const body = await fetchJson(ENDPOINTS.myReservations, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const list = Array.isArray(body) ? body : body?.data || [];
      const safe = Array.isArray(list) ? list : [];
      setMyReservations(safe);
      return safe;
    } catch (e) {
      toast.error(e?.message || "Failed to load reservations.");
      return [];
    } finally {
      setLoadingReservations(false);
    }
  }, [isVisitorLoggedIn, token]);

  useEffect(() => {
    fetchPlots();
  }, [fetchPlots]);

  useEffect(() => {
    fetchMyReservations();
  }, [fetchMyReservations]);

  // derived rows (list helper)
  const rows = useMemo(() => {
    if (!plotsFc?.features) return [];
    return plotsFc.features
      .map((f) => {
        const p = f.properties || {};
        const c = centroidOfFeature(f);

        return {
          id: p.id != null ? String(p.id) : undefined,
          uid: p.uid != null ? String(p.uid) : undefined,
          plot_name: p.plot_name ?? p.plot_code ?? "—",
          plot_type: p.plot_type ?? "—",
          size_sqm: p.size_sqm ?? "—",
          price: p.price ?? null,
          status: p.status ?? "—",
          lat: c ? c[0] : null,
          lng: c ? c[1] : null,
          _feature: f,
        };
      })
      .filter(Boolean);
  }, [plotsFc]);

  const plotCounts = useMemo(() => {
    const counts = { available: 0, reserved: 0, occupied: 0, total: rows.length };
    for (const r of rows) {
      const s = String(r.status || "").toLowerCase();
      if (s === "available") counts.available++;
      else if (s === "reserved") counts.reserved++;
      else if (s === "occupied") counts.occupied++;
    }
    return counts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const text = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (onlyAvailable) {
          const s = String(r.status || "").toLowerCase();
          if (s !== "available") return false;
        }
        if (!text) return true;
        return (
          String(r.id || "").toLowerCase().includes(text) ||
          String(r.uid || "").toLowerCase().includes(text) ||
          String(r.plot_name || "").toLowerCase().includes(text) ||
          String(r.plot_type || "").toLowerCase().includes(text) ||
          String(r.status || "").toLowerCase().includes(text) ||
          String(r.price ?? "").toLowerCase().includes(text)
        );
      })
      .slice(0, 70);
  }, [rows, q, onlyAvailable]);

  // polygons for map (GRAVES ONLY ✅)
  const plotPolygons = useMemo(() => {
    if (!plotsFc?.features) return [];
    const selectedKey = selectedPlot?.id ?? selectedPlot?.uid ?? null;

    return plotsFc.features
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

        const props = f.properties || {};
        const status = String(props.status || "").toLowerCase();

        let fillColor = "#10b981"; // available
        if (status === "reserved") fillColor = "#f59e0b";
        else if (status === "occupied") fillColor = "#ef4444";

        const id = props.id != null ? String(props.id) : undefined;
        const uid = props.uid != null ? String(props.uid) : undefined;

        const isSelected =
          selectedKey != null &&
          (String(selectedKey) === String(id) || String(selectedKey) === String(uid));

        const base = {
          strokeColor: fillColor,
          strokeOpacity: 1,
          strokeWeight: 1.2,
          fillColor,
          fillOpacity: 0.45,
        };

        const dimNonAvailable =
          onlyAvailable && status !== "available"
            ? { strokeOpacity: 0.25, fillOpacity: 0.08 }
            : {};

        const selectedStyle = isSelected
          ? {
              strokeColor: "#2563eb",
              strokeOpacity: 1,
              strokeWeight: 4,
              fillColor: "#60a5fa",
              fillOpacity: 0.65,
              zIndex: 999,
            }
          : {};

        const dimStyle =
          selectedKey != null && !isSelected
            ? {
                strokeOpacity: Math.min(base.strokeOpacity ?? 1, 0.35),
                fillOpacity: Math.min(base.fillOpacity ?? 0.45, 0.14),
              }
            : {};

        const c = centroidOfFeature(f);
        const lat = c ? c[0] : null;
        const lng = c ? c[1] : null;

        return {
          id,
          uid,
          plot_name: props.plot_name ?? props.plot_code ?? "—",
          plot_type: props.plot_type ?? "—",
          size_sqm: props.size_sqm ?? "—",
          price: props.price ?? null,
          status: props.status ?? "—",
          lat,
          lng,
          _feature: f,
          path: coords,
          options: { ...base, ...dimNonAvailable, ...dimStyle, ...selectedStyle },
        };
      })
      .filter(Boolean);
  }, [plotsFc, selectedPlot, onlyAvailable]);

  const canReserve = useMemo(() => {
    if (!selectedPlot) return false;
    return String(selectedPlot.status || "").toLowerCase() === "available";
  }, [selectedPlot]);

  const findPolygonByPlotId = useCallback(
    (plotId) => {
      if (!plotId) return null;
      const pid = String(plotId);
      return plotPolygons.find((p) => p?.id != null && String(p.id) === pid) || null;
    },
    [plotPolygons]
  );

  const requiredMissing = useMemo(() => {
    const missing = [];

    if (!String(applicant.full_name || "").trim()) missing.push("Your profile name");
    if (!String(applicant.relationship || "").trim())
      missing.push("Relationship to deceased");
    if (!String(applicant.contact_number || "").trim())
      missing.push("Your profile contact number (or provide one below)");
    if (!String(deceased.full_name || "").trim()) missing.push("Deceased full name");

    return missing;
  }, [applicant.full_name, applicant.relationship, applicant.contact_number, deceased.full_name]);


  const infoValid = useMemo(() => {
  const requiredOk =
    String(applicant.full_name || "").trim().length > 0 &&
    String(applicant.relationship || "").trim().length > 0 &&
    String(applicant.contact_number || "").trim().length > 0 &&
    String(deceased.full_name || "").trim().length > 0;

  const deathDateOk = !deathDateInFuture;
  const burialDateOk = !burialDateInFuture;

  // Optional but recommended: if both exist, burial must not be earlier than death
  const orderOk = !burialBeforeDeath;

  return requiredOk && deathDateOk && burialDateOk && orderOk;
}, [
  applicant.full_name,
  applicant.relationship,
  applicant.contact_number,
  deceased.full_name,
  deathDateInFuture,
  burialDateInFuture,
  burialBeforeDeath,
]);

  const dateWarning = useMemo(() => {
    const dod = deceased.date_of_death ? new Date(deceased.date_of_death) : null;
    const dob = deceased.date_of_burial ? new Date(deceased.date_of_burial) : null;
    if (!dod || !dob) return "";
    if (Number.isNaN(dod.getTime()) || Number.isNaN(dob.getTime())) return "";
    if (dob.getTime() < dod.getTime())
      return "Date of burial looks earlier than date of death.";
    return "";
  }, [deceased.date_of_death, deceased.date_of_burial]);

  const composedNotesForSubmit = useMemo(() => {
    const a = applicant || {};
    const d = deceased || {};

    const lines = [
      "Visitor (Applicant) Details",
      formatBlockLabelValue("Full name", a.full_name),
      formatBlockLabelValue("Relationship", a.relationship),
      formatBlockLabelValue("Contact number", a.contact_number),
      formatBlockLabelValue("Email", a.email),
      formatBlockLabelValue("Address", a.address),
      "",
      "Deceased Details",
      formatBlockLabelValue("Full name", d.full_name),
      formatBlockLabelValue("Age", d.age),
      formatBlockLabelValue("Date of death", d.date_of_death),
      formatBlockLabelValue("Date of burial", d.date_of_burial),
      formatBlockLabelValue("Remarks", d.remarks),
    ].filter((x) => x !== null);

    const cleanedBlock = lines
      .map((x) => String(x))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const extra = String(notes || "").trim();

    if (!cleanedBlock && !extra) return "";
    if (cleanedBlock && !extra) return cleanedBlock;
    if (!cleanedBlock && extra) return extra;
    return `${cleanedBlock}\n\nVisitor Notes\n${extra}`;
  }, [applicant, deceased, notes]);

  /* ---------------- selection actions ---------------- */
  const selectFromList = useCallback((row) => {
    if (!row) return;

    const s = String(row.status || "").toLowerCase();
    if (s !== "available") {
      toast.error("This plot is not available.");
      return;
    }

    setSelectedPlot(row);
    setActiveReservation(null);


    if (row.lat != null && row.lng != null) {
      setMapCenter({ lat: Number(row.lat), lng: Number(row.lng) });
      setMapZoom(21);
    }

    toast.success("Plot selected. Click Continue to confirm.");
  }, []);

  const pickPlotOnMap = useCallback((plot) => {
    if (!plot) return;

    const s = String(plot.status || "").toLowerCase();
    if (s !== "available") {
      toast.error("This plot is not available.");
      return;
    }

    setSelectedPlot(plot);
    setActiveReservation(null);


    if (plot.lat != null && plot.lng != null) {
      setMapCenter({ lat: Number(plot.lat), lng: Number(plot.lng) });
      setMapZoom(21);
    }

    toast.success("Plot selected. Click Continue to confirm.");
  }, []);

  const goToMapStep = useCallback(() => {
    if (!isVisitorLoggedIn) return toast.error("Please login as visitor.");
    if (!infoValid) {
      toast.error("Please complete the required details first.");
      return;
    }
    setStep(2);
    toast("Now pick an available plot on the map.");
  }, [infoValid, isVisitorLoggedIn]);

  const goToConfirmStep = useCallback(() => {
    if (!isVisitorLoggedIn) return toast.error("Please login as visitor.");
    if (!infoValid) return toast.error("Please complete the required details first.");
    if (!selectedPlot) return toast.error("Pick an available plot on the map first.");
    if (!canReserve) return toast.error("This plot is not available anymore.");

    const poly = findPolygonByPlotId(selectedPlot.id) || selectedPlot;
    if (poly?.lat != null && poly?.lng != null) {
      setMapCenter({ lat: Number(poly.lat), lng: Number(poly.lng) });
      setMapZoom(21);
    }

    setStep(3);
  }, [canReserve, findPolygonByPlotId, infoValid, isVisitorLoggedIn, selectedPlot]);

  const submitReservation = useCallback(async () => {
    if (!isVisitorLoggedIn) {
      toast.error("Please login as visitor.");
      return;
    }
    if (!infoValid) {
      toast.error("Please complete the required details first.");
      return;
    }
    const plot_id = selectedPlot?.id ?? selectedPlot?._feature?.properties?.id;
    if (!plot_id) {
      toast.error("Missing plot_id.");
      return;
    }

    setSubmitting(true);
    try {
      const body = await fetchJson(ENDPOINTS.reservePlot, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ plot_id, notes: composedNotesForSubmit || "" }),
      });

      const reservation = body?.data || body;
      setActiveReservation(reservation);
      setStep(4);

    toast.success("Reservation submitted! Please wait for admin approval.");
      await fetchPlots();
      await fetchMyReservations();
    } catch (e) {
      toast.error(e?.message || "Failed to reserve plot.");
    } finally {
      setSubmitting(false);
    }
  }, [composedNotesForSubmit, fetchMyReservations, fetchPlots, infoValid, isVisitorLoggedIn, jsonHeaders, selectedPlot]);

  const cancelReservation = useCallback(
    async (reservationId) => {
      if (!reservationId) return;

      setSubmitting(true);
      try {
        await fetchJson(ENDPOINTS.cancelReservation(reservationId), {
          method: "PATCH",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        toast.success("Reservation cancelled.");

        setStep(1);
        setSelectedPlot(null);
        setActiveReservation(null);
        setNotes("");
   
        setMapCenter(GOOGLE_CENTER);
        setMapZoom(19);

        await fetchPlots();
        await fetchMyReservations();
      } catch (e) {
        toast.error(e?.message || "Failed to cancel.");
      } finally {
        setSubmitting(false);
        setCancelOpen(false);
        setCancelTargetId(null);
      }
    },
    [fetchMyReservations, fetchPlots, token]
  );

  /* ---------------- approval polling (Step 4) ---------------- */
  const activeReservationStatus = useMemo(() => {
    const status = activeReservation?.status || "";
    return String(status).toLowerCase();
  }, [activeReservation]);

  const refreshActiveReservationFromList = useCallback(async () => {
    if (!activeReservation?.id) return;
    const list = await fetchMyReservations();
    const found = (list || myReservations || []).find(
      (r) => String(r.id) === String(activeReservation.id)
    );
    if (found) setActiveReservation(found);
  }, [activeReservation?.id, fetchMyReservations, myReservations]);

  useEffect(() => {
    if (step !== 4) return;
    if (!activeReservation?.id) return;

    const s = String(activeReservation?.status || "").toLowerCase();
    if (s !== "pending") return;

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      refreshActiveReservationFromList();
    }, 8000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [activeReservation?.id, activeReservation?.status, refreshActiveReservationFromList, step]);

  /* ---------------- receipt upload ---------------- */




  const resetAll = () => {
    setStep(1);
    setSelectedPlot(null);
    setActiveReservation(null);
    setNotes("");
    setQ("");
    setOnlyAvailable(true);

    setMapCenter(GOOGLE_CENTER);
    setMapZoom(19);

    setApplicantMeta({
      relationship: "",
      contact_number: "",
      address: "",
    });

    setDeceased({
      full_name: "",
      date_of_death: "",
      date_of_burial: "",
      age: "",
      remarks: "",
    });

    try {
      localStorage.removeItem(DRAFT_KEY);
      setDraftStatus("Idle");
    } catch {
      // ignore
    }
  };

  const openReservation = useCallback(
    (r) => {
      setActiveReservation(r);
      setStep(4);

      const poly = findPolygonByPlotId(r?.plot_id);
      if (poly) {
        setSelectedPlot(poly);
        if (poly.lat != null && poly.lng != null) {
          setMapCenter({ lat: Number(poly.lat), lng: Number(poly.lng) });
          setMapZoom(21);
        }
      }

      toast("Opened reservation status.");
    },
    [findPolygonByPlotId]
  );

  const viewOnMapFromStatus = useCallback(() => {
    const pid = activeReservation?.plot_id;
    const poly = findPolygonByPlotId(pid);

    if (poly) {
      setSelectedPlot(poly);
      if (poly?.lat != null && poly?.lng != null) {
        setMapCenter({ lat: Number(poly.lat), lng: Number(poly.lng) });
        setMapZoom(21);
      }
      setStep(2);
      toast("Viewing plot on map.");
    } else {
      toast.error("Plot not found on map yet.");
    }
  }, [activeReservation?.plot_id, findPolygonByPlotId]);

  const selectedBadge = selectedPlot ? statusBadgeProps(selectedPlot.status) : null;
  const activeBadge = activeReservation ? statusBadgeProps(activeReservation.status) : null;

 


  const isPending = String(activeReservation?.status || "").toLowerCase() === "pending";
  const isApproved = String(activeReservation?.status || "").toLowerCase() === "approved";
  const isRejected = String(activeReservation?.status || "").toLowerCase() === "rejected";

  const derivedDeceasedNameForLink = useMemo(() => {
    const direct = String(deceased.full_name || "").trim();
    if (direct) return direct;

    try {
      const raw = localStorage.getItem("lastApprovedReservation");
      if (!raw) return "";
      const j = JSON.parse(raw);
      return String(j?.deceased_name || "").trim();
    } catch {
      return "";
    }
  }, [deceased.full_name]);

  useEffect(() => {
    if (!activeReservation?.id) return;
    const s = String(activeReservation.status || "").toLowerCase();
    if (s !== "approved") return;

    try {
      localStorage.setItem(
        "lastApprovedReservation",
        JSON.stringify({
          id: activeReservation.id,
          plot_id: activeReservation.plot_id,
          deceased_name: deceased.full_name || "",
          saved_at: new Date().toISOString(),
        })
      );
    } catch {
      // ignore
    }
  }, [activeReservation?.id, activeReservation?.status, activeReservation?.plot_id, deceased.full_name]);

  return (
    <div className="relative min-h-screen font-poppins pb-24 lg:pb-0">
      <Toaster richColors expand={false} />

      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 via-cyan-50 to-blue-100" />
        <div className="absolute -top-24 -left-24 h-[32rem] w-[32rem] rounded-full bg-emerald-300/50 blur-3xl" />
        <div className="absolute top-1/3 right-0 h-[28rem] w-[28rem] rounded-full bg-cyan-300/50 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 h-[24rem] w-[24rem] rounded-full bg-blue-300/40 blur-3xl" />
      </div>

      <section className="pt-24 pb-6">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-2 text-sm text-slate-500">
            <NavLink to="/visitor/home" className="hover:text-slate-700">
              Home
            </NavLink>
            &nbsp;›&nbsp;<span className="text-slate-700">Reservation Wizard</span>
          </div>

          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-br from-emerald-400/25 via-cyan-400/20 to-blue-400/25 rounded-2xl blur-xl opacity-40" />
            <Card className="relative overflow-hidden border-white/60 bg-white/80 backdrop-blur shadow-lg rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/15 via-cyan-400/10 to-blue-400/15" />
              <CardHeader className="relative">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-2xl sm:text-3xl text-slate-900 flex items-center gap-2">
                      Burial Plot Reservation
                      <Sparkles className="h-5 w-5 text-emerald-700" />
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                   Visitor info → deceased details → pick plot → confirm → wait admin approval.
                    </CardDescription>
                    <div className="mt-2 text-xs text-slate-500">
                      Draft:{" "}
                      <span className="font-semibold text-slate-700">
                        {draftStatus === "Idle" ? "Not saved yet" : draftStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={fetchPlots}
                      disabled={loadingPlots}
                      className="rounded-xl"
                      title="Refresh plots"
                    >
                      <RefreshCcw
                        className={[
                          "h-4 w-4 mr-2",
                          loadingPlots ? "animate-spin" : "",
                        ].join(" ")}
                      />
                      Refresh plots
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetAll}
                      className="rounded-xl"
                      title="Clear everything (also clears draft)"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear all
                    </Button>
                  </div>
                </div>

                <Stepper step={step} />

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatPill label="Total plots" value={plotCounts.total} dotClass="bg-slate-400" />
                  <StatPill label="Available" value={plotCounts.available} dotClass="bg-emerald-500" />
                  <StatPill label="Reserved" value={plotCounts.reserved} dotClass="bg-amber-400" />
                  <StatPill label="Occupied" value={plotCounts.occupied} dotClass="bg-rose-500" />
                </div>

                {step === 2 ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <Legend />
                    <div className="text-xs text-slate-500">
                      Tip: Click an <span className="font-semibold">available</span> plot on the map to select it.
                    </div>
                  </div>
                ) : step === 1 ? (
                  <div className="mt-4 rounded-2xl border bg-white/70 p-3 text-sm text-slate-700 flex gap-2">
                    <Info className="h-4 w-4 mt-0.5 text-slate-500" />
                    Step 1 is required. Your visitor info is auto-filled. Please complete the deceased details and relationship.
                  </div>
                ) : step === 3 ? (
                  <div className="mt-4 rounded-2xl border bg-white/70 p-3 text-sm text-slate-700 flex gap-2">
                    <Info className="h-4 w-4 mt-0.5 text-slate-500" />
                    Step 3 is confirmation. You can still go back and edit details or change plot.
                  </div>
                ) : null}
              </CardHeader>
            </Card>
          </div>

          {!API_BASE ? (
            <div className="mt-4">
              <Alert
                variant="destructive"
                className="bg-rose-50/90 backdrop-blur border-rose-200 shadow-md rounded-2xl"
              >
                <AlertTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Missing API configuration
                </AlertTitle>
                <AlertDescription className="text-rose-700">
                  Set <b>VITE_API_BASE_URL</b> in your frontend environment.
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          {!isVisitorLoggedIn && (
            <div className="mt-4">
              <Alert
                variant="destructive"
                className="bg-rose-50/90 backdrop-blur border-rose-200 shadow-md rounded-2xl"
              >
                <AlertTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Login required
                </AlertTitle>
                <AlertDescription className="text-rose-700">
                  Please login as a visitor to reserve
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </section>

      <section className="pb-10">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* STEP 1: DETAILS FORM */}
            {step === 1 && (
              <Card className="rounded-2xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-5 w-5 text-emerald-700" />
                    Step 1: Visitor & deceased details
                  </CardTitle>
                  <CardDescription>
                    Visitor info is auto-filled from your logged-in account. Please complete relationship and deceased info.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {!infoValid && requiredMissing.length > 0 ? (
                    <div className="rounded-2xl border bg-amber-50 p-3 text-sm text-amber-900">
                      <div className="font-semibold">Required fields missing</div>
                      <div className="text-xs text-amber-800 mt-1">
                        {requiredMissing.join(", ")}
                      </div>
                    </div>
                  ) : null}

                  {dateWarning ? (
                    <div className="rounded-2xl border bg-amber-50 p-3 text-sm text-amber-900">
                      <div className="font-semibold">Check your dates</div>
                      <div className="text-xs text-amber-800 mt-1">{dateWarning}</div>
                    </div>
                  ) : null}

                  {deathDateInFuture ? (
                    <div className="rounded-2xl border bg-rose-50 p-3 text-sm text-rose-900">
                      <div className="font-semibold">Invalid date of death</div>
                      <div className="text-xs text-rose-800 mt-1">
                        Date of death cannot be later than today ({todayISO}).
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Visitor card */}
                    <div className="rounded-2xl border bg-white p-4 space-y-3">
                      <div className="text-sm font-bold text-slate-900">Visitor (logged-in)</div>

                      <div className="rounded-2xl border bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Full name</div>
                        <div className="font-semibold text-slate-900 break-words">
                          {applicant.full_name || "—"}
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Email</div>
                        <div className="font-semibold text-slate-900 break-words">
                          {applicant.email || "—"}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>
                          Relationship to deceased <span className="text-rose-600">*</span>
                        </Label>
                        <Input
                          value={applicantMeta.relationship}
                          onChange={(e) =>
                            setApplicantMeta((v) => ({ ...v, relationship: e.target.value }))
                          }
                          placeholder="Son, Daughter, Spouse, Relative"
                          className="rounded-xl"
                        />
                      </div>

                      {applicant._source?.hasProfilePhone ? (
                        <div className="rounded-2xl border bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">Contact number</div>
                          <div className="font-semibold text-slate-900 break-words">
                            {applicant.contact_number || "—"}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            Pulled from your profile. Update your account profile if incorrect.
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label>
                            Contact number <span className="text-rose-600">*</span>
                          </Label>
                          <Input
                            value={applicantMeta.contact_number}
                            onChange={(e) =>
                              setApplicantMeta((v) => ({ ...v, contact_number: e.target.value }))
                            }
                            placeholder="09xx xxx xxxx"
                            className="rounded-xl"
                            inputMode="tel"
                          />
                          <div className="text-[11px] text-slate-500">
                            Your profile has no contact number. Provide one here so the admin can reach you.
                          </div>
                        </div>
                      )}

                      {applicant._source?.hasProfileAddress ? (
                        <div className="rounded-2xl border bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">Address</div>
                          <div className="font-semibold text-slate-900 break-words">
                            {applicant.address || "—"}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label>Address (optional)</Label>
                          <Input
                            value={applicantMeta.address}
                            onChange={(e) =>
                              setApplicantMeta((v) => ({ ...v, address: e.target.value }))
                            }
                            placeholder="City, Province"
                            className="rounded-xl"
                          />
                        </div>
                      )}

                      <div className="rounded-2xl border bg-white/70 p-3 text-sm text-slate-700 flex gap-2">
                        <Info className="h-4 w-4 mt-0.5 text-slate-500" />
                        Visitor fields come from your logged-in account. Relationship is required for this request.
                      </div>
                    </div>

                    {/* Deceased details */}
                    <div className="rounded-2xl border bg-white p-4 space-y-3">
                      <div className="text-sm font-bold text-slate-900">Deceased details</div>

                      <div className="space-y-1.5">
                        <Label>
                          Full name <span className="text-rose-600">*</span>
                        </Label>
                        <Input
                          value={deceased.full_name}
                          onChange={(e) =>
                            setDeceased((v) => ({ ...v, full_name: e.target.value }))
                          }
                          placeholder="Maria Dela Cruz"
                          className="rounded-xl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Age</Label>
                        <Input
                          value={deceased.age}
                          onChange={(e) => setDeceased((v) => ({ ...v, age: e.target.value }))}
                          placeholder="Optional"
                          className="rounded-xl"
                          inputMode="numeric"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Date of death</Label>
                          <Input
                            type="date"
                            value={deceased.date_of_death}
                            max={todayISO}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v && v > todayISO) {
                                toast.error(
                                  `Date of death cannot be in the future. Max allowed is ${todayISO}.`
                                );
                                return;
                              }
                              setDeceased((prev) => ({ ...prev, date_of_death: v }));
                            }}
                            className="rounded-xl"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Date of burial</Label>
                          <Input
                            type="date"
                            value={deceased.date_of_burial}
                            onChange={(e) =>
                              setDeceased((v) => ({ ...v, date_of_burial: e.target.value }))
                            }
                            className="rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Remarks</Label>
                        <Input
                          value={deceased.remarks}
                          onChange={(e) =>
                            setDeceased((v) => ({ ...v, remarks: e.target.value }))
                          }
                          placeholder="Optional notes"
                          className="rounded-xl"
                        />
                      </div>

                      <div className="rounded-2xl border bg-white/70 p-3 text-sm text-slate-700 flex gap-2">
                        <Info className="h-4 w-4 mt-0.5 text-slate-500" />
                        These details will be included in the reservation notes sent to the admin.
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setDetailsOpen(true)}
                    >
                      Preview details
                    </Button>

                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                      onClick={goToMapStep}
                      disabled={!isVisitorLoggedIn || !infoValid}
                      title={
                        !isVisitorLoggedIn
                          ? "Login required"
                          : !infoValid
                          ? "Complete required fields"
                          : ""
                      }
                    >
                      Continue to map
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* STEP 2: MAP PICK (GRAVES ONLY ✅ no roads) */}
            {step === 2 && (
              <Card className="overflow-hidden rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-emerald-700" />
                    Step 2: Pick a grave on the map
                  </CardTitle>
                  <CardDescription>
                    Click an <span className="font-semibold">available</span> plot to select it. Optional:
                    use search below.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {plotsError ? (
                    <Alert variant="destructive" className="border-rose-200 rounded-2xl">
                      <AlertTitle className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Failed to load plots
                      </AlertTitle>
                      <AlertDescription className="break-words">{plotsError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="h-[60vh] rounded-2xl overflow-hidden border relative bg-white shadow-sm">
                    {loadingPlots ? (
                      <div className="absolute inset-0 grid place-items-center text-slate-600">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Loading plots…
                        </div>
                      </div>
                    ) : (
                      <CemeteryMap
                        center={mapCenter}
                        zoom={mapZoom}
                        clickable={true}
                        showGeofence={true}
                        restrictToGeofence={true}
                        polygons={plotPolygons}
                        polylines={[]} // ✅ REMOVED yellow road lines (graves only)
                        markers={[]}
                        onEditPlot={(poly) => pickPlotOnMap(poly)}
                        showInitialRoads={false} // ✅ ensure default roads stay hidden
                      />
                    )}
                  </div>

                  <div className="rounded-2xl border bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <Search className="h-4 w-4 text-slate-700" />
                        Search plots (optional)
                      </div>

                      <Button
                        type="button"
                        variant={onlyAvailable ? "default" : "outline"}
                        size="sm"
                        onClick={() => setOnlyAvailable((v) => !v)}
                        disabled={loadingPlots}
                        className="rounded-full"
                        title="Filter on map and list"
                      >
                        Only Available: {onlyAvailable ? "On" : "Off"}
                      </Button>
                    </div>

                    <div className="relative">
                      <Label>Search</Label>
                      <div className="relative mt-1.5">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder="e.g. S7, grave_double, available…"
                          className="pl-9 rounded-xl"
                          disabled={loadingPlots}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div>
                        Showing{" "}
                        <span className="font-semibold text-slate-700">{filteredRows.length}</span>{" "}
                        result(s)
                      </div>
                      {loadingPlots ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Loading…
                        </span>
                      ) : null}
                    </div>

                    <div className="max-h-[340px] overflow-auto rounded-2xl border bg-white">
                      {filteredRows.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500">No plots found.</div>
                      ) : (
                        <ul className="divide-y">
                          {filteredRows.map((r) => {
                            const badge = statusBadgeProps(r.status);
                            const key = `${r.id || ""}-${r.uid || ""}-${r.plot_name || ""}`;
                            const isSelected =
                              selectedPlot &&
                              ((r.id && selectedPlot.id && String(r.id) === String(selectedPlot.id)) ||
                                (r.uid && selectedPlot.uid && String(r.uid) === String(selectedPlot.uid)));

                            return (
                              <li
                                key={key}
                                className={[
                                  "p-3 transition-all",
                                  "hover:bg-slate-50",
                                  isSelected ? "bg-blue-50 ring-1 ring-blue-200/70" : "",
                                ].join(" ")}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className="text-sm font-bold text-slate-900 truncate">
                                        {r.plot_name ?? "—"}
                                      </div>
                                      {isSelected ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                          Selected
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5">
                                        {r.plot_type ?? "—"}
                                      </span>
                                      <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5">
                                        {r.size_sqm ?? "—"} sqm
                                      </span>
                                      <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 font-semibold text-slate-700">
                                        ₱{formatPrice(r.price)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end gap-2">
                                    <Badge className={badge.className}>{badge.label}</Badge>

                                    <Button
                                      type="button"
                                      size="sm"
                                      className="rounded-xl"
                                      onClick={() => selectFromList(r)}
                                      disabled={
                                        !isVisitorLoggedIn ||
                                        String(r.status || "").toLowerCase() !== "available"
                                      }
                                      title={!isVisitorLoggedIn ? "Login required" : ""}
                                    >
                                      Select
                                    </Button>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-2xl border bg-white/70 p-3 text-sm text-slate-700 flex gap-2">
                      <Info className="h-4 w-4 mt-0.5 text-slate-500" />
                      Select by clicking the map or selecting from the list. Then press Continue.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => setStep(1)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to details
                      </Button>

                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                        onClick={goToConfirmStep}
                        disabled={!selectedPlot || !canReserve || !isVisitorLoggedIn}
                        title={
                          !isVisitorLoggedIn ? "Login required" : !selectedPlot ? "Select a plot" : ""
                        }
                      >
                        Continue
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* STEP 3: CONFIRM */}
            {step === 3 && (
              <Card className="rounded-2xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-emerald-700" />
                    Step 3: Confirm and submit
                  </CardTitle>
                  <CardDescription>
                    Review your details and selected plot, then submit your reservation.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {!infoValid ? (
                    <Alert variant="destructive" className="border-rose-200 rounded-2xl">
                      <AlertTitle>Complete details first</AlertTitle>
                      <AlertDescription>Please go back to Step 1 and fill the required fields.</AlertDescription>
                    </Alert>
                  ) : !selectedPlot ? (
                    <Alert variant="destructive" className="border-rose-200 rounded-2xl">
                      <AlertTitle>Select a plot first</AlertTitle>
                      <AlertDescription>Please go back to Step 2 and pick on the map.</AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="rounded-2xl border bg-white p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500">Visitor (Applicant)</div>
                            <div className="text-base font-bold text-slate-900 truncate">
                              {applicant.full_name || "—"}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {applicant.relationship || "—"} • {applicant.contact_number || "—"}
                            </div>
                          </div>
                          <Button variant="outline" className="rounded-xl" onClick={() => setStep(1)} disabled={submitting}>
                            Edit details
                          </Button>
                        </div>

                        <div className="rounded-2xl border bg-slate-50 p-3 text-sm">
                          <div className="text-xs text-slate-500">Deceased</div>
                          <div className="font-semibold text-slate-900">{deceased.full_name || "—"}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            {deceased.date_of_death ? `Date of death: ${deceased.date_of_death}` : "Date of death: —"}
                          </div>
                          <div className="text-xs text-slate-600">
                            {deceased.date_of_burial ? `Date of burial: ${deceased.date_of_burial}` : "Date of burial: —"}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-white p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500">Selected plot</div>
                            <div className="text-base font-bold text-slate-900 truncate">
                              {selectedPlot.plot_name ?? "—"}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {selectedPlot.plot_type ?? "—"} • {selectedPlot.size_sqm ?? "—"} sqm • ₱
                              {formatPrice(selectedPlot.price)}
                            </div>
                          </div>
                          <Badge className={statusBadgeProps(selectedPlot.status).className}>
                            {statusBadgeProps(selectedPlot.status).label}
                          </Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button variant="outline" className="rounded-xl" onClick={() => setStep(2)} disabled={submitting}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Change plot
                          </Button>

                          <Button className="rounded-xl" onClick={() => setDetailsOpen(true)} disabled={!selectedPlot}>
                            View preview
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>

                        {!canReserve ? (
                          <div className="mt-3 text-xs text-amber-700">
                            This plot is not available anymore. Please go back and pick another.
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border bg-white p-4">
                        <div className="text-sm font-bold text-slate-900">Extra notes (optional)</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Your visitor/deceased details are included automatically in the notes sent to the admin.
                        </div>

                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Optional extra notes..."
                          disabled={!isVisitorLoggedIn || submitting}
                          className="mt-3 w-full min-h-[120px] rounded-2xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                        />

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button variant="outline" className="rounded-xl" onClick={() => setStep(2)} disabled={submitting}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                          </Button>

                          <Button
                            className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                            onClick={submitReservation}
                            disabled={!isVisitorLoggedIn || submitting || !canReserve}
                          >
                            {submitting ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Submitting…
                              </span>
                            ) : (
                              <>
                                Submit
                                <ArrowRight className="h-4 w-4 ml-2" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* STEP 4: UPLOAD RECEIPT + WAIT APPROVAL */}
            {step === 4 && (
              <Card className="rounded-2xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
               <Loader2 className="h-5 w-5 text-emerald-700" />
                   Step 4: Wait for admin approval
                  </CardTitle>
                  <CardDescription>
                   Admin will review your reservation. Auto-refresh runs every ~8 seconds while pending.
                   </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {!activeReservation ? (
                    <Alert className="rounded-2xl">
                      <AlertTitle>No active reservation</AlertTitle>
                      <AlertDescription>
                        Submit a reservation first to wait for approval.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <StatusTimeline status={activeReservation?.status} />

                      <div className="rounded-2xl border bg-white p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs text-slate-500">Reservation</div>
                            <div className="text-base font-bold text-slate-900">#{activeReservation.id}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              Plot:{" "}
                              <span className="font-semibold text-slate-700">
                                {activeReservation.plot_code || selectedPlot?.plot_name || "—"}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">
                              Created: {String(activeReservation.created_at || "").slice(0, 10) || "—"}
                            </div>
                          </div>

                          {activeBadge ? <Badge className={activeBadge.className}>{activeBadge.label}</Badge> : null}
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Button
                            variant="outline"
                            onClick={refreshActiveReservationFromList}
                            disabled={loadingReservations}
                            className="rounded-xl"
                          >
                            <RefreshCcw className={["h-4 w-4 mr-2", loadingReservations ? "animate-spin" : ""].join(" ")} />
                            Refresh
                          </Button>

                          <Button
                            variant="outline"
                            onClick={viewOnMapFromStatus}
                            className="rounded-xl"
                            disabled={!activeReservation?.plot_id}
                            title={!activeReservation?.plot_id ? "Missing plot_id" : "View on map"}
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            View on map
                          </Button>

                          <Button
                            variant="destructive"
                            onClick={() => {
                              setCancelTargetId(activeReservation.id);
                              setCancelOpen(true);
                            }}
                            disabled={submitting}
                            className="rounded-xl"
                            title="Cancel this reservation"
                          >
                            Cancel
                          </Button>
                        </div>

                      

                   {isPending ? (
                          <div className="mt-3 rounded-2xl border bg-amber-50 p-3 text-sm text-amber-900">
                            <div className="flex items-center gap-2 font-semibold">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Waiting for Admin Approval
                            </div>
                            <div className="text-xs text-amber-800 mt-1">
                              Your reservation is pending. Please wait while the admin reviews your request.
                            </div>
                          </div>
                        ) : null}

                        {isApproved ? (
                          <div className="mt-3 rounded-2xl border bg-emerald-50 p-3 text-sm text-emerald-900">
                            <div className="flex items-center gap-2 font-semibold">
                              <CheckCircle2 className="h-4 w-4" />
                              Approved by Admin ✅
                            </div>
                            <div className="text-xs text-emerald-800 mt-1">
                              Your reservation has been approved. You may now proceed to create your burial request.
                            </div>

                            <div className="mt-3">
                              <Button asChild className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
                                <NavLink
                                  to={buildInquireLink({
                                    plotId: activeReservation.plot_id,
                                    reservationId: activeReservation.id,
                                    deceasedName: derivedDeceasedNameForLink,
                                  })}
                                >
                                  Proceed to Burial Request
                                  <ArrowRight className="h-4 w-4 ml-2" />
                                </NavLink>
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {isRejected ? (
                          <div className="mt-3 rounded-2xl border bg-rose-50 p-3 text-sm text-rose-900">
                            <div className="font-semibold">Rejected</div>
                            <div className="text-xs text-rose-800 mt-1">
                              Please contact the admin for details or create a new reservation.
                            </div>
                          </div>
                        ) : null}
                      </div>


                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button variant="outline" onClick={resetAll} className="rounded-xl">
                          New reservation
                        </Button>
                        <Button onClick={() => setDetailsOpen(true)} className="rounded-xl">
                          View preview
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="space-y-4 lg:sticky lg:top-24 h-fit">
            <Card className="rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {step === 1
                    ? "Enter details"
                    : step === 2
                    ? "Pick a grave"
                    : step === 3
                    ? "Confirm and submit"
                    : "Quick actions"}
                </CardTitle>
                <CardDescription>
                  {step === 1
                    ? "Visitor is auto-filled. Complete relationship & deceased details."
                    : step === 2
                    ? "Select an available plot on the map, then continue."
                    : step === 3
                    ? "Review and submit your reservation."
               : "Wait for admin approval."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="rounded-2xl border bg-white p-3 space-y-2">
                  <div className="text-xs text-slate-500">Visitor</div>
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {applicant.full_name || "Not set"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {applicant.relationship || "Relationship: —"} • {applicant.contact_number || "Contact: —"}
                  </div>

                  <div className="pt-2 border-t">
                    <div className="text-xs text-slate-500">Deceased</div>
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {deceased.full_name || "Not set"}
                    </div>
                  </div>

                  {!infoValid ? (
                    <div className="rounded-2xl border bg-amber-50 p-2 text-xs text-amber-900">
                      Required fields missing: {requiredMissing.join(", ")}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500">Selected Plot</div>
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {selectedPlot?.plot_name || "None"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {selectedPlot
                          ? `${selectedPlot.plot_type} • ${selectedPlot.size_sqm} sqm • ₱${formatPrice(selectedPlot.price)}`
                          : "Pick an available plot on the map."}
                      </div>
                    </div>
                    {selectedBadge ? <Badge className={selectedBadge.className}>{selectedBadge.label}</Badge> : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setDetailsOpen(true)} className="rounded-xl">
                      View
                    </Button>

                    {step === 1 ? (
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                        onClick={goToMapStep}
                        disabled={!isVisitorLoggedIn || !infoValid}
                      >
                        Continue
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    ) : step === 2 ? (
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                        onClick={goToConfirmStep}
                        disabled={!selectedPlot || !canReserve || !isVisitorLoggedIn || !infoValid}
                      >
                        Continue
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    ) : step === 3 ? (
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                        onClick={submitReservation}
                        disabled={!isVisitorLoggedIn || submitting || !canReserve || !infoValid || !selectedPlot}
                      >
                        {submitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Submitting…
                          </span>
                        ) : (
                          <>
                            Submit
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl" onClick={resetAll}>
                        New
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </div>

                {step === 4 && activeReservation ? (
                  <div className="rounded-2xl border bg-white p-3">
                    <div className="text-sm font-bold text-slate-900">
                      Active reservation #{activeReservation.id}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Status:{" "}
                      <span className="font-semibold text-slate-700">
                        {String(activeReservation.status || "—")}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={refreshActiveReservationFromList}
                        disabled={loadingReservations}
                        className="rounded-xl"
                      >
                        <RefreshCcw className={["h-4 w-4 mr-2", loadingReservations ? "animate-spin" : ""].join(" ")} />
                        Refresh
                      </Button>
                      <Button
                        variant="outline"
                        onClick={viewOnMapFromStatus}
                        className="rounded-xl"
                        disabled={!activeReservation?.plot_id}
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Map
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* My reservations */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">My Reservations</CardTitle>
                    <CardDescription>Open a reservation to check status</CardDescription>
                  </div>

                  {isVisitorLoggedIn ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 rounded-xl"
                      onClick={fetchMyReservations}
                      disabled={loadingReservations}
                      title="Refresh"
                    >
                      <RefreshCcw className={["h-4 w-4", loadingReservations ? "animate-spin" : ""].join(" ")} />
                    </Button>
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {!isVisitorLoggedIn ? (
                  <div className="text-sm text-slate-600">Login to view your reservations.</div>
                ) : loadingReservations ? (
                  <div className="text-sm text-slate-600 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : myReservations.length === 0 ? (
                  <div className="text-sm text-slate-500">No reservations yet.</div>
                ) : (
                  <div className="space-y-2">
                    {myReservations.slice(0, 8).map((r) => {
                      const badge = statusBadgeProps(r.status);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className="w-full text-left rounded-2xl border bg-white p-3 hover:bg-slate-50 transition"
                          onClick={() => openReservation(r)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900 truncate">
                                {r.plot_code || "Plot"} • Reservation #{r.id}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                Created: {String(r.created_at || "").slice(0, 10) || "—"}
                              </div>
                            </div>
                            <Badge className={badge.className}>{badge.label}</Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Mobile sticky CTA */}
      <div className="fixed bottom-3 left-0 right-0 z-40 px-4 lg:hidden">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white/80 backdrop-blur shadow-lg p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-slate-500">{step === 1 ? "Visitor" : "Selected"}</div>
              <div className="text-sm font-semibold text-slate-900 truncate">
                {step === 1 ? applicant.full_name || "Not set" : selectedPlot?.plot_name || "None"}
              </div>
            </div>

            {step === 1 ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                onClick={goToMapStep}
                disabled={!isVisitorLoggedIn || !infoValid}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : step === 2 ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                onClick={goToConfirmStep}
                disabled={!selectedPlot || !canReserve || !isVisitorLoggedIn || !infoValid}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : step === 3 ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                onClick={submitReservation}
                disabled={!isVisitorLoggedIn || submitting || !canReserve || !infoValid || !selectedPlot}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </span>
                ) : (
                  <>
                    Submit
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button variant="outline" className="rounded-xl" onClick={resetAll}>
                New
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Reservation Preview</DialogTitle>
            <DialogDescription>Review visitor/deceased details and selected plot.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-2xl border bg-white p-3 space-y-2">
              <div className="text-sm font-bold text-slate-900">Visitor (Applicant)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Full name</div>
                  <div className="font-semibold text-slate-900">{applicant.full_name || "—"}</div>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Relationship</div>
                  <div className="font-semibold text-slate-900">{applicant.relationship || "—"}</div>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Contact number</div>
                  <div className="font-semibold text-slate-900">{applicant.contact_number || "—"}</div>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Email</div>
                  <div className="font-semibold text-slate-900">{applicant.email || "—"}</div>
                </div>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Address</div>
                <div className="font-semibold text-slate-900 break-words">{applicant.address || "—"}</div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-3 space-y-2">
              <div className="text-sm font-bold text-slate-900">Deceased</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Full name</div>
                  <div className="font-semibold text-slate-900">{deceased.full_name || "—"}</div>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Age</div>
                  <div className="font-semibold text-slate-900">{deceased.age || "—"}</div>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Date of death</div>
                  <div className="font-semibold text-slate-900">{deceased.date_of_death || "—"}</div>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Date of burial</div>
                  <div className="font-semibold text-slate-900">{deceased.date_of_burial || "—"}</div>
                </div>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Remarks</div>
                <div className="font-semibold text-slate-900 break-words">{deceased.remarks || "—"}</div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-3 space-y-2">
              <div className="text-sm font-bold text-slate-900">Selected plot</div>

              {!selectedPlot ? (
                <Alert className="rounded-2xl">
                  <AlertTitle>No plot selected</AlertTitle>
                  <AlertDescription>Please select an available plot on the map.</AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-2xl border bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-bold text-slate-900">{selectedPlot.plot_name ?? "—"}</div>
                      <div className="text-sm text-slate-600">
                        {selectedPlot.plot_type ?? "—"} • {selectedPlot.size_sqm ?? "—"} sqm
                      </div>
                    </div>
                    <Badge className={statusBadgeProps(selectedPlot.status).className}>
                      {statusBadgeProps(selectedPlot.status).label}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-2xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Price</div>
                      <div className="font-bold text-slate-900">₱{formatPrice(selectedPlot.price)}</div>
                    </div>
                    <div className="rounded-2xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Type</div>
                      <div className="font-bold text-slate-900">{selectedPlot.plot_type ?? "—"}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-3 text-sm text-slate-700">
              <div className="font-semibold mb-1">Notes that will be sent</div>
              <pre className="whitespace-pre-wrap break-words text-slate-700 text-xs">
                {composedNotesForSubmit || "—"}
              </pre>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDetailsOpen(false)} className="rounded-xl">
              Close
            </Button>

            {step === 1 ? (
              <Button
                onClick={() => {
                  setDetailsOpen(false);
                  goToMapStep();
                }}
                disabled={!isVisitorLoggedIn || !infoValid}
                className="rounded-xl"
              >
                Continue to map
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : step === 2 ? (
              <Button
                onClick={() => {
                  setDetailsOpen(false);
                  goToConfirmStep();
                }}
                disabled={!selectedPlot || !isVisitorLoggedIn || !canReserve || !infoValid}
                className="rounded-xl"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : step === 3 ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                onClick={() => {
                  setDetailsOpen(false);
                  submitReservation();
                }}
                disabled={!isVisitorLoggedIn || submitting || !canReserve || !selectedPlot || !infoValid}
              >
                Submit reservation
              </Button>
            ) : (
              <Button onClick={() => setDetailsOpen(false)} className="rounded-xl">
                Okay
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm modal */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Cancel reservation?</DialogTitle>
            <DialogDescription>
              This will cancel the selected reservation and free the plot for others (if the backend allows it).
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-semibold">Are you sure?</div>
            <div className="text-xs text-amber-800 mt-1">
              If you already paid, contact the admin before cancelling.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelOpen(false)} className="rounded-xl">
              Keep reservation
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelReservation(cancelTargetId)}
              disabled={submitting || !cancelTargetId}
              className="rounded-xl"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelling…
                </span>
              ) : (
                "Yes, cancel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
