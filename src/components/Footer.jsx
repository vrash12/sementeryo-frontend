import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  Facebook,
  Twitter,
  Github,
  MapPin,
  Phone,
  Mail,
  Clock,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

export default function Footer() {
  const [siteName, setSiteName] = useState("Garden of Peace");
  const [siteDesc, setSiteDesc] = useState(
    "A sacred sanctuary where love transcends time. Our digital mapping system helps you navigate with ease while honoring cherished memories."
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/cemetery-info/`);
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const d = json?.data || json;
        if (!d || cancelled) return;
        if (d.name) setSiteName(d.name);
        if (d.description) setSiteDesc(d.description);
      } catch {
        // keep defaults on error
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-poppins overflow-hidden">
      {/* Decorative gradient blurs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-[20rem] w-[20rem] rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="absolute top-1/2 right-0 h-[20rem] w-[20rem] rounded-full bg-cyan-600/10 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-[20rem] w-[20rem] rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Brand + Socials */}
          <div className="lg:col-span-1">
            <div className="mb-6">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent mb-3">
                {siteName}
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                {siteDesc}
              </p>
            </div>

            <TooltipProvider delayDuration={150}>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-0 group-hover:opacity-75 transition duration-300"></div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="relative rounded-lg bg-slate-800/80 backdrop-blur border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
                        aria-label="Visit us on Twitter"
                      >
                        <Twitter className="h-4 w-4" />
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Twitter</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg blur opacity-0 group-hover:opacity-75 transition duration-300"></div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="relative rounded-lg bg-slate-800/80 backdrop-blur border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
                        aria-label="Visit us on Facebook"
                      >
                        <Facebook className="h-4 w-4" />
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Facebook</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg blur opacity-0 group-hover:opacity-75 transition duration-300"></div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="relative rounded-lg bg-slate-800/80 backdrop-blur border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
                        aria-label="Visit our GitHub"
                      >
                        <Github className="h-4 w-4" />
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>GitHub</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span className="h-1 w-8 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"></span>
              Services
            </h4>
            <ul className="space-y-3">
              <li>
                <NavLink
                  to="/visitor/search"
                  className={({ isActive }) =>
                    [
                      "transition-all duration-200 text-sm",
                      isActive
                        ? "text-emerald-400 font-semibold"
                        : "text-slate-300 hover:text-emerald-400 hover:translate-x-1",
                    ].join(" ")
                  }
                >
                  Search for Deceased
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/visitor/scan"
                  className={({ isActive }) =>
                    [
                      "transition-colors duration-200 text-sm",
                      isActive
                        ? "text-emerald-400 font-semibold"
                        : "text-slate-400 hover:text-emerald-400",
                    ].join(" ")
                  }
                >
                  QR Code Scanning
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/visitor/map"
                  className={({ isActive }) =>
                    [
                      "transition-colors duration-200 text-sm",
                      isActive
                        ? "text-emerald-400 font-semibold"
                        : "text-slate-400 hover:text-emerald-400",
                    ].join(" ")
                  }
                >
                  Interactive Mapping
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/visitor/inquire"
                  className={({ isActive }) =>
                    [
                      "transition-colors duration-200 text-sm",
                      isActive
                        ? "text-emerald-400 font-semibold"
                        : "text-slate-400 hover:text-emerald-400",
                    ].join(" ")
                  }
                >
                  Maintenance Requests
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/visitor/schedule"
                  className={({ isActive }) =>
                    [
                      "transition-colors duration-200 text-sm",
                      isActive
                        ? "text-emerald-400 font-semibold"
                        : "text-slate-400 hover:text-emerald-400",
                    ].join(" ")
                  }
                >
                  Burial Scheduling
                </NavLink>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span className="h-1 w-8 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full"></span>
              Quick Links
            </h4>
            <ul className="space-y-3">
              <li>
                <NavLink
                  to="/visitor/home"
                  className={({ isActive }) =>
                    [
                      "transition-colors duration-200 text-sm",
                      isActive
                        ? "text-emerald-400 font-semibold"
                        : "text-slate-400 hover:text-emerald-400",
                    ].join(" ")
                  }
                >
                  Home
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/visitor/search"
                  className={({ isActive }) =>
                    [
                      "transition-colors duration-200 text-sm",
                      isActive
                        ? "text-emerald-400 font-semibold"
                        : "text-slate-400 hover:text-emerald-400",
                    ].join(" ")
                  }
                >
                  Search For Deceased
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/visitor/inquire"
                  className={({ isActive }) =>
                    [
                      "transition-colors duration-200 text-sm",
                      isActive
                        ? "text-emerald-400 font-semibold"
                        : "text-slate-400 hover:text-emerald-400",
                    ].join(" ")
                  }
                >
                  Inquire
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/visitor/login"
                  className={({ isActive }) =>
                    [
                      "transition-colors duration-200 text-sm",
                      isActive
                        ? "text-emerald-400 font-semibold"
                        : "text-slate-400 hover:text-emerald-400",
                    ].join(" ")
                  }
                >
                  Login
                </NavLink>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span className="h-1 w-8 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full"></span>
              Contact Info
            </h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3 group">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                  <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                </div>
                <p className="text-slate-300 text-sm">
                  123 Memorial Drive
                  <br />
                  Tarlac City, Philippines 2300
                </p>
              </div>

              <div className="flex items-center gap-3 group">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                  <Phone className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                </div>
                <p className="text-slate-300 text-sm">+63 45 123 4567</p>
              </div>

              <div className="flex items-center gap-3 group">
                <div className="p-1.5 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                </div>
                <p className="text-slate-300 text-sm">info@gardenofpeace.ph</p>
              </div>

              <div className="flex items-start gap-3 group">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                  <Clock className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                </div>
                <p className="text-slate-300 text-sm">
                  Daily: 6:00 AM - 6:00 PM
                  <br />
                  Office: Mon–Fri 8:00 AM - 5:00 PM
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="relative mt-12">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center">
            <div className="h-1 w-32 bg-gradient-to-r from-emerald-500/0 via-cyan-500/50 to-emerald-500/0 rounded-full"></div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6">
              <p className="text-slate-400 text-sm">
                © {year} {siteName} Cemetery. All rights reserved.
              </p>
              <div className="flex gap-6">
                <NavLink
                  to="/privacy"
                  className={({ isActive }) =>
                    [
                      "transition-colors duration-200 text-sm",
                      isActive
                        ? "text-emerald-400 font-semibold"
                        : "text-slate-400 hover:text-emerald-400",
                    ].join(" ")
                  }
                >
                  Privacy Policy
                </NavLink>
                <NavLink
                  to="/terms"
                  className={({ isActive }) =>
                    [
                      "transition-colors duration-200 text-sm",
                      isActive
                        ? "text-emerald-400 font-semibold"
                        : "text-slate-400 hover:text-emerald-400",
                    ].join(" ")
                  }
                >
                  Terms of Service
                </NavLink>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span>Powered by</span>
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent font-medium">
                Digital Cemetery Solutions
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
