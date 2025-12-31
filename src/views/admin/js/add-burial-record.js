import { getAuth } from "../../../utils/auth";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

export default async function addBurialRecord(payload) {
  const auth = getAuth();
  const token = auth?.token;

  const res = await fetch(`${API_BASE}/admin/graves`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/json",
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
