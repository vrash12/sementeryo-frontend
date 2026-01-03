// frontend/src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

import { ENV, warnMissingEnv } from "./config/env";

// Debug env at runtime (shows what Vite baked into the build)
warnMissingEnv();
console.log("[ENV] VITE_API_BASE_URL =", ENV.API_BASE_URL);
console.log("[ENV] VITE_API_BASE_URL_IMAGE =", ENV.API_BASE_URL_IMAGE);

// Optional: expose for quick browser debugging
window.__APP_ENV__ = ENV;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
