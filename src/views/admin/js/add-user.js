import { getAuth } from "../../../utils/auth";

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

export async function addUser(payload) {
  try {
    const auth = getAuth() || {};
    const token = auth?.token;

    const res = await fetch(`${API_BASE}/admin/visitors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload || {}),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.error || "Failed to add visitor." };
    return { ok: true, data: data?.data ?? data };
  } catch (e) {
    return { ok: false, error: e?.message || "Network error." };
  }
}
