// frontend/src/layouts/Sidebar.jsx

import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getAuth } from "../utils/auth";
import {
  LayoutDashboard,
  Users2,
  ShieldCheck,
  Landmark,
  Wrench,
  ClipboardList,
  BookOpenCheck,
  CalendarCheck2,
  Ticket,
  Search,
  Menu,
  ChevronLeft,
  LogOut,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Card, CardHeader, CardContent } from "../components/ui/card";

import ProfileModal from "../components/Profile";

const W_FULL = 272;
const cx = (...c) => c.filter(Boolean).join(" ");

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "/api";

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [open, setOpen] = useState(true);
  const [q, setQ] = useState("");

  const [authObj, setAuthObj] = useState(() => getAuth());
  const user = authObj?.user || {};
  const role = user?.role || "visitor";

  // hide sidebar for visitors
  if (role === "visitor") return null;

  const fullName =
    `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || "—";
  const initials =
    ((user?.first_name?.[0] || "") + (user?.last_name?.[0] || "") || "CL").toUpperCase();

  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!profileOpen) setAuthObj(getAuth());
  }, [profileOpen]);

  const I = {
    dashboard: LayoutDashboard,
    admins: ShieldCheck,
    staff: Users2,
    visitors: Users2,
    setup: Landmark,
    plots: ClipboardList,
    records: BookOpenCheck,
    tickets: Ticket,
    burials: CalendarCheck2,
    maintenance: Wrench,
  };

  const items = useMemo(() => {
    if (role === "admin") {
      return [
        { to: "/admin/dashboard", label: "Dashboard", icon: I.dashboard },
        { to: "/admin/visitor", label: "Visitors", icon: I.visitors },
        { to: "/admin/plots", label: "Burial Plots", icon: I.plots },
        { to: "/admin/records", label: "Burial Records", icon: I.records },
        { to: "/admin/burials", label: "Burial Schedule", icon: I.burials },
        { to: "/admin/maintenance", label: "Maintenance", icon: I.maintenance },
      ];
    }
    return [{ to: "/visitor/dashboard", label: "Dashboard", icon: I.dashboard }];
  }, [role]);

  const filtered = q
    ? items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()))
    : items;

  async function logout() {
    try {
      const token = authObj?.token || authObj?.accessToken;
      await fetch(`${API_BASE}/logout`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      }).catch(() => {});
    } finally {
      localStorage.removeItem("auth");
      setAuthObj(null);

      // ✅ IMPORTANT: do NOT hard reload, just navigate
      navigate("/visitor/login", { replace: true });
    }
  }

  return (
    <>
      {!open && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpen(true)}
          className="fixed left-3 top-3 z-50 h-11 w-11 rounded-2xl border border-emerald-200 bg-white shadow-md hover:shadow-lg"
          title="Show sidebar"
        >
          <Menu size={20} className="text-emerald-600" />
        </Button>
      )}

      <aside
        className={cx(
          "fixed left-0 top-0 z-40 h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 border-r border-emerald-100/50 flex flex-col backdrop-blur",
          "shadow-[0_10px_40px_-12px_rgba(16,185,129,0.15)] ring-1 ring-emerald-50",
          "transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full pointer-events-none"
        )}
        style={{ width: W_FULL }}
      >
        <Card className="relative m-4 rounded-2xl border-emerald-100 bg-white/80 backdrop-blur shadow-[0_12px_30px_-12px_rgba(16,185,129,0.25)] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-cyan-400/5 pointer-events-none" />

          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              title="Open Profile"
              className={cx(
                "flex items-center gap-3 rounded-xl transition-all duration-300",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                "hover:bg-gradient-to-r hover:from-emerald-50 hover:to-cyan-50 px-2 py-1.5 -ml-1"
              )}
            >
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl blur opacity-0 group-hover:opacity-75 transition duration-300" />
                <div className="relative grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white text-sm font-bold shadow-md">
                  {initials}
                </div>
              </div>

              <div className="leading-tight text-left">
                <div className="text-[13px] font-semibold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                  {fullName}
                </div>
                <div className="text-[11px] text-slate-600 font-medium capitalize">
                  {role.replace("_", " ")}
                </div>
              </div>
            </button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              title="Hide sidebar"
              className="h-9 w-9 rounded-xl border border-emerald-200 bg-white hover:bg-gradient-to-br hover:from-emerald-50 hover:to-cyan-50 shadow-md hover:shadow-lg transition-all"
            >
              <ChevronLeft size={18} className="text-emerald-600" />
            </Button>
          </CardHeader>

          <CardContent className="relative">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-cyan-50/50 px-3 py-2 shadow-inner backdrop-blur">
              <Search size={16} className="text-emerald-500" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search..."
                className="border-0 bg-transparent focus-visible:ring-0 text-sm placeholder:text-slate-400"
              />
            </div>
          </CardContent>
        </Card>

        <ScrollArea className="flex-1 px-3 pt-2">
          {filtered.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                cx(
                  "group relative flex items-center gap-3 rounded-xl p-2 text-[14px] font-medium transition-all mb-1",
                  isActive
                    ? [
                        "text-white",
                        "bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500",
                        "ring-1 ring-emerald-400/40",
                        "shadow-[0_14px_30px_-12px_rgba(16,185,129,0.55),0_6px_16px_-8px_rgba(2,6,23,0.25)]",
                      ].join(" ")
                    : "text-slate-700 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-cyan-50 hover:text-emerald-700"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cx(
                      "grid place-items-center h-9 w-9 rounded-[12px] border transition-colors",
                      isActive
                        ? "bg-white/20 border-white/20 text-white"
                        : "bg-white border-slate-200 text-slate-600 group-hover:text-slate-900"
                    )}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
          <div className="h-6" />
        </ScrollArea>

        <div className="m-4">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 to-red-500 rounded-2xl blur opacity-0 group-hover:opacity-50 transition duration-300" />
            <Button
              variant="destructive"
              className="relative w-full justify-start gap-3 rounded-2xl px-3 py-6 text-[14px] font-medium bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 shadow-md hover:shadow-lg transition-all"
              onClick={logout}
            >
              <span className="grid place-items-center h-9 w-9 rounded-[12px] border border-rose-200 bg-rose-50/20 text-white">
                <LogOut size={18} />
              </span>
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </aside>

      <div aria-hidden style={{ width: open ? W_FULL : 0 }} />

      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
