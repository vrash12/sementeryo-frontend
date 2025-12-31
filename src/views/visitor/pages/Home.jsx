// frontend/src/views/visitor/pages/Home.jsx
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

// shadcn/ui
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardTitle } from "../../../components/ui/card";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Separator } from "../../../components/ui/separator";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

// ✅ Static site info
const SITE = {
  name: "Garden of Peace",
  slogan: "Where memories bloom eternal",
  description:
    "A sacred sanctuary where love transcends time. Our digital mapping system helps you navigate with ease while honouring the cherished memories of your loved ones.",
};

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const [showSecondSection, setShowSecondSection] = useState(false);
  const [showStatsSection, setShowStatsSection] = useState(false);
  const [showTestimonials, setShowTestimonials] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Current animated values
  const [counters, setCounters] = useState({
    visitors: 0,
    graves: 0,
    requests: 0,
    families: 0,
    years: 0,
  });

  // Target values fetched from API (fallback defaults)
  const [fetchedTargets, setFetchedTargets] = useState({
    visitors: 1247,
    graves: 892,
    requests: 156,
    families: 634,
    years: 25,
  });

  // Fetch dynamic dashboard stats (✅ correct endpoint: /visitor/dashboard-stats)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/visitor/dashboard-stats`);
        const json = await res.json().catch(() => null);
        if (!cancelled && json?.success && json?.data) {
          setFetchedTargets({
            visitors: Number(json.data.visitors || 0),
            graves: Number(json.data.graves || 0),
            requests: Number(json.data.requests || 0),
            families: Number(json.data.families || 0),
            years: Number(json.data.years || 0),
          });
        }
      } catch {
        // keep fallback on error
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const testimonials = [
    {
      id: 1,
      text:
        "Finding my grandmother's grave was so much easier with this system. The QR code scanning and GPS navigation saved us hours of searching.",
      name: "Maria Santos",
      role: "Family Member",
      avatar: "MS",
      gradient: "from-rose-400/20 via-pink-400/15 to-fuchsia-400/20",
      avatarBg: "bg-rose-100 text-rose-700",
    },
    {
      id: 2,
      text:
        "The digital mapping system helped us locate our father's resting place quickly during our visit. The technology is respectful and very helpful.",
      name: "Roberto Cruz",
      role: "Visitor",
      avatar: "RC",
      gradient: "from-blue-400/20 via-cyan-400/15 to-teal-400/20",
      avatarBg: "bg-blue-100 text-blue-700",
    },
    {
      id: 3,
      text:
        "As a frequent visitor, I appreciate how easy it is to report maintenance issues through the app. The staff responds quickly to our concerns.",
      name: "Carmen Delgado",
      role: "Regular Visitor",
      avatar: "CD",
      gradient: "from-purple-400/20 via-violet-400/15 to-indigo-400/20",
      avatarBg: "bg-purple-100 text-purple-700",
    },
    {
      id: 4,
      text:
        "The search feature is amazing. I was able to find my uncle's grave by just typing his name. Much better than the old paper records.",
      name: "Jose Reyes",
      role: "Family Member",
      avatar: "JR",
      gradient: "from-amber-400/20 via-orange-400/15 to-red-400/20",
      avatarBg: "bg-amber-100 text-amber-700",
    },
  ];

  // Scroll animations
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);

    const handleScroll = () => {
      const y = window.scrollY;
      const h = window.innerHeight;

      if (y > h * 0.3) setShowSecondSection(true);
      if (y > h * 0.8) setShowStatsSection(true);
      if (y > h * 1.2) setShowTestimonials(true);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Number counting animation (with cleanup)
  useEffect(() => {
    if (!showStatsSection) return;

    const duration = 1800;
    const steps = 60;
    const stepTime = Math.max(16, Math.floor(duration / steps));
    const keys = Object.keys(fetchedTargets);

    // reset to zero before animating
    setCounters((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = 0;
      return next;
    });

    const timers = [];

    for (const key of keys) {
      const target = Number(fetchedTargets[key] || 0);
      const inc = target / steps;
      let step = 0;

      const t = setInterval(() => {
        step++;
        const val = Math.min(Math.round(inc * step), target);
        setCounters((p) => ({ ...p, [key]: val }));
        if (step >= steps) clearInterval(t);
      }, stepTime);

      timers.push(t);
    }

    return () => {
      timers.forEach(clearInterval);
    };
  }, [showStatsSection, fetchedTargets]);

  // Testimonial carousel
  useEffect(() => {
    if (!showTestimonials) return;

    const t = setInterval(() => {
      setCurrentTestimonial((prev) =>
        prev === testimonials.length - 1 ? 0 : prev + 1
      );
    }, 4000);

    return () => clearInterval(t);
  }, [showTestimonials, testimonials.length]);

  return (
    <div className="relative">
      {/* global backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_70%_10%,theme(colors.emerald.100/.6),transparent_70%)] dark:bg-[radial-gradient(60%_40%_at_70%_10%,theme(colors.emerald.900/.15),transparent_70%)]" />
        <div className="absolute -top-24 -left-24 h-[32rem] w-[32rem] rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-500/10" />
        <div className="absolute -bottom-32 -right-28 h-[28rem] w-[28rem] rounded-full bg-slate-200/40 blur-3xl dark:bg-slate-700/20" />
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden font-poppins h-[92vh] md:h-screen flex items-center bg-gradient-to-br from-emerald-100 via-cyan-50 to-blue-100">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Copy + CTAs */}
            <div
              className={[
                "transition-all duration-1000 ease-out",
                isVisible ? "translate-x-0 opacity-100" : "-translate-x-12 opacity-0",
              ].join(" ")}
            >
              <div
                className={[
                  "inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-4 py-2 text-sm text-slate-700 shadow-sm backdrop-blur",
                  "transition-all duration-1000 ease-out delay-100",
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                ].join(" ")}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Digital Cemetery Mapping & Visitor Support
              </div>

              <h1
                className={[
                  "mt-5 text-4xl sm:text-5xl font-extrabold leading-tight text-slate-900",
                  "transition-all duration-1000 ease-out delay-150",
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
                ].join(" ")}
              >
                Welcome to
                <br />
                <span className="text-emerald-700">{SITE.name}</span>
              </h1>

              <p
                className={[
                  "mt-6 text-xl text-slate-600 font-medium italic",
                  "transition-all duration-1000 ease-out delay-300",
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
                ].join(" ")}
              >
                “{SITE.slogan}”
              </p>

              <p
                className={[
                  "mt-4 text-lg text-slate-700 max-w-xl",
                  "transition-all duration-1000 ease-out delay-500",
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
                ].join(" ")}
              >
                {SITE.description}
              </p>

              <div
                className={[
                  "mt-8 flex flex-wrap gap-3",
                  "transition-all duration-1000 ease-out delay-700",
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
                ].join(" ")}
              >
                <Button asChild size="lg" className="rounded-full shadow-md hover:shadow-lg">
                  <NavLink to="/visitor/search">Find a Grave</NavLink>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="rounded-full bg-slate-700 text-white hover:bg-slate-800 shadow-md hover:shadow-lg"
                >
                  <NavLink to="/visitor/search">Scan QR Code</NavLink>
                </Button>
              </div>

              <div
                className={[
                  "mt-8 flex flex-wrap items-center gap-4 text-sm text-slate-600",
                  "transition-all duration-1000 ease-out delay-900",
                  isVisible ? "opacity-100" : "opacity-0",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/80" />
                  Respectful navigation
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-cyan-500/80" />
                  Plot search + QR
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-slate-500/80" />
                  Maintenance reporting
                </div>
              </div>
            </div>

            {/* Hero image callouts */}
            <div
              className={[
                "relative transition-all duration-1000 ease-out delay-200",
                isVisible
                  ? "translate-x-0 opacity-100 scale-100"
                  : "translate-x-12 opacity-0 scale-[.97]",
              ].join(" ")}
            >
              <div className="relative mx-auto max-w-lg">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-r from-emerald-200/30 via-slate-200/20 to-emerald-200/30 rounded-[2rem] blur-xl dark:from-emerald-900/20 dark:via-slate-800/20 dark:to-emerald-900/20" />
                  <img
                    src="/hero-image.jpg"
                    alt="Garden of Peace Cemetery"
                    className={[
                      "relative w-full h-auto rounded-3xl border border-white/60 dark:border-white/10",
                      "shadow-[0_40px_80px_-24px_rgba(2,6,23,.25)] dark:shadow-[0_40px_80px_-24px_rgba(0,0,0,.4)]",
                      "transition-all duration-1000 ease-out delay-300",
                      isVisible ? "opacity-100 scale-100" : "opacity-0 scale-[.98]",
                    ].join(" ")}
                  />
                </div>

                <Card
                  className={[
                    "absolute -bottom-6 -left-6 w-max",
                    "transition-all duration-800 ease-out delay-700",
                    isVisible
                      ? "translate-y-0 translate-x-0 opacity-100"
                      : "translate-y-3 -translate-x-3 opacity-0",
                    "bg-white/70 dark:bg-white/5 backdrop-blur supports-[backdrop-filter]:bg-white/40 border border-white/60 dark:border-white/10 shadow-lg",
                  ].join(" ")}
                >
                  <CardContent className="p-4">
                    <div className="text-base text-slate-700 font-medium">
                      Interactive Navigation
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={[
                    "absolute -top-6 -right-6 w-max",
                    "transition-all duration-800 ease-out delay-800",
                    isVisible
                      ? "translate-y-0 translate-x-0 opacity-100"
                      : "-translate-y-3 translate-x-3 opacity-0",
                    "bg-white/70 dark:bg-white/5 backdrop-blur supports-[backdrop-filter]:bg-white/40 border border-white/60 dark:border-white/10 shadow-lg",
                  ].join(" ")}
                >
                  <CardContent className="p-4">
                    <div className="text-base text-slate-700 font-medium">Easy Search</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* scroll cue */}
        <div
          className={[
            "absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-1000 ease-out delay-1000",
            isVisible ? "opacity-80 translate-y-0" : "opacity-0 translate-y-3",
          ].join(" ")}
        >
          <div className="animate-bounce">
            <div className="w-6 h-10 border-2 border-slate-400 rounded-full flex justify-center">
              <div className="w-1 h-3 bg-slate-400 rounded-full mt-2 animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        className={[
          "bg-slate-50 py-16 lg:py-24 font-poppins transition-all duration-1000 ease-out",
          showSecondSection ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <div
            className={[
              "text-center mb-14",
              "transition-all duration-700 ease-out delay-150",
              showSecondSection ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
            ].join(" ")}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              Simplify Your Visit
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A seamless, respectful experience for families visiting their loved ones—powered by
              thoughtful technology.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Easy Search",
                body: "Find graves quickly by searching with names, dates, or plot numbers.",
                gradient: "from-teal-400/30 via-cyan-400/20 to-blue-400/30",
                borderAccent: "border-t-2 border-teal-400/50 group-hover:border-teal-500/70",
                iconBg:
                  "bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950/40 dark:to-teal-900/30",
                iconColor: "text-teal-600 dark:text-teal-400",
                icon: (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    <circle cx="16" cy="16" r="1.5" fill="currentColor" />
                  </svg>
                ),
              },
              {
                title: "QR Code Integration",
                body: "Scan QR codes on markers for instant memorial info and location details.",
                gradient: "from-indigo-400/30 via-purple-400/20 to-pink-400/30",
                borderAccent: "border-t-2 border-indigo-400/50 group-hover:border-indigo-500/70",
                iconBg:
                  "bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/40 dark:to-indigo-900/30",
                iconColor: "text-indigo-600 dark:text-indigo-400",
                icon: (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM13 21h8v-8h-8v8zm2-6h4v4h-4v-4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM16 3v4h4V3h-4zM9 3v4h4V3H9z" />
                  </svg>
                ),
              },
              {
                title: "Precise Mapping",
                body: "GPS-enabled maps show the shortest, clearest path to any plot.",
                gradient: "from-cyan-400/30 via-blue-400/20 to-indigo-400/30",
                borderAccent: "border-t-2 border-cyan-400/50 group-hover:border-cyan-500/70",
                iconBg:
                  "bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950/40 dark:to-cyan-900/30",
                iconColor: "text-cyan-600 dark:text-cyan-400",
                icon: (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                ),
              },
              {
                title: "Maintenance Requests",
                body: "Report needs directly so staff can respond quickly and respectfully.",
                gradient: "from-orange-400/30 via-amber-400/20 to-yellow-400/30",
                borderAccent: "border-t-2 border-orange-400/50 group-hover:border-orange-500/70",
                iconBg:
                  "bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/30",
                iconColor: "text-orange-600 dark:text-orange-400",
                icon: (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
            ].map((f, i) => (
              <Card
                key={f.title}
                className={[
                  "group relative overflow-hidden rounded-2xl transition-all duration-500 ease-out",
                  "bg-white/90 dark:bg-white/10 backdrop-blur-sm border border-white/60 dark:border-white/10",
                  f.borderAccent,
                  "hover:shadow-xl hover:-translate-y-2 hover:scale-[1.02]",
                  "hover:bg-white/95 dark:hover:bg-white/15",
                  showSecondSection ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
                ].join(" ")}
                style={{ transitionDelay: showSecondSection ? `${250 + i * 100}ms` : "0ms" }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-100 transition-opacity duration-500`} />

                <CardContent className="relative p-7 text-center">
                  <div
                    className={`w-16 h-16 rounded-2xl mb-6 mx-auto grid place-items-center ${f.iconBg} ${f.iconColor} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}
                  >
                    {f.icon}
                  </div>
                  <CardTitle className="text-xl mb-3 text-slate-900 dark:text-slate-100">
                    {f.title}
                  </CardTitle>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {f.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section
        className={[
          "bg-gradient-to-br from-emerald-50 via-cyan-50 to-blue-50 py-16 lg:py-20 font-poppins transition-all duration-1000 ease-out",
          showStatsSection ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              {
                label: "Happy Visitors",
                value: counters.visitors.toLocaleString(),
                gradient: "from-emerald-500/20 to-emerald-600/10",
                iconBg:
                  "bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/30",
                iconColor: "text-emerald-600 dark:text-emerald-400",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                ),
              },
              {
                label: "Graves Mapped",
                value: counters.graves.toLocaleString(),
                gradient: "from-blue-500/20 to-blue-600/10",
                iconBg:
                  "bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/30",
                iconColor: "text-blue-600 dark:text-blue-400",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7"
                    />
                  </svg>
                ),
              },
              {
                label: "Requests Served",
                value: counters.requests,
                gradient: "from-violet-500/20 to-violet-600/10",
                iconBg:
                  "bg-gradient-to-br from-violet-100 to-violet-200 dark:from-violet-900/40 dark:to-violet-800/30",
                iconColor: "text-violet-600 dark:text-violet-400",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ),
              },
              {
                label: "Families Helped",
                value: counters.families.toLocaleString(),
                gradient: "from-rose-500/20 to-rose-600/10",
                iconBg:
                  "bg-gradient-to-br from-rose-100 to-rose-200 dark:from-rose-900/40 dark:to-rose-800/30",
                iconColor: "text-rose-600 dark:text-rose-400",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                ),
              },
              {
                label: "Years of Service",
                value: `${counters.years}+`,
                gradient: "from-amber-500/20 to-amber-600/10",
                iconBg:
                  "bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/30",
                iconColor: "text-amber-600 dark:text-amber-400",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ),
              },
            ].map((s, i) => (
              <Card
                key={s.label}
                className={[
                  "group relative overflow-hidden transition-all duration-700 ease-out",
                  "bg-white/80 dark:bg-white/10 backdrop-blur-sm border border-white/60 dark:border-white/10",
                  "hover:shadow-xl hover:-translate-y-1 hover:scale-105",
                  "hover:bg-white/90 dark:hover:bg-white/15",
                  showStatsSection ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
                ].join(" ")}
                style={{ transitionDelay: showStatsSection ? `${150 + i * 100}ms` : "0ms" }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-100 transition-opacity duration-500`} />
                <CardContent className="relative py-8 px-6 text-center">
                  <div
                    className={`w-12 h-12 rounded-xl mx-auto mb-4 grid place-items-center ${s.iconBg} ${s.iconColor} transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}
                  >
                    {s.icon}
                  </div>
                  <div className="text-4xl lg:text-5xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                    {s.value}
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 font-medium text-sm">
                    {s.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section
        className={[
          "bg-slate-50 py-16 lg:py-24 font-poppins transition-all duration-1000 ease-out",
          showTestimonials ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <div
            className={[
              "text-center mb-14",
              "transition-all duration-700 ease-out",
              showTestimonials ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
            ].join(" ")}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              What families say about {SITE.name}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Hear from the families who’ve experienced the peace of mind that comes with our
              digital cemetery management system.
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setCurrentTestimonial(
                  currentTestimonial === 0 ? testimonials.length - 1 : currentTestimonial - 1
                )
              }
              className="flex-shrink-0 rounded-full bg-white shadow-md hover:shadow-lg"
              aria-label="Previous testimonial"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </Button>

            <div className="overflow-hidden w-full flex-1">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentTestimonial * 100}%)` }}
              >
                {testimonials.map((t) => (
                  <div key={t.id} className="w-full flex-shrink-0 px-4">
                    <div className="relative">
                      <div
                        className={`absolute -inset-2 bg-gradient-to-br ${t.gradient} rounded-2xl blur-xl opacity-30`}
                      />

                      <Card className="relative overflow-hidden shadow-lg bg-white/80 dark:bg-white/5 backdrop-blur supports-[backdrop-filter]:bg-white/40 border border-white/60 dark:border-white/10">
                        <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient}`} />
                        <CardContent className="relative p-8 text-center max-w-2xl mx-auto">
                          <Avatar className="h-16 w-16 mx-auto mb-6">
                            <AvatarFallback className={`${t.avatarBg} font-semibold`}>
                              {t.avatar}
                            </AvatarFallback>
                          </Avatar>

                          <p className="text-lg text-slate-700 mb-6 italic leading-relaxed">
                            "{t.text}"
                          </p>

                          <Separator className="my-5" />

                          <div>
                            <div className="font-semibold text-slate-900 text-lg">{t.name}</div>
                            <div className="text-slate-600 text-sm mt-1">{t.role}</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setCurrentTestimonial(
                  currentTestimonial === testimonials.length - 1 ? 0 : currentTestimonial + 1
                )
              }
              className="flex-shrink-0 rounded-full bg-white shadow-md hover:shadow-lg"
              aria-label="Next testimonial"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="flex justify-center mt-8 space-x-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentTestimonial(i)}
                  className={[
                    "w-3 h-3 rounded-full transition-all",
                    i === currentTestimonial ? "bg-emerald-600" : "bg-slate-300 hover:bg-slate-400",
                  ].join(" ")}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
