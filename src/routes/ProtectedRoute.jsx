//frontend/src/routes/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAuth } from "../utils/auth";

// Normalize legacy roles into a single canonical value
function canonicalRole(rawRole) {
  if (!rawRole) return null;
  const r = String(rawRole).toLowerCase();
  if (r === "super_admin" || r === "staff") return "admin";
  return r;
}

export default function ProtectedRoute({ allow = [] }) {
  const loc = useLocation();
  const auth = getAuth();
  const token = auth?.token;
  const role = canonicalRole(auth?.user?.role);

  // Not logged in → kick to visitor home
  if (!token || !role) {
    return <Navigate to="/visitor/home" replace state={{ from: loc }} />;
  }

  // Logged in but not allowed for this route
  if (allow.length && !allow.includes(role)) {
    return <Navigate to="/visitor/home" replace />;
  }

  // OK → render nested route
  return <Outlet />;
}
