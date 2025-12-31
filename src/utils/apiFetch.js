// frontend/src/utils/apiFetch.js
import { getAuth, clearAuth } from "./auth";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

export async function apiFetch(path, options = {}) {
  const auth = getAuth();
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // token invalid/expired -> remove so you don't get stuck
    clearAuth();
  }

  return res;
}
