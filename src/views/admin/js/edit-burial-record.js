// frontend/src/views/admin/js/edit-burial-record.js
import { getAuth } from "../../../utils/auth";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

export default async function editBurialRecord(payload) {
  const auth = getAuth();
  const token = auth?.token;

  if (!payload?.id && !payload?.uid) {
    throw new Error("Missing burial record identifier (id or uid).");
  }

  const res = await fetch(`${API_BASE}/admin/edit-burial-record`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    throw new Error(typeof body === "string" ? body : JSON.stringify(body));
  }
  return body;
}
