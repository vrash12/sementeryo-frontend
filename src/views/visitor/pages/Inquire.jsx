// frontend/src/views/visitor/pages/Inquire.jsx
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Separator } from "../../../components/ui/separator";
import { Badge } from "../../../components/ui/badge";
import {
  Star,
  MapPin,
  MessageSquareText,
  Wrench,
  CalendarDays,
  ClipboardList,
  ShieldCheck,
  XCircle,
  Sparkles,
} from "lucide-react";

// ✅ Map
import CemeteryMap, { CEMETERY_CENTER } from "../../../components/map/CemeteryMap.jsx";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "/api";

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

/* --------------------------- small helpers --------------------------- */
const safeLower = (v) => String(v || "").toLowerCase();

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

const fmtDateLong = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const statusPill = (statusRaw) => {
  const s = safeLower(statusRaw);
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border";
  if (s === "completed")
    return `${base} bg-emerald-600 text-white border-emerald-600`;
  if (s === "scheduled")
    return `${base} bg-sky-600 text-white border-sky-600`;
  if (s === "approved")
    return `${base} bg-emerald-600 text-white border-emerald-600`;
  if (s === "cancelled" || s === "canceled" || s === "rejected")
    return `${base} bg-rose-600 text-white border-rose-600`;
  if (s === "reschedule_requested")
    return `${base} bg-amber-500 text-white border-amber-500`;
  return `${base} bg-slate-600 text-white border-slate-600`;
};

const statusAccent = (statusRaw) => {
  const s = safeLower(statusRaw);
  if (s === "completed") return "border-l-emerald-500";
  if (s === "scheduled") return "border-l-sky-500";
  if (s === "approved") return "border-l-emerald-500";
  if (s === "cancelled" || s === "canceled" || s === "rejected")
    return "border-l-rose-500";
  if (s === "reschedule_requested") return "border-l-amber-500";
  return "border-l-slate-400";
};

const ratingLabel = (n) => {
  const v = Number(n);
  if (v === 5) return "Excellent";
  if (v === 4) return "Good";
  if (v === 3) return "Okay";
  if (v === 2) return "Poor";
  if (v === 1) return "Very poor";
  return "";
};

const getRowPlotId = (r) =>
  r?.plot_id ?? r?.plotId ?? r?.grave_plot_id ?? r?.plot?.id ?? r?.plot ?? null;

const normId = (v) => {
  if (v == null) return "";
  return String(v).trim();
};
const idEq = (a, b) => {
  const A = normId(a);
  const B = normId(b);
  return !!A && !!B && A === B;
};

const isTruthyStr = (v) => v != null && String(v).trim() !== "";

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

function getFeatId(feature) {
  const p = feature?.properties || {};
  return p.plot_id != null
    ? String(p.plot_id)
    : p.plotId != null
    ? String(p.plotId)
    : p.id != null
    ? String(p.id)
    : p.uid != null
    ? String(p.uid)
    : undefined;
}

function featureMatchesHighlighted(feature, highlightedId) {
  if (!highlightedId) return false;

  const p = feature?.properties || {};
  const fid = getFeatId(feature);

  return (
    idEq(fid, highlightedId) ||
    idEq(p.plot_id, highlightedId) ||
    idEq(p.plotId, highlightedId) ||
    idEq(p.id, highlightedId) ||
    idEq(p.uid, highlightedId)
  );
}

