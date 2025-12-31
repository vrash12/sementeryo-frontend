// frontend/src/views/admin/js/reservation.js
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function readAuth() {
  const raw = localStorage.getItem("auth");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function getToken() {
  const auth = readAuth();
  return auth?.accessToken || auth?.token || auth?.jwt || null;
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function safeJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return { message: text }; }
}

// ✅ ADMIN/STAFF reserve plot
export async function reservePlotAsAdmin(plot_id, notes = "", user_id) {
  const res = await fetch(`${API_BASE}/admin/reserve-plot`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify({ plot_id, notes, user_id }),
  });

  const data = await safeJson(res);

  if (!res.ok) {
    throw new Error(data?.message || "Failed to reserve plot (admin).");
  }

  return data?.data ?? data;
}
