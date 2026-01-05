import { getAuth } from "../../../utils/auth";

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

export async function deleteUser(id) {
  try {
    const auth = getAuth() || {};
    const token = auth?.token;

    const res = await fetch(`${API_BASE}/admin/visitors/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.error || "Failed to delete visitor." };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.message || "Network error." };
  }
}
