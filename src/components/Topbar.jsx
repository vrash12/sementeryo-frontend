import { Fragment, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "../components/ui/navigation-menu";
import { Separator } from "../components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";

import {
  Menu,
  LogOut,
  Ticket,
  User2,
  ChevronDown,
  ClipboardList,
} from "lucide-react";

import ProfileModal from "../components/Profile";
import MyRequest from "../components/MyRequest";
import MyDeceasedFamily from "../components/MyDeceasedFamily";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "";

// Static brand name
const SITE_NAME = "Garden of Peace";

// Optional: if you have a local logo in /public, set it here (e.g. "/logo.png").
// Leave as null to hide the logo.
const STATIC_LOGO_URL = null;

export default function Topbar() {
  const nav = useNavigate();

  const [scrolled, setScrolled] = useState(false);

  // Logo state (optional)
  const [siteLogoUrl] = useState(STATIC_LOGO_URL);
  const [logoError, setLogoError] = useState(false);

  // Modal + mobile sheet state
  const [profileOpen, setProfileOpen] = useState(false);
  const [myReqOpen, setMyReqOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [myFamilyOpen, setMyFamilyOpen] = useState(false);
  const [mobileReservationOpen, setMobileReservationOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const authRaw =
    typeof window !== "undefined" ? localStorage.getItem("auth") : null;

  const auth = useMemo(() => {
    try {
      return authRaw ? JSON.parse(authRaw) : null;
    } catch {
      return null;
    }
  }, [authRaw]);

  const role = auth?.user?.role || null;
  const showVisitorNav = !role || role === "visitor";
  const isVisitorLoggedIn = Boolean(auth?.user && role === "visitor");
  const firstName = auth?.user?.first_name || "";
  const lastName = auth?.user?.last_name || "";

  function handleLogout() {
    try {
      localStorage.removeItem("auth");
    } catch {
      // ignore
    }
    nav("/visitor/login");
  }

  const closeMobileMenus = () => {
    setMobileReservationOpen(false);
    setMobileOpen(false);
  };

  return (
    <Fragment>
      <header
        className={[
          "fixed inset-x-0 top-0 z-40 transition-all duration-300 font-poppins",
          showVisitorNav
            ? scrolled
              ? "bg-white/70 backdrop-blur-md border-b border-slate-200 shadow-sm"
              : "bg-transparent border-transparent"
            : "bg-white",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-10">
          <div className="py-5 md:py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {showVisitorNav && (
                <Sheet
                  open={mobileOpen}
                  onOpenChange={(next) => {
                    setMobileOpen(next);
                    if (!next) setMobileReservationOpen(false);
                  }}
                >
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden -ml-1 mr-1 rounded-xl text-slate-700 hover:bg-slate-100"
                      aria-label="Open menu"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>

                  <SheetContent
                    side="left"
                    className="p-0 w-80 max-w-[85%] bg-white"
                  >
                    <SheetHeader className="px-4 py-3 border-b border-slate-200">
                      <SheetTitle className="text-base">Menu</SheetTitle>
                    </SheetHeader>

                    <nav className="p-4">
                      <MobileLink
                        to="/visitor/home"
                        label="Home"
                        onNavigate={closeMobileMenus}
                      />
                      <MobileLink
                        to="/visitor/search"
                        label="Search For Deceased"
                        onNavigate={closeMobileMenus}
                      />

                      <MobileReservationMenu
                        open={mobileReservationOpen}
                        onOpenChange={setMobileReservationOpen}
                        onNavigate={closeMobileMenus}
                      />

                      {!isVisitorLoggedIn ? (
                        <MobileLink
                          to="/visitor/login"
                          label="Login"
                          onNavigate={closeMobileMenus}
                        />
                      ) : (
                        <div className="mt-2">
                          <div className="block px-4 py-3 rounded-lg text-base font-semibold text-emerald-700 bg-emerald-50">
                            Welcome {firstName} {lastName}
                          </div>

                          <div className="mt-2 grid gap-2 px-1">
                            <Button
                              variant="secondary"
                              className="justify-start"
                              onClick={() => {
                                closeMobileMenus();
                                setProfileOpen(true);
                              }}
                            >
                              <User2 className="mr-2 h-4 w-4" />
                              My Profile
                            </Button>

                            <Button
                              variant="outline"
                              className="justify-start"
                              onClick={() => {
                                closeMobileMenus();
                                setMyFamilyOpen(true);
                              }}
                            >
                              <User2 className="mr-2 h-4 w-4" />
                              My Deceased Family
                            </Button>

                            <Button
                              variant="outline"
                              className="justify-start"
                              onClick={() => {
                                closeMobileMenus();
                                setMyReqOpen(true);
                              }}
                            >
                              <Ticket className="mr-2 h-4 w-4" />
                              My Requests
                            </Button>

                            <Button
                              variant="destructive"
                              className="justify-start"
                              onClick={handleLogout}
                            >
                              <LogOut className="mr-2 h-4 w-4" />
                              Logout
                            </Button>
                          </div>
                        </div>
                      )}

                      <Separator className="my-4" />
                      <div className="px-3 text-xs uppercase tracking-wider text-slate-500">
                        Quick Actions
                      </div>

                      <div className="mt-2 grid gap-2 px-3">
                        <Button
                          asChild
                          variant="secondary"
                          className="justify-center"
                        >
                          <NavLink
                            to="/visitor/search"
                            onClick={closeMobileMenus}
                          >
                            Search
                          </NavLink>
                        </Button>

                        <div className="rounded-xl border border-slate-200 p-2">
                          <div className="text-xs font-medium text-slate-500 px-2 pb-2">
                            Reservation
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <Button
                              asChild
                              variant="outline"
                              className="justify-center"
                            >
                              <NavLink
                                to="/visitor/reservation"
                                onClick={closeMobileMenus}
                              >
                                Plot Reservation
                              </NavLink>
                            </Button>

                            <Button
                              asChild
                              variant="outline"
                              className="justify-center"
                            >
                              <NavLink
                                to="/visitor/inquire?type=burial"
                                onClick={closeMobileMenus}
                              >
                                Burial Request
                              </NavLink>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </nav>
                  </SheetContent>
                </Sheet>
              )}

              {/* Brand */}
              <div className="flex items-center gap-2">
                {siteLogoUrl && !logoError ? (
                  <img
                    src={siteLogoUrl}
                    alt="Cemetery logo"
                    className="h-8 w-8 md:h-9 md:w-9 rounded-md border object-contain bg-white"
                    crossOrigin="anonymous"
                    onError={() => setLogoError(true)}
                  />
                ) : null}

                <span className="text-2xl md:text-3xl font-extrabold tracking-tight text-emerald-700">
                  {SITE_NAME}
                </span>
              </div>
            </div>

            {showVisitorNav && (
              <div className="hidden md:flex items-center gap-2">
                <NavigationMenu>
                  <NavigationMenuList className="gap-1">
                    <NavButton to="/visitor/home" label="Home" />
                    <NavButton to="/visitor/search" label="Search For Deceased" />

                    <NavigationMenuItem>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="text-slate-600 hover:text-slate-900 gap-1.5"
                          >
                            Reservation
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent side="bottom" align="start" className="w-52">
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              nav("/visitor/reservation");
                            }}
                            className="cursor-pointer"
                          >
                            <Ticket className="mr-2 h-4 w-4" />
                            Plot Reservation
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              nav("/visitor/inquire?type=burial");
                            }}
                            className="cursor-pointer"
                          >
                            <ClipboardList className="mr-2 h-4 w-4" />
                            Burial Request
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </NavigationMenuItem>

                    {!isVisitorLoggedIn ? (
                      <NavButton to="/visitor/login" label="Login" />
                    ) : (
                      <NavigationMenuItem>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="text-emerald-700 hover:text-emerald-800 font-semibold"
                            >
                              Welcome {firstName} {lastName}
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent
                            side="bottom"
                            align="end"
                            className="w-56"
                          >
                            <DropdownMenuLabel className="font-medium">
                              Visitor
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setProfileOpen(true);
                              }}
                              className="cursor-pointer"
                            >
                              <User2 className="mr-2 h-4 w-4" />
                              My Profile
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setMyFamilyOpen(true);
                              }}
                              className="cursor-pointer"
                            >
                              <User2 className="mr-2 h-4 w-4" />
                              My Deceased Family
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setMyReqOpen(true);
                              }}
                              className="cursor-pointer"
                            >
                              <Ticket className="mr-2 h-4 w-4" />
                              My Requests
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                nav("/visitor/reservation");
                              }}
                              className="cursor-pointer"
                            >
                              <Ticket className="mr-2 h-4 w-4" />
                              Plot Reservation
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                nav("/visitor/inquire?type=burial");
                              }}
                              className="cursor-pointer"
                            >
                              <ClipboardList className="mr-2 h-4 w-4" />
                              Burial Request
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                handleLogout();
                              }}
                              className="text-rose-600 focus:text-rose-600 cursor-pointer"
                            >
                              <LogOut className="mr-2 h-4 w-4" />
                              Logout
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </NavigationMenuItem>
                    )}
                  </NavigationMenuList>
                </NavigationMenu>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modals */}
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
      <MyRequest open={myReqOpen} onOpenChange={setMyReqOpen} />
      <MyDeceasedFamily
        open={myFamilyOpen}
        onOpenChange={setMyFamilyOpen}
        burialId={auth?.user?.id}
      />

      {/* spacer for fixed header */}
      <div className="h-5" />
    </Fragment>
  );
}

