const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "";

function getAuth() {
  try {
    const raw = localStorage.getItem("auth");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function updateUser(userId, payload) {
  const auth = getAuth();
  if (!auth?.token) {
    return { ok: false, error: "Not authenticated." };
  }

  // Try to get an ID from the JWT first; fall back to auth.user.id
  let actorId = null;
  const jwt = decodeJwtPayload(auth.token);
  actorId =
    jwt?.id ?? jwt?.user_id ?? jwt?.sub ?? auth?.user?.id ?? auth?.user?.user_id ?? null;

  const body = {
    ...payload,
    updated_by: actorId,
  };

  try {
    const res = await fetch(`${API_BASE}/superadmin/update-user/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.message || `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || "Network error" };
  }
}
