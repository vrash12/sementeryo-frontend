// frontend/src/views/visitor/js/get-burial-records.js
import { getAuth } from "../../../utils/auth";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

// Accept many common payload shapes
function pickArray(body) {
  return (
    (Array.isArray(body) && body) ||
    (Array.isArray(body?.data) && body.data) ||
    (Array.isArray(body?.data?.data) && body.data.data) ||
    (Array.isArray(body?.data?.rows) && body.data.rows) ||
    (Array.isArray(body?.rows) && body.rows) ||
    []
  );
}

// Normalize key variants from different endpoints / older payloads
function normalizeRow(r) {
  if (!r || typeof r !== "object") return r;

  const out = { ...r };

  // name variants
  if (out.deceasedName && !out.deceased_name) out.deceased_name = out.deceasedName;
  if (out.full_name && !out.deceased_name) out.deceased_name = out.full_name;
  if (out.fullName && !out.deceased_name) out.deceased_name = out.fullName;
  if (out.name && !out.deceased_name) out.deceased_name = out.name;

  // plot variants
  if (out.plotId != null && out.plot_id == null) out.plot_id = out.plotId;

  return out;
}

/**
 * Fetch burial records for visitor search.
 * Supports:
 *  - limit, offset
 *  - query (alias: q)
 *  - AbortController signal
 */
export default async function fetchBurialRecords(opts = {}) {
  const {
    limit = 250,
    offset = 0,
    query = "",
    q = "",
    signal,
  } = opts;

  const term = String(query || q || "").trim();

  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (term) params.set("q", term);

  // cache buster to avoid proxy/browser 304 reuse
  params.set("_ts", String(Date.now()));

  const url = `${API_BASE}/visitor/burial-records?${params.toString()}`;

  const headers = {
    Accept: "application/json",
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  };

  // Optional: attach auth if available (won't hurt if endpoint is public)
  try {
    const auth = typeof getAuth === "function" ? getAuth() : null;
    const token = auth?.token || auth?.accessToken || auth?.jwt || null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // ignore auth errors
  }

  const res = await fetch(url, {
    method: "GET",
    headers,
    signal,
    cache: "no-store",
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const msg =
      body?.message ||
      body?.error ||
      `Failed to load burial records (HTTP ${res.status})`;
    throw new Error(msg);
  }

  const list = pickArray(body).map(normalizeRow);
  return list;
}