function featureToMapShapes(feature, highlightedId) {
  const out = { polygons: [], markers: [] };
  if (!feature?.geometry) return out;

  const { geometry, properties } = feature;
  const fid = getFeatId(feature);
  const type = geometry.type;
  const coords = geometry.coordinates;
  if (!coords) return out;

  const isHighlighted = featureMatchesHighlighted(feature, highlightedId);

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
      featureId: fid,
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
        id: fid || properties?.plot_name || Math.random().toString(36).slice(2),
        position: { lat, lng },
        title: properties?.plot_name || (fid ? `Plot ${fid}` : "Plot"),
      });
    }
    return out;
  }

  if (type === "Polygon") {
    const rings = Array.isArray(coords) ? coords : [];
    if (rings[0])
      pushPolygonFromRing(
        rings[0],
        fid || `poly-${Math.random().toString(36).slice(2)}`
      );
    return out;
  }

  if (type === "MultiPolygon") {
    const polys = Array.isArray(coords) ? coords : [];
    polys.forEach((polyCoords, idx) => {
      const rings = Array.isArray(polyCoords) ? polyCoords : [];
      if (rings[0]) pushPolygonFromRing(rings[0], `${fid || "poly"}-${idx}`);
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

function normalizeFeatureCollection(json) {
  const maybe =
    json?.data?.featureCollection ||
    json?.data?.fc ||
    json?.data ||
    json?.featureCollection ||
    json;

  if (maybe?.type === "FeatureCollection" && Array.isArray(maybe.features)) return maybe;
  if (Array.isArray(maybe?.features)) return { type: "FeatureCollection", features: maybe.features };
  return null;
}

function getTodayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* =======================================================================
   PAGE
======================================================================= */
export default function Inquire() {
  const location = useLocation();

  const auth = useMemo(() => readAuth(), []);
  const currentUser = auth?.user || {};
  const token = getToken(auth);

  const role = String(currentUser?.role || "").toLowerCase();
  const isVisitorLoggedIn = !!token && role === "visitor" && !!currentUser?.id;

  const headersAuth = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const todayYMD = useMemo(() => getTodayYMD(), []);

  // ✅ Request type: "maintenance" | "burial"
  const [requestType, setRequestType] = useState("maintenance");

  // ✅ Support /visitor/inquire?type=maintenance|burial
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const t = sp.get("type");
    if (t === "maintenance" || t === "burial") setRequestType(t);
  }, [location.search]);

  // deceased options
  const [deceasedOptions, setDeceasedOptions] = useState([]); // [{ name, plot_id? }]
  const deceasedNameToPlotId = useMemo(() => {
    const map = new Map();
    deceasedOptions.forEach((o) => {
      if (o?.name && o?.plot_id != null)
        map.set(String(o.name).toLowerCase(), String(o.plot_id));
    });
    return map;
  }, [deceasedOptions]);

  const [namesLoading, setNamesLoading] = useState(false);
  const [namesError, setNamesError] = useState("");

  // shared deceased name input
  const [selectedName, setSelectedName] = useState("");
  const [deceasedName, setDeceasedName] = useState("");

  // ✅ from Reservation -> Inquire (prefill)
  const [prefillReservationId, setPrefillReservationId] = useState(null);

  // maintenance form
  const [maintenanceForm, setMaintenanceForm] = useState({
    description: "",
    preferredDate: "",
    preferredTime: "",
    priority: "medium",
  });

  // burial form
  const [burialForm, setBurialForm] = useState({
    birthDate: "",
    deathDate: "",
    burialDate: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // maintenance schedule list
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [mySchedule, setMySchedule] = useState([]);

  // burial requests list
  const [burialLoading, setBurialLoading] = useState(false);
  const [burialError, setBurialError] = useState("");
  const [myBurialRequests, setMyBurialRequests] = useState([]);

  // ✅ map
  const [fc, setFc] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const [manualPlotId, setManualPlotId] = useState(null);

  // scroll-to-map UX
  const mapSectionRef = useRef(null);
  const scrollToMap = useCallback(() => {
    mapSectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, []);

  /* -------------------- Load deceased names -------------------- */
  useEffect(() => {
    if (!isVisitorLoggedIn) return;
    let cancelled = false;

    (async () => {
      try {
        setNamesLoading(true);
        setNamesError("");

        const urls = [
          `${API_BASE}/visitor/my-deceased-names/${encodeURIComponent(
            String(currentUser.id)
          )}`,
        ];

        const { body } = await fetchFirstOk(urls, { headers: headersAuth });
        const list = extractArray(body);

        const opts = list
          .map((r) => {
            const name = String(r?.deceased_name ?? "").trim();
            if (!name) return null;
            const pid = r?.plot_id ?? r?.plotId ?? r?.grave_plot_id ?? null;
            return { name, plot_id: pid != null ? String(pid) : null };
          })
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!cancelled) setDeceasedOptions(opts);
      } catch (err) {
        if (!cancelled)
          setNamesError(err.message || "Failed to load deceased names.");
      } finally {
        if (!cancelled) setNamesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [headersAuth, isVisitorLoggedIn, currentUser.id]);

  /* -------------------- Load maintenance schedule -------------------- */
  const loadMySchedule = useCallback(async () => {
    if (!isVisitorLoggedIn) return;

    try {
      setScheduleLoading(true);
      setScheduleError("");

      const urls = [
        `${API_BASE}/visitor/my-maintenance-schedule/${encodeURIComponent(
          String(currentUser.id)
        )}`,
      ];

      const { body } = await fetchFirstOk(urls, { headers: headersAuth });
      setMySchedule(extractArray(body));
    } catch (e) {
      setScheduleError(e.message || "Failed to load schedule");
      setMySchedule([]);
    } finally {
      setScheduleLoading(false);
    }
  }, [headersAuth, isVisitorLoggedIn, currentUser.id]);

  useEffect(() => {
    loadMySchedule();
  }, [loadMySchedule]);

  /* -------------------- Load burial requests -------------------- */
  const loadMyBurialRequests = useCallback(async () => {
    if (!isVisitorLoggedIn) return;

    try {
      setBurialLoading(true);
      setBurialError("");

      const urls = [
        `${API_BASE}/visitor/my-burial-requests/${encodeURIComponent(
          String(currentUser.id)
        )}`,
        `${API_BASE}/visitor/burial-requests/${encodeURIComponent(
          String(currentUser.id)
        )}`,
      ];

      const { body } = await fetchFirstOk(urls, { headers: headersAuth });
      setMyBurialRequests(extractArray(body));
    } catch (e) {
      setBurialError(e.message || "Failed to load burial requests");
      setMyBurialRequests([]);
    } finally {
      setBurialLoading(false);
    }
  }, [headersAuth, isVisitorLoggedIn, currentUser.id]);

  useEffect(() => {
    loadMyBurialRequests();
  }, [loadMyBurialRequests]);

  /* -------------------- Load plots GeoJSON for CemeteryMap -------------------- */
  const loadPlotsGeo = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/plot/`, { headers: headersAuth });
      const json = await res.json().catch(() => null);
      const normalized = normalizeFeatureCollection(json);
      setFc(normalized);
    } catch {
      setFc(null);
    }
  }, [headersAuth]);

  useEffect(() => {
    loadPlotsGeo();
  }, [loadPlotsGeo]);

  /* -------------------- Prefill from query params / localStorage -------------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const sp = new URLSearchParams(window.location.search);
    const qpPlot = sp.get("plot_id");
    const qpRes = sp.get("reservation_id");
    const qpName = sp.get("deceased_name");

    let used = false;

    if (qpName) {
      setDeceasedName(qpName);
      setSelectedName(qpName);
      used = true;
    }
    if (qpPlot) {
      setManualPlotId(String(qpPlot));
      used = true;
    }
    if (qpRes) {
      setPrefillReservationId(String(qpRes));
      used = true;
    }

    // if we were sent from reservation, switch to burial
    if (used && (qpRes || qpPlot)) {
      setRequestType("burial");
      return;
    }

    try {
      const raw = localStorage.getItem("lastApprovedReservation");
      if (!raw) return;

      const j = JSON.parse(raw);
      if (j?.plot_id != null) setManualPlotId(String(j.plot_id));
      if (j?.id != null) setPrefillReservationId(String(j.id));
      if (j?.deceased_name) {
        setDeceasedName(String(j.deceased_name));
        setSelectedName(String(j.deceased_name));
      }

      if (j?.plot_id != null || j?.id != null) {
        setRequestType("burial");
      }
    } catch {
      // ignore
    }
  }, []);

  /* -------------------- Plot highlight selection -------------------- */
  const plotIdFromSelectedDeceased = useMemo(() => {
    const key = String(deceasedName || "").trim().toLowerCase();
    if (!key) return null;
    const pid = deceasedNameToPlotId.get(key);
    return pid != null ? String(pid) : null;
  }, [deceasedNameToPlotId, deceasedName]);

  const highlightedPlotId = useMemo(() => {
    return manualPlotId || plotIdFromSelectedDeceased || null;
  }, [manualPlotId, plotIdFromSelectedDeceased]);

  const mapShapes = useMemo(
    () => fcToMapShapes(fc, highlightedPlotId),
    [fc, highlightedPlotId]
  );

  // ✅ Burial must have a plot_id (from deceased mapping OR manual plot selection)
  const linkedPlotIdForBurial = useMemo(() => {
    return plotIdFromSelectedDeceased || manualPlotId || null;
  }, [plotIdFromSelectedDeceased, manualPlotId]);

  // ✅ zoom to highlighted plot (polygons first, else marker)
  useEffect(() => {
    const g = window.google?.maps;
    if (!g || !mapRef || !highlightedPlotId) return;

    const polys = mapShapes.polygons.filter((p) => {
      if (idEq(p.featureId, highlightedPlotId)) return true;
      const pr = p.properties || {};
      return (
        idEq(pr.plot_id, highlightedPlotId) ||
        idEq(pr.plotId, highlightedPlotId) ||
        idEq(pr.id, highlightedPlotId) ||
        idEq(pr.uid, highlightedPlotId)
      );
    });

    if (polys.length) {
      const bounds = new g.LatLngBounds();
      polys.forEach((p) => p.path.forEach((pt) => bounds.extend(pt)));
      try {
        mapRef.fitBounds(bounds, 60);
      } catch {}
      return;
    }

    const marker = mapShapes.markers.find((m) => idEq(m.id, highlightedPlotId));
    if (marker?.position) {
      mapRef.panTo(marker.position);
      mapRef.setZoom(20);
    }
  }, [mapRef, highlightedPlotId, mapShapes.polygons, mapShapes.markers]);

  /* -------------------- Submit maintenance OR burial request -------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isVisitorLoggedIn) return;

    setMsg({ type: "", text: "" });

    const dn = String(deceasedName || "").trim();
    if (!dn) {
      setMsg({ type: "error", text: "Please enter/select the deceased name." });
      return;
    }

    setSubmitting(true);
    try {
      if (requestType === "maintenance") {
        // ✅ MAINTENANCE
        if (!String(maintenanceForm.description || "").trim()) {
          setMsg({ type: "error", text: "Description is required." });
          return;
        }
        if (!maintenanceForm.preferredDate || !maintenanceForm.preferredTime) {
          setMsg({
            type: "error",
            text: "Preferred date and time are required.",
          });
          return;
        }

        const payload = {
          deceased_name: dn,
          description: String(maintenanceForm.description || "").trim(),
          priority: maintenanceForm.priority,
          preferred_date: maintenanceForm.preferredDate,
          preferred_time: maintenanceForm.preferredTime,
          family_contact: currentUser.id,
        };

        const url = `${API_BASE}/visitor/request-maintenance`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headersAuth },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data?.message || `Request failed: ${res.status}`);

        setMsg({
          type: "ok",
          text: "Maintenance request submitted successfully!",
        });

        setMaintenanceForm({
          description: "",
          preferredDate: "",
          preferredTime: "",
          priority: "medium",
        });

        await loadMySchedule();
      } else {
        // ✅ BURIAL REQUEST
        if (!burialForm.birthDate || !burialForm.deathDate || !burialForm.burialDate) {
          setMsg({
            type: "error",
            text: "Birth date, death date, and burial date are required.",
          });
          return;
        }

        // ✅ prevent future birth/death
        if (burialForm.birthDate > todayYMD) {
          setMsg({ type: "error", text: "Birth date cannot be in the future." });
          return;
        }
        if (burialForm.deathDate > todayYMD) {
          setMsg({ type: "error", text: "Death date cannot be in the future." });
          return;
        }

        if (burialForm.birthDate && burialForm.deathDate && burialForm.deathDate < burialForm.birthDate) {
          setMsg({ type: "error", text: "Death date cannot be earlier than birth date." });
          return;
        }

        // optional sanity check
        if (burialForm.deathDate && burialForm.burialDate && burialForm.burialDate < burialForm.deathDate) {
          setMsg({ type: "error", text: "Burial date cannot be earlier than death date." });
          return;
        }

        const plot_id = linkedPlotIdForBurial;
        if (!plot_id) {
          setMsg({
            type: "error",
            text:
              "To submit a burial schedule request, you must have a linked plot. Please reserve a plot first (Reservation page) or select a deceased name with an assigned plot.",
          });
          return;
        }

        const payload = {
          deceased_name: dn,
          birth_date: burialForm.birthDate,
          death_date: burialForm.deathDate,
          burial_date: burialForm.burialDate,
          family_contact: currentUser.id,
          plot_id: String(plot_id),
          ...(prefillReservationId ? { reservation_id: String(prefillReservationId) } : {}),
        };

        const urls = [
          `${API_BASE}/visitor/request-burial`,
          `${API_BASE}/visitor/burial-request`,
        ];

        await fetchFirstOk(urls, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headersAuth },
          body: JSON.stringify(payload),
        });

        setMsg({ type: "ok", text: "Burial request submitted successfully!" });

        setBurialForm({
          birthDate: "",
          deathDate: "",
          burialDate: "",
        });

        await loadMyBurialRequests();
      }

      // keep dropdown containing typed name (optional)
      setDeceasedOptions((prev) => {
        if (prev.some((n) => safeLower(n.name) === safeLower(dn))) return prev;
        return [...prev, { name: dn, plot_id: null }].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Failed to submit request." });
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------- visitor actions -------------------- */
  const requestReschedule = async (id) => {
    const preferred_date = prompt("Enter new preferred date (YYYY-MM-DD):");
    if (!preferred_date) return;

    const preferred_time = prompt("Enter new preferred time (HH:MM):");
    if (!preferred_time) return;

    const reason = prompt("Reason (optional):") || "";

    try {
      setMsg({ type: "", text: "" });

      const url = `${API_BASE}/visitor/maintenance/${encodeURIComponent(
        String(id)
      )}/request-reschedule`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headersAuth },
        body: JSON.stringify({ preferred_date, preferred_time, reason }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.message || "Failed to request reschedule");

      setMsg({ type: "ok", text: "Reschedule requested." });
      await loadMySchedule();
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Failed to request reschedule" });
    }
  };

  const cancelBurial = async (id) => {
    const ok = window.confirm("Cancel this burial request?");
    if (!ok) return;

    try {
      setMsg({ type: "", text: "" });

      const urls = [
        `${API_BASE}/visitor/request-burial/cancel/${encodeURIComponent(String(id))}`,
        `${API_BASE}/visitor/burial-request/${encodeURIComponent(String(id))}/cancel`,
        `${API_BASE}/visitor/cancel-burial-request/${encodeURIComponent(String(id))}`,
      ];

      await fetchFirstOk(urls, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headersAuth },
      });

      setMsg({ type: "ok", text: "Burial request cancelled." });
      await loadMyBurialRequests();
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Failed to cancel burial request" });
    }
  };

  /* -------------------- Feedback dialog UI -------------------- */
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const openFeedback = (row) => {
    setFeedbackTarget(row);
    setRating(0);
    setFeedbackText("");
    setFeedbackOpen(true);
  };

  const closeFeedback = () => {
    setFeedbackOpen(false);
    setFeedbackTarget(null);
    setRating(0);
    setFeedbackText("");
  };

  const sendFeedback = async () => {
    if (!feedbackTarget?.id) return;
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      setMsg({ type: "error", text: "Please select a rating (1 to 5)." });
      return;
    }

    const id = feedbackTarget.id;

    try {
      setSendingFeedback(true);
      setMsg({ type: "", text: "" });

      const url = `${API_BASE}/visitor/maintenance/${encodeURIComponent(
        String(id)
      )}/feedback`;

      const payload = {
        rating: Number(rating),
        feedback_text: String(feedbackText || "").trim() || "",
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headersAuth },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to submit feedback");

      setMsg({ type: "ok", text: "Thank you! Feedback submitted." });
      closeFeedback();
      await loadMySchedule();
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Failed to submit feedback" });
    } finally {
      setSendingFeedback(false);
    }
  };

  /* -------------------- UI summary -------------------- */
  const maintenancePending = useMemo(
    () =>
      mySchedule.filter(
        (r) =>
          !["completed", "cancelled", "canceled"].includes(safeLower(r.status))
      ).length,
    [mySchedule]
  );

  const burialPending = useMemo(
    () =>
      myBurialRequests.filter(
        (r) =>
          !["completed", "cancelled", "canceled", "rejected"].includes(
            safeLower(r.status)
          )
      ).length,
    [myBurialRequests]
  );

  const displayName = `${currentUser.first_name || ""} ${
    currentUser.last_name || ""
  }`.trim();

  return (
    <div className="relative min-h-screen font-poppins py-10 px-4">
      {/* Background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 via-cyan-50 to-blue-100" />
        <div className="absolute -top-24 -left-24 h-[32rem] w-[32rem] rounded-full bg-emerald-300/50 blur-3xl" />
        <div className="absolute top-1/3 right-0 h-[28rem] w-[28rem] rounded-full bg-cyan-300/50 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 h-[24rem] w-[24rem] rounded-full bg-blue-300/40 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-4">
        {/* Header / Hero */}
        <Card className="border-white/60 bg-white/75 backdrop-blur shadow-lg overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-3 py-1 text-xs font-medium shadow-sm">
                  <ShieldCheck className="h-4 w-4" />
                  Visitor Portal
                </div>

                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                  Requests & Scheduling
                </h1>

                <p className="text-sm md:text-base text-slate-600 max-w-2xl">
                  Submit a{" "}
                  <span className="font-medium text-slate-800">Maintenance</span>{" "}
                  or <span className="font-medium text-slate-800">Burial</span>{" "}
                  request, track status, and view linked plots on the map.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full md:w-auto">
                <div className="rounded-xl border bg-white/70 p-3 shadow-sm">
                  <div className="text-xs text-slate-500">Signed in</div>
                  <div className="mt-1 font-semibold text-slate-900 truncate">
                    {isVisitorLoggedIn ? displayName || "Visitor" : "Not logged in"}
                  </div>
                </div>
                <div className="rounded-xl border bg-white/70 p-3 shadow-sm">
                  <div className="text-xs text-slate-500">Maintenance (open)</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {maintenancePending}
                  </div>
                </div>
                <div className="rounded-xl border bg-white/70 p-3 shadow-sm col-span-2 md:col-span-1">
                  <div className="text-xs text-slate-500">Burial (open)</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {burialPending}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {!isVisitorLoggedIn && (
          <Alert
            className="bg-rose-50/90 backdrop-blur border-rose-200 shadow-md"
            variant="destructive"
          >
            <AlertDescription className="text-rose-700">
              Please login to submit a request.
            </AlertDescription>
          </Alert>
        )}

        {msg.text && (
          <Alert
            variant={msg.type === "error" ? "destructive" : "default"}
            className={
              msg.type === "error"
                ? "bg-rose-50/90 backdrop-blur border-rose-200 shadow-md"
                : "bg-emerald-50/90 backdrop-blur border-emerald-200 shadow-md"
            }
          >
            <AlertDescription
              className={msg.type === "error" ? "text-rose-700" : "text-emerald-700"}
            >
              {msg.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* CREATE REQUEST */}
          <Card className="border-white/60 bg-white/80 backdrop-blur shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                Create a Request
              </CardTitle>
              <CardDescription className="text-slate-600">
                Select a request type, choose a deceased name, then fill in the required fields.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* segmented switch */}
              <div className="rounded-2xl border bg-white/60 p-2 shadow-sm">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestType("maintenance")}
                    className={
                      "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition " +
                      (requestType === "maintenance"
                        ? "bg-emerald-600 text-white shadow"
                        : "bg-white/50 text-slate-700 hover:bg-white")
                    }
                  >
                    <Wrench className="h-4 w-4" />
                    Maintenance
                  </button>

                  <button
                    type="button"
                    onClick={() => setRequestType("burial")}
                    className={
                      "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition " +
                      (requestType === "burial"
                        ? "bg-emerald-600 text-white shadow"
                        : "bg-white/50 text-slate-700 hover:bg-white")
                    }
                  >
                    <CalendarDays className="h-4 w-4" />
                    Burial
                  </button>
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {/* Deceased name */}
                <div className="space-y-2">
                  <Label>Deceased Name</Label>

                  <Select
                    value={selectedName}
                    onValueChange={(val) => {
                      setSelectedName(val);
                      setDeceasedName(val);
                      setManualPlotId(null);
                      setPrefillReservationId(null);
                    }}
                    disabled={
                      !isVisitorLoggedIn ||
                      submitting ||
                      namesLoading ||
                      deceasedOptions.length === 0
                    }
                  >
                    <SelectTrigger className="bg-white/70">
                      <SelectValue
                        placeholder={
                          namesLoading
                            ? "Loading your deceased names…"
                            : deceasedOptions.length
                            ? "Select from your deceased names"
                            : "No deceased names found"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {deceasedOptions.map((o) => (
                        <SelectItem key={o.name} value={o.name}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {namesError && <p className="text-xs text-rose-600">{namesError}</p>}

                  <Input
                    type="text"
                    value={deceasedName}
                    onChange={(e) => {
                      setDeceasedName(e.target.value);
                      setSelectedName("");
                      setManualPlotId(null);
                      setPrefillReservationId(null);
                    }}
                    placeholder="Or type full name"
                    disabled={!isVisitorLoggedIn || submitting}
                    className="bg-white/70"
                  />

                  {/* linked plot hint */}
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>
                      Linked plot:{" "}
                      <span className="font-semibold">
                        {plotIdFromSelectedDeceased
                          ? `#${plotIdFromSelectedDeceased}`
                          : manualPlotId
                          ? `#${manualPlotId}`
                          : "—"}
                      </span>
                      {prefillReservationId ? (
                        <span className="ml-2 text-slate-500">
                          (Reservation #{prefillReservationId})
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>

                {/* Conditional fields */}
                {requestType === "maintenance" ? (
                  <>
                    <div className="space-y-2">
                      <Label>Description (required)</Label>
                      <Input
                        type="text"
                        value={maintenanceForm.description}
                        onChange={(e) =>
                          setMaintenanceForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        placeholder="e.g., Clean area, fix headstone, remove weeds"
                        disabled={!isVisitorLoggedIn || submitting}
                        className="bg-white/70"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Preferred Date</Label>
                        <Input
                          type="date"
                          value={maintenanceForm.preferredDate}
                          onChange={(e) =>
                            setMaintenanceForm((f) => ({
                              ...f,
                              preferredDate: e.target.value,
                            }))
                          }
                          disabled={!isVisitorLoggedIn || submitting}
                          className="bg-white/70"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Preferred Time</Label>
                        <Input
                          type="time"
                          value={maintenanceForm.preferredTime}
                          onChange={(e) =>
                            setMaintenanceForm((f) => ({
                              ...f,
                              preferredTime: e.target.value,
                            }))
                          }
                          disabled={!isVisitorLoggedIn || submitting}
                          className="bg-white/70"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select
                          value={maintenanceForm.priority}
                          onValueChange={(val) =>
                            setMaintenanceForm((f) => ({ ...f, priority: val }))
                          }
                          disabled={!isVisitorLoggedIn || submitting}
                        >
                          <SelectTrigger className="bg-white/70">
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border bg-white/60 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <ClipboardList className="h-4 w-4 text-emerald-600" />
                      Burial details
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Birth Date</Label>
                        <Input
                          type="date"
                          value={burialForm.birthDate}
                          max={todayYMD}
                          onChange={(e) => {
                            const v = e.target.value || "";
                            setBurialForm((f) => ({
                              ...f,
                              birthDate: v && v > todayYMD ? todayYMD : v,
                            }));
                          }}
                          disabled={!isVisitorLoggedIn || submitting}
                          className="bg-white/70"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Death Date</Label>
                        <Input
                          type="date"
                          value={burialForm.deathDate}
                          max={todayYMD}
                          onChange={(e) => {
                            const v = e.target.value || "";
                            setBurialForm((f) => ({
                              ...f,
                              deathDate: v && v > todayYMD ? todayYMD : v,
                            }));
                          }}
                          disabled={!isVisitorLoggedIn || submitting}
                          className="bg-white/70"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Burial Date</Label>
                        <Input
                          type="date"
                          value={burialForm.burialDate}
                          onChange={(e) =>
                            setBurialForm((f) => ({ ...f, burialDate: e.target.value }))
                          }
                          disabled={!isVisitorLoggedIn || submitting}
                          className="bg-white/70"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Family contact */}
                <div className="grid gap-2">
                  <Label>Family Contact</Label>
                  <Input type="text" value={displayName} disabled className="bg-white/60" />
                </div>

                {/* Burial guard */}
                {requestType === "burial" && !linkedPlotIdForBurial ? (
                  <Alert className="bg-amber-50/90 backdrop-blur border-amber-200 shadow-md">
                    <AlertDescription className="text-amber-900">
                      Burial requests require a linked plot. Please reserve a plot first.{" "}
                      <NavLink to="/visitor/reservation" className="underline font-semibold">
                        Go to Reservation
                      </NavLink>
                      .
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
                  disabled={
                    !isVisitorLoggedIn ||
                    submitting ||
                    (requestType === "burial" && !linkedPlotIdForBurial)
                  }
                >
                  {submitting
                    ? "Submitting..."
                    : requestType === "maintenance"
                    ? "Submit Maintenance Request"
                    : "Submit Burial Request"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* MAP */}
          <Card
            ref={mapSectionRef}
            className="border-white/60 bg-white/80 backdrop-blur shadow-lg overflow-hidden"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-bold text-slate-900">
                Cemetery Map
              </CardTitle>
              <CardDescription className="text-slate-600">
                We highlight the plot linked to the selected deceased/request. Click a plot to
                highlight it.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-white/60 border">
                  Highlighted plot:{" "}
                  <span className="ml-1 font-semibold">
                    {highlightedPlotId ? `#${highlightedPlotId}` : "—"}
                  </span>
                </Badge>

                {highlightedPlotId ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setManualPlotId(String(highlightedPlotId));
                      scrollToMap();
                    }}
                  >
                    Focus
                  </Button>
                ) : null}

                <Button
                  variant="outline"
                  onClick={() => {
                    setManualPlotId(null);
                  }}
                >
                  Clear highlight
                </Button>
              </div>

              <div className="h-[52vh] rounded-xl overflow-hidden border bg-white">
                <CemeteryMap
                  center={CEMETERY_CENTER}
                  zoom={19}
                  clickable={true}
                  showGeofence={true}
                  enableDrawing={false}
                  polygons={mapShapes.polygons}
                  markers={mapShapes.markers}
                  showLegend={true}
                  onMapLoad={(m) => setMapRef(m)}
                  onEditPlot={(poly) => {
                    const pid =
                      poly?.featureId ??
                      poly?.id ??
                      poly?.properties?.plot_id ??
                      poly?.properties?.plotId ??
                      poly?.properties?.id ??
                      poly?.properties?.uid;
                    if (pid != null) setManualPlotId(String(pid));
                  }}
                />
              </div>

              <p className="text-xs text-slate-600">
                Tip: Use <span className="font-medium">“View on map”</span> from a request to jump
                directly to that plot.
              </p>

              <p className="text-[11px] text-slate-500">
                Debug: plots loaded = {fc?.features?.length || 0} • polygons rendered ={" "}
                {mapShapes.polygons.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* MY MAINTENANCE SCHEDULE */}
        <Card className="border-white/60 bg-white/80 backdrop-blur shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900">
              My Maintenance Schedule
            </CardTitle>
            <CardDescription className="text-slate-600">
              Track requests, schedules, assigned staff, completion, and feedback.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {scheduleError ? <p className="text-sm text-rose-600">{scheduleError}</p> : null}

            {scheduleLoading ? (
              <div className="space-y-2">
                <div className="h-16 rounded-xl bg-white/60 border animate-pulse" />
                <div className="h-16 rounded-xl bg-white/60 border animate-pulse" />
              </div>
            ) : mySchedule.length ? (
              <div className="space-y-3">
                {mySchedule.map((r) => {
                  const status = safeLower(r.status);
                  const isCompleted = status === "completed";
                  const isCancelled = status === "cancelled" || status === "canceled";
                  const hasFeedback = r.feedback_rating != null;

                  const plotId = getRowPlotId(r);

                  return (
                    <div
                      key={r.id}
                      className={
                        "rounded-2xl border border-l-4 bg-white/65 p-4 transition " +
                        statusAccent(r.status) +
                        " hover:bg-white/80"
                      }
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold text-slate-900 truncate">
                              {r.deceased_name || "Maintenance"}
                            </div>
                            <span className={statusPill(r.status)}>
                              {r.status || "pending"}
                            </span>
                            {plotId != null ? (
                              <Badge variant="outline" className="text-slate-700 bg-white/50">
                                Plot #{String(plotId)}
                              </Badge>
                            ) : null}
                          </div>

                          <div className="text-sm text-slate-700 mt-2">
                            {r.description || "—"}
                          </div>

                          <Separator className="my-3" />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                            <div className="rounded-xl bg-white/60 border p-2">
                              <div className="text-slate-500">Preferred</div>
                              <div className="font-medium">
                                {r.preferred_date || "—"} {r.preferred_time || ""}
                              </div>
                            </div>

                            <div className="rounded-xl bg-white/60 border p-2">
                              <div className="text-slate-500">Official schedule</div>
                              <div className="font-medium">
                                {r.scheduled_date ? (
                                  <>
                                    {fmtDateLong(r.scheduled_date)} {r.scheduled_time || ""}
                                  </>
                                ) : (
                                  "— (waiting for admin schedule)"
                                )}
                              </div>
                              {r.assigned_staff_name ? (
                                <div className="mt-1 text-slate-600">
                                  Staff:{" "}
                                  <span className="font-medium">{r.assigned_staff_name}</span>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {hasFeedback ? (
                            <div className="mt-3 rounded-xl border bg-white/60 p-3">
                              <div className="flex items-center gap-2 text-sm">
                                <div className="font-medium text-slate-800">
                                  Your rating
                                </div>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((i) => (
                                    <Star
                                      key={i}
                                      className={
                                        "h-4 w-4 " +
                                        (Number(r.feedback_rating) >= i
                                          ? "text-amber-500"
                                          : "text-slate-300")
                                      }
                                      fill={
                                        Number(r.feedback_rating) >= i
                                          ? "currentColor"
                                          : "none"
                                      }
                                    />
                                  ))}
                                </div>
                                <span className="text-xs text-slate-600">
                                  ({r.feedback_rating}/5)
                                </span>
                              </div>
                              {r.feedback_text ? (
                                <div className="mt-2 text-sm text-slate-700">
                                  <MessageSquareText className="inline-block h-4 w-4 mr-1 text-slate-400" />
                                  {r.feedback_text}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex md:flex-col gap-2 md:min-w-[200px]">
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                              if (plotId == null) {
                                setMsg({
                                  type: "error",
                                  text: "No plot linked to this record yet.",
                                });
                                return;
                              }
                              setManualPlotId(String(plotId));
                              scrollToMap();
                            }}
                          >
                            <MapPin className="h-4 w-4" />
                            View on map
                          </Button>

                          {!isCompleted && (
                            <Button
                              variant="secondary"
                              onClick={() => requestReschedule(r.id)}
                              disabled={isCancelled}
                              className="gap-2"
                            >
                              <CalendarDays className="h-4 w-4" />
                              Request reschedule
                            </Button>
                          )}

                          {isCompleted && !hasFeedback && (
                            <Button onClick={() => openFeedback(r)} className="gap-2">
                              <Star className="h-4 w-4" />
                              Rate / Feedback
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No maintenance requests yet.</p>
            )}
          </CardContent>
        </Card>

        {/* MY BURIAL REQUESTS */}
        <Card className="border-white/60 bg-white/80 backdrop-blur shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900">
              My Burial Requests
            </CardTitle>
            <CardDescription className="text-slate-600">
              View your submitted burial requests and their status.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {burialError ? <p className="text-sm text-rose-600">{burialError}</p> : null}

            {burialLoading ? (
              <div className="space-y-2">
                <div className="h-16 rounded-xl bg-white/60 border animate-pulse" />
                <div className="h-16 rounded-xl bg-white/60 border animate-pulse" />
              </div>
            ) : myBurialRequests.length ? (
              <div className="space-y-3">
                {myBurialRequests.map((r) => {
                  const status = safeLower(r.status);
                  const isCancelled = status === "cancelled" || status === "canceled";

                  const plotId = getRowPlotId(r);

                  return (
                    <div
                      key={r.id}
                      className={
                        "rounded-2xl border border-l-4 bg-white/65 p-4 transition hover:bg-white/80 " +
                        statusAccent(r.status)
                      }
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold text-slate-900 truncate">
                              {r.deceased_name || "Burial Request"}
                            </div>
                            <span className={statusPill(r.status)}>
                              {r.status || "pending"}
                            </span>

                            {plotId != null ? (
                              <Badge variant="outline" className="text-slate-700 bg-white/50">
                                Plot #{String(plotId)}
                              </Badge>
                            ) : null}
                          </div>

                          <Separator className="my-3" />

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-700">
                            <div className="rounded-xl bg-white/60 border p-2">
                              <div className="text-slate-500">Birth</div>
                              <div className="font-medium">{r.birth_date || "—"}</div>
                            </div>
                            <div className="rounded-xl bg-white/60 border p-2">
                              <div className="text-slate-500">Death</div>
                              <div className="font-medium">{r.death_date || "—"}</div>
                            </div>
                            <div className="rounded-xl bg-white/60 border p-2">
                              <div className="text-slate-500">Burial</div>
                              <div className="font-medium">{r.burial_date || "—"}</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex md:flex-col gap-2 md:min-w-[200px]">
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                              const nameKey = String(r.deceased_name || "")
                                .trim()
                                .toLowerCase();
                              const mapped = deceasedNameToPlotId.get(nameKey);
                              const pid = plotId ?? mapped ?? null;

                              if (!pid) {
                                setMsg({
                                  type: "error",
                                  text: "No plot linked to this burial request yet.",
                                });
                                return;
                              }
                              setManualPlotId(String(pid));
                              scrollToMap();
                            }}
                          >
                            <MapPin className="h-4 w-4" />
                            View on map
                          </Button>

                          {!isCancelled && (
                            <Button
                              variant="secondary"
                              onClick={() => cancelBurial(r.id)}
                              className="gap-2"
                            >
                              <XCircle className="h-4 w-4" />
                              Cancel request
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No burial requests yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feedback dialog */}
      <Dialog
        open={feedbackOpen}
        onOpenChange={(o) => (!o ? closeFeedback() : setFeedbackOpen(true))}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rate the service</DialogTitle>
            <DialogDescription>
              Share your experience so we can keep improving.
            </DialogDescription>
          </DialogHeader>

          {feedbackTarget ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-slate-50 p-3">
                <div className="text-sm font-medium text-slate-900">
                  {feedbackTarget.deceased_name || "Maintenance"}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Request #{feedbackTarget.id}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRating(i)}
                        className="rounded-md p-1 hover:bg-slate-100"
                        aria-label={`Rate ${i} out of 5`}
                      >
                        <Star
                          className={
                            "h-6 w-6 " + (rating >= i ? "text-amber-500" : "text-slate-300")
                          }
                          fill={rating >= i ? "currentColor" : "none"}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-slate-700">
                    {rating ? (
                      <>
                        <span className="font-medium">{rating}/5</span>{" "}
                        <span className="text-slate-500">• {ratingLabel(rating)}</span>
                      </>
                    ) : (
                      <span className="text-slate-500">Select a rating</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Feedback (optional)</Label>
                <textarea
                  value={feedbackText}
                  onChange={(e) =>
                    setFeedbackText(String(e.target.value || "").slice(0, 300))
                  }
                  placeholder="Tell us what went well, or what we can improve…"
                  className="min-h-[110px] w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
                />
                <div className="text-xs text-slate-500">{feedbackText.length}/300</div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeFeedback} disabled={sendingFeedback}>
              Cancel
            </Button>
            <Button onClick={sendFeedback} disabled={sendingFeedback || !feedbackTarget}>
              {sendingFeedback ? "Submitting…" : "Submit feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
