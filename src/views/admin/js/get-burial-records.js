import { getAuth } from "../../../utils/auth";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

export default async function fetchBurialRecords(options = {}) {
  const { limit, offset, query, signal } = options;
  const auth = getAuth();
  const token = auth?.token;

  let url = `${API_BASE}/graves/graves`;
  const params = new URLSearchParams();
  if (Number.isFinite(limit) && limit > 0) params.set("limit", String(limit));
  if (Number.isFinite(offset) && offset >= 0) params.set("offset", String(offset));
  if (query && String(query).trim() !== "") params.set("q", String(query).trim());

  const queryString = params.toString();
  if (queryString) url += `?${queryString}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    throw new Error(typeof body === "string" ? body : JSON.stringify(body));
  }

  return body;
}
