// frontend/src/views/login/js/signup.js
import { setAuth } from "../../../utils/auth";

function routeForRole(role) {
  switch (String(role || "").toLowerCase()) {
    case "super_admin":
      return "/superadmin/dashboard";
    case "admin":
      return "/admin/dashboard";
    case "staff":
      return "/staff/dashboard/";
    default:
      return "/visitor/home";
  }
}

function cleanBase(base) {
  return String(base || "").replace(/\/+$/, "");
}

async function safeRead(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    return await res.text();
  } catch {
    return null;
  }
}

export async function postSignup({
  username,
  email,
  password,
  first_name,
  last_name,
  phone,
  address,
}) {
  const BASE = cleanBase(import.meta.env.VITE_API_BASE_URL);
  if (!BASE) throw new Error("Missing VITE_API_BASE_URL in frontend/.env");

  // ✅ your current endpoint
  const url = `${BASE}/auth/register`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        username,
        email,
        password,
        first_name,
        last_name,
        phone: phone || null,
        address: address || null,
      }),
    });

    const data = await safeRead(res);

    if (!res.ok) {
      const msg =
        (data && typeof data === "object" && (data.error || data.message)) ||
        (typeof data === "string" && data) ||
        `Sign up failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    // Supports:
    //  - { user } (no token)
    //  - { token, user }
    const token = data?.token || null;
    const user = data?.user || (data && typeof data === "object" ? data : null);

    if (token && user) {
      setAuth({ token, user });
    }

    const next = token && user ? routeForRole(user.role) : "/visitor/home";
    return { token, user, next };
  } catch (err) {
    // Network/CORS shows as "Failed to fetch"
    const msg = err?.message || String(err);
    const e = new Error(
      `Signup request failed.\nURL: ${url}\nReason: ${msg}`
    );
    e.cause = err;
    throw e;
  }
}
