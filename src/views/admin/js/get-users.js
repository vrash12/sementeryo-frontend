// frontend/src/views/admin/js/get-users.js

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

// Read the saved auth object from localStorage
function getAuth() {
  try {
    const raw = localStorage.getItem("auth");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function getUsers() {
  const auth = getAuth();

  if (!auth?.token) {
    return { ok: false, error: "Not authenticated." };
  }

  try {
    // NOTE: now using the ADMIN route instead of /superadmin/users
    const res = await fetch(`${API_BASE}/admin/users/visitors`, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
    });

    // Try to parse JSON, fall back to {} or [] depending on success
    const data = await res.json().catch(() => (res.ok ? [] : {}));

    if (!res.ok) {
      // backend might use "error" or "message"
      const msg =
        (data && (data.error || data.message)) || `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    // /admin/users/visitors currently returns a plain array of users
    const users = Array.isArray(data) ? data : data.users || [];

    return { ok: true, data: users };
  } catch (err) {
    return { ok: false, error: err?.message || "Network error" };
  }
}