function NavButton({ to, label }) {
  return (
    <NavigationMenuItem>
      <Button
        asChild
        variant="ghost"
        className="text-slate-600 hover:text-slate-900"
      >
        <NavigationMenuLink asChild>
          <NavLink
            to={to}
            className={({ isActive }) =>
              [
                "px-3 py-2 rounded-lg text-sm",
                isActive ? "text-emerald-700 font-semibold" : "",
              ].join(" ")
            }
          >
            {label}
          </NavLink>
        </NavigationMenuLink>
      </Button>
    </NavigationMenuItem>
  );
}

function MobileLink({ to, label, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "block px-4 py-3 rounded-lg text-base font-medium",
          isActive
            ? "bg-emerald-50 text-emerald-700"
            : "text-slate-700 hover:bg-slate-50",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

function MobileReservationMenu({ open, onOpenChange, onNavigate }) {
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={[
          "w-full flex items-center justify-between px-4 py-3 rounded-lg text-base font-medium transition",
          open
            ? "bg-emerald-50 text-emerald-700"
            : "text-slate-700 hover:bg-slate-50",
        ].join(" ")}
      >
        <span>Reservation</span>
        <ChevronDown
          className={[
            "h-4 w-4 transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open ? (
        <div className="mt-2 ml-3 grid gap-2 border-l border-slate-200 pl-3">
          <NavLink
            to="/visitor/reservation"
            onClick={onNavigate}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Plot Reservation
          </NavLink>

          <NavLink
            to="/visitor/inquire?type=burial"
            onClick={onNavigate}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Burial Request
          </NavLink>
        </div>
      ) : null}
    </div>
  );
}
