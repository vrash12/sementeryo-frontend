import { getAuth, clearAuth } from "./auth";
import { ENV } from "../config/env";

const API_BASE = ENV.API_BASE_URL; // single source

export async function apiFetch(path, options = {}) {
  const auth = getAuth();
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) clearAuth();
  return res;
}
