// frontend/src/config/env.js

console.log("[ENV BUILD CHECK]", import.meta.env.VITE_API_BASE_URL);
function clean(v) {
  if (v == null) return "";
  return String(v).trim();
}



// Safe defaults so deployment won't crash if Render build didn't inject env vars.
// (You can still override these via Render Environment Variables.)
export const ENV = {
  API_BASE_URL: clean(import.meta.env.VITE_API_BASE_URL) || "https://sementeryo-backend.onrender.com/api",
  API_BASE_URL_IMAGE:
    clean(import.meta.env.VITE_API_BASE_URL_IMAGE) || "https://sementeryo-backend.onrender.com",

  EMAILJS_SERVICE_ID: clean(import.meta.env.VITE_EMAILJS_SERVICE_ID),
  EMAILJS_TEMPLATE_ID: clean(import.meta.env.VITE_EMAILJS_TEMPLATE_ID),
  EMAILJS_PUBLIC_KEY: clean(import.meta.env.VITE_EMAILJS_PUBLIC_KEY),

  GOOGLE_MAPS_API_KEY: clean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
};

export function warnMissingEnv() {
  const missing = [];

  if (!ENV.API_BASE_URL) missing.push("VITE_API_BASE_URL");
  if (!ENV.API_BASE_URL_IMAGE) missing.push("VITE_API_BASE_URL_IMAGE");

  // Optional (only warn; don't crash)
  if (!ENV.EMAILJS_PUBLIC_KEY) missing.push("VITE_EMAILJS_PUBLIC_KEY");
  if (!ENV.EMAILJS_SERVICE_ID) missing.push("VITE_EMAILJS_SERVICE_ID");
  if (!ENV.EMAILJS_TEMPLATE_ID) missing.push("VITE_EMAILJS_TEMPLATE_ID");

  if (missing.length) {
    console.warn("[ENV] Missing env vars:", missing.join(", "));
    console.warn("[ENV] Using defaults for API URLs (if missing).");
  }
}
