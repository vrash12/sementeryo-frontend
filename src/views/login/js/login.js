// frontend/src/views/login/js/login.js
import { setAuth } from "../../../utils/auth";

function routeForRole(role) {
  switch (String(role || "").toLowerCase()) {
    case "super_admin":
      return "/superadmin/setup";
    case "admin":
      return "/admin/plots";
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

export async function postLogin({ usernameOrEmail, password }) {
  const BASE = cleanBase(import.meta.env.VITE_API_BASE_URL);
  if (!BASE) throw new Error("Missing VITE_API_BASE_URL in frontend/.env");

  console.log("API BASE:", BASE);

  // ✅ your current endpoint
  const url = `${BASE}/auth/login`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ usernameOrEmail, password }),
    });

    const data = await safeRead(res);

    if (!res.ok) {
      const msg =
        (data && typeof data === "object" && (data.error || data.message)) ||
        (typeof data === "string" && data) ||
        `Login failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    const token = data?.token || null;
    const user = data?.user || null;

    if (token && user) {
      setAuth({ token, user });
    }

    return { token, user, next: routeForRole(user?.role) };
  } catch (err) {
    const msg = err?.message || String(err);
    const e = new Error(`Login request failed.\nURL: ${url}\nReason: ${msg}`);
    e.cause = err;
    throw e;
  }
}
