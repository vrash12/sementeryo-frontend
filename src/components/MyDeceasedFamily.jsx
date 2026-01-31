import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import QRCode from "react-qr-code";

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

function formatDate(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toISOString().split("T")[0];
}

function InfoField({ label, value, italic }) {
  return (
    <div className="relative group overflow-hidden p-3 border border-emerald-100/50 rounded-lg bg-gradient-to-br from-slate-50/80 to-white/80 backdrop-blur hover:border-emerald-200 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="relative text-xs font-semibold text-emerald-600 uppercase mb-1">
        {label}
      </div>
      <div
        className={
          italic
            ? "relative italic text-slate-700 font-medium"
            : "relative text-slate-800 font-medium"
        }
      >
        {value || "—"}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();

  const map = {
    confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected: "bg-rose-100 text-rose-800 border-rose-200",
    canceled: "bg-slate-100 text-slate-700 border-slate-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-200",

    // reservation statuses
    reserved: "bg-amber-100 text-amber-800 border-amber-200",
  };

  const cls = map[s] || "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full border ${cls}`}>
      {s ? s.toUpperCase() : "—"}
    </span>
  );
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

export default function MyDeceasedFamily({ open, onOpenChange }) {
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [family, setFamily] = useState([]);

  const [loadingReservations, setLoadingReservations] = useState(false);
  const [reservations, setReservations] = useState([]);

  const auth = useMemo(() => readAuth(), []);
  const token = useMemo(() => getToken(auth), [auth]);
  const userId = auth?.user?.id;

  const headers = useMemo(() => {
    const h = {};
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  // ✅ correct endpoints
  const ENDPOINTS = useMemo(() => {
    return {
      myDeceasedFamily: userId
        ? `${API_BASE}/visitor/my-deceased-family/${encodeURIComponent(userId)}`
        : null,
      myReservations: `${API_BASE}/visitor/my-reservations`,

      // optional fallback (your old call)
      legacyFamily: userId
        ? `${API_BASE}/graves/graves/family/${encodeURIComponent(userId)}`
        : null,
    };
  }, [userId]);

  useEffect(() => {
    if (!open || !userId) return;

    const run = async () => {
      // ---- fetch deceased family (graves + burial_requests) ----
      setLoadingFamily(true);
      try {
        let json;
        try {
          json = await fetchJson(ENDPOINTS.myDeceasedFamily, { headers });
        } catch (e) {
          // fallback if your backend still uses the legacy route
          if (ENDPOINTS.legacyFamily) {
            json = await fetchJson(ENDPOINTS.legacyFamily, { headers });
          } else {
            throw e;
          }
        }

        const items = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : json
          ? [json]
          : [];

        setFamily(items);
      } catch (err) {
        console.error("Error fetching deceased family:", err);
        setFamily([]);
      } finally {
        setLoadingFamily(false);
      }

      // ---- fetch reservations (so dialog isn't empty when user only reserved) ----
      setLoadingReservations(true);
      try {
        const body = await fetchJson(ENDPOINTS.myReservations, { headers });
        const list = Array.isArray(body) ? body : body?.data || [];
        setReservations(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Error fetching reservations:", err);
        setReservations([]);
      } finally {
        setLoadingReservations(false);
      }
    };

    run();
  }, [open, userId, ENDPOINTS.myDeceasedFamily, ENDPOINTS.myReservations, ENDPOINTS.legacyFamily, headers]);

  const handleDownloadQR = (_value, id) => {
    try {
      const svg = document.getElementById(`qr-${id}`);
      if (!svg) return;

      const serializer = new XMLSerializer();
      const svgData = serializer.serializeToString(svg);
      const encoded = window.btoa(unescape(encodeURIComponent(svgData)));

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = function () {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `qr_${id}.png`;
        link.href = pngFile;
        link.click();
      };

      img.src = "data:image/svg+xml;base64," + encoded;
    } catch (err) {
      console.error("QR download error:", err);
    }
  };

  const hasAnything =
    (family && family.length > 0) || (reservations && reservations.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-white/90 backdrop-blur border-white/60 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
            My Deceased Family
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Confirmed records + your burial requests. (Reservations are shown below.)
          </DialogDescription>
        </DialogHeader>

        {loadingFamily || loadingReservations ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-slate-600 font-medium">Loading...</span>
            </div>
          </div>
        ) : !hasAnything ? (
          <div className="text-center py-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
              <span className="text-slate-600">
                No deceased records yet.
              </span>
            </div>

            <div className="text-sm text-slate-600">
              This page shows <b>graves</b> and <b>burial requests</b>. A <b>reservation</b> won’t appear here until you submit a burial request (after approval) or the admin creates the grave record.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* ===================== DECEASED FAMILY (graves + burial_requests) ===================== */}
            {family.length > 0 ? (
              <Tabs defaultValue={family[0]?.id?.toString()} className="w-full">
                <div className="relative overflow-hidden border border-emerald-100 rounded-lg bg-gradient-to-br from-emerald-50/80 to-cyan-50/80 backdrop-blur p-2 shadow-md">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/5 via-cyan-400/5 to-blue-400/5"></div>
                  <TabsList className="relative flex flex-wrap gap-1">
                    {family.map((d) => (
                      <TabsTrigger
                        key={d.id}
                        value={d.id?.toString()}
                        className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                      >
                        {d.deceased_name || d.person_full_name || "Unnamed"}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {family.map((d) => (
                  <TabsContent key={d.id} value={d.id?.toString()}>
                    <div className="relative mt-4">
                      <div className="absolute -inset-2 bg-gradient-to-br from-emerald-400/20 via-cyan-400/15 to-blue-400/20 rounded-2xl blur-xl opacity-30"></div>

                      <Card className="relative overflow-hidden border-white/60 bg-white/80 backdrop-blur shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 via-cyan-400/5 to-blue-400/10"></div>

                        <CardHeader className="relative flex flex-row items-center justify-between gap-3">
                          <CardTitle className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                            {d.deceased_name || d.person_full_name || "Unnamed"}
                          </CardTitle>

                          <StatusBadge status={d.record_status} />
                        </CardHeader>

                        <CardContent className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
                          <InfoField label="Birth Date" value={formatDate(d.birth_date)} />
                          <InfoField label="Death Date" value={formatDate(d.death_date)} />
                          <InfoField label="Burial Date" value={formatDate(d.burial_date)} />
                          <InfoField label="Plot Name" value={d.plot_name} />
                          <InfoField label="Headstone Type" value={d.headstone_type} />
                          <InfoField label="Memorial Text" value={d.memorial_text} italic />

                          <div className="relative group overflow-hidden p-4 border border-emerald-100/50 rounded-lg bg-gradient-to-br from-slate-50/80 to-white/80 backdrop-blur hover:border-emerald-200 transition-all duration-300 flex flex-col items-center">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative text-xs font-semibold text-emerald-600 uppercase mb-3 self-start">
                              QR Token
                            </div>

                            {d.qr_token ? (
                              <>
                                <div className="relative bg-white p-3 border-2 border-emerald-100 rounded-lg shadow-md group-hover:shadow-lg transition-shadow">
                                  <QRCode id={`qr-${d.id}`} value={d.qr_token} size={120} />
                                </div>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="relative mt-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600 shadow-md hover:shadow-lg transition-all"
                                  onClick={() => handleDownloadQR(d.qr_token, d.id)}
                                >
                                  Download QR
                                </Button>
                              </>
                            ) : (
                              <span className="relative text-slate-600">—</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <div className="rounded-xl border bg-white p-4 text-sm text-slate-700">
                No graves / burial requests yet.
              </div>
            )}

            {/* ===================== RESERVATIONS (plot_reservations) ===================== */}
            <Card className="rounded-2xl overflow-hidden border-white/60 bg-white/80 backdrop-blur shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-slate-900">My Reservations</CardTitle>
                <div className="text-sm text-slate-600">
                  Reservations don’t appear as “deceased records” until you submit a burial request (after approval).
                </div>
              </CardHeader>

              <CardContent className="space-y-2">
                {reservations.length === 0 ? (
                  <div className="text-sm text-slate-600">No reservations found.</div>
                ) : (
                  reservations.slice(0, 10).map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border bg-white p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          Reservation #{r.id} • Plot {r.plot_code || r.section_name || r.plot_id || "—"}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Created: {String(r.created_at || "").slice(0, 10) || "—"}
                        </div>
                        {r.notes ? (
                          <div className="mt-2 text-xs text-slate-600 whitespace-pre-wrap break-words line-clamp-3">
                            {r.notes}
                          </div>
                        ) : null}
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
