// src/views/visitor/js/reservation.js
import { getAuth } from "../../../utils/auth";

const RAW_BASE = (import.meta?.env?.VITE_API_BASE_URL || "").trim();
const API_BASE = RAW_BASE.replace(/\/+$/, ""); // remove trailing slashes

function joinUrl(base, path) {
  const p = String(path || "");
  if (!p) return base;
  if (!base) return p;
  return `${base}${p.startsWith("/") ? "" : "/"}${p}`;
}

function readAuthFromLS() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getAuthSafe() {
  // getAuth() might return a different shape than localStorage('auth')
  const a1 = getAuth?.() || null;
  const a2 = readAuthFromLS();
  return a1 || a2 || null;
}

function getToken() {
  const auth = getAuthSafe();
  return auth?.accessToken || auth?.token || auth?.jwt || null;
}

function getRole() {
  const auth = getAuthSafe();
  // try multiple shapes
  return (
    auth?.user?.role ||
    auth?.role ||
    auth?.userRole ||
    auth?.user_type ||
    null
  );
}

function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readBodyAsText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function readError(res, url) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  // Try JSON first
  if (ct.includes("application/json")) {
    const j = await res.json().catch(() => null);
    const msg =
      j?.message ||
      j?.error ||
      (typeof j === "string" ? j : null) ||
      (j ? JSON.stringify(j) : "");
    return msg || `HTTP ${res.status} ${res.statusText}`;
  }

  // Fallback to raw text (HTML 404 pages, etc.)
  const t = await readBodyAsText(res);
  const cleaned = String(t || "")
    .replace(/<[^>]*>/g, "") // strip HTML tags if any
    .trim()
    .slice(0, 200);

  return cleaned || `HTTP ${res.status} ${res.statusText} (${url})`;
}

/**
 * Decide if current user should use admin endpoints.
 * - "auto" (default): uses admin endpoints if role is admin/staff/superadmin
 * - "visitor": always uses visitor endpoints
 * - "admin": always uses admin endpoints
 */
function shouldUseAdmin(mode = "auto") {
  const m = String(mode || "auto").toLowerCase();
  if (m === "admin") return true;
  if (m === "visitor") return false;

  const role = String(getRole() || "").toLowerCase();
  return role === "admin" || role === "staff" || role === "superadmin";
}

/**
 * Reserve a plot
 * Visitor endpoint (existing):
 *   POST /visitor/reserve-plot   body: { plot_id, notes }
 *
 * Admin endpoint (must exist on backend):
 *   POST /admin/reserve-plot     body: { plot_id, notes, user_id? }
 */
export async function reservePlot(plotId, notes = "", opts = {}) {
  if (!plotId) throw new Error("Plot ID is required");

  const useAdmin = shouldUseAdmin(opts.mode);
  const endpoint = useAdmin ? "/admin/reserve-plot" : "/visitor/reserve-plot";
  const url = joinUrl(API_BASE, endpoint);

  const body = useAdmin
    ? { plot_id: plotId, notes, user_id: opts.userId ?? undefined }
    : { plot_id: plotId, notes };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await readError(res, url);
    // ✅ include status so you see 403/404 clearly
    throw new Error(`[${res.status}] ${msg}`);
  }

  return res.json();
}

/**
 * Reservations list
 * Visitor:
 *   GET /visitor/my-reservations
 *
 * Admin (must exist on backend):
 *   GET /admin/reservations
 */
export async function getMyReservations(opts = {}) {
  const useAdmin = shouldUseAdmin(opts.mode);
  const endpoint = useAdmin ? "/admin/reservations" : "/visitor/my-reservations";
  const url = joinUrl(API_BASE, endpoint);

  const res = await fetch(url, {
    headers: { ...authHeader() },
  });

  if (!res.ok) {
    const msg = await readError(res, url);
    throw new Error(`[${res.status}] ${msg}`);
  }

  const json = await res.json().catch(() => ({}));
  return json?.data || json || [];
}

/**
 * Cancel reservation
 * Visitor:
 *   PATCH /visitor/cancel-reservation/:id
 *
 * Admin (must exist on backend):
 *   PATCH /admin/cancel-reservation/:id
 */
export async function cancelReservation(reservationId, opts = {}) {
  if (!reservationId) throw new Error("Reservation ID is required");

  const useAdmin = shouldUseAdmin(opts.mode);
  const endpoint = useAdmin
    ? `/admin/cancel-reservation/${encodeURIComponent(reservationId)}`
    : `/visitor/cancel-reservation/${encodeURIComponent(reservationId)}`;

  const url = joinUrl(API_BASE, endpoint);

  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...authHeader() },
  });

  if (!res.ok) {
    const msg = await readError(res, url);
    throw new Error(`[${res.status}] ${msg}`);
  }

  return res.json();
}
