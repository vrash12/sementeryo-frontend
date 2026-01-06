// frontend/src/views/admin/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  MapPin,
  Activity,
  CalendarClock,
  ArrowUpRight,
  AlertCircle,
  RefreshCcw,
  Search,
  Clock3,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { getAuth } from "@/utils/auth";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "/api";

// Chart colors
const COLORS = {
  available: "#22c55e", // green-500
  occupied: "#ef4444", // red-500
  reserved: "#f59e0b", // amber-500
  maintenance: "#64748b", // slate-500
};

function safeDateLabel(v) {
  if (!v) return "TBD";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "TBD";
  return format(d, "MMM d, yyyy");
}

function safeShortDate(v) {
  if (!v) return "TBD";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "TBD";
  return format(d, "MMM d");
}

function normalizeStatus(s) {
  return String(s || "").trim().toLowerCase();
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  // Upcoming filters
  const [upcomingQuery, setUpcomingQuery] = useState("");
  const [upcomingStatus, setUpcomingStatus] = useState("all");

  useEffect(() => {
    fetchMetrics({ initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchMetrics({ initial = false } = {}) {
    try {
      setError(null);
      if (initial) setLoading(true);
      else setRefreshing(true);

      const auth = getAuth();
      if (!auth?.token) throw new Error("Not authenticated");

      // Show all upcoming burials
      const res = await fetch(`${API_BASE}/admin/metrics?upcoming_limit=all`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });

      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const body = ct.includes("application/json") ? await res.json() : await res.text();
        const message = ct.includes("application/json")
          ? body.error || body.message || JSON.stringify(body)
          : String(body || "").slice(0, 200);
        throw new Error(message || `HTTP ${res.status}`);
      }

      if (!ct.includes("application/json")) {
        const text = await res.text();
        // eslint-disable-next-line no-console
        console.error("[Dashboard] Non-JSON response from /admin/metrics:", text);
        throw new Error("Server returned HTML instead of JSON for /admin/metrics");
      }

      const json = await res.json();
      setData(json);
      setLastUpdatedAt(new Date());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Dashboard] fetchMetrics error:", err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const counts = data?.counts || {};
  const plot_stats = data?.plot_stats || [];
  const upcoming_burials = data?.upcoming_burials || [];
  const recent_maintenance = data?.recent_maintenance || [];

  const chartData = useMemo(() => {
    return (plot_stats || []).map((item) => {
      const s = normalizeStatus(item.status);
      const name = s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";
      const value = Number.parseInt(item.count, 10) || 0;
      return {
        name,
        value,
        status: s || "unknown",
        color: COLORS[s] || "#cbd5e1",
      };
    });
  }, [plot_stats]);

  const upcomingFiltered = useMemo(() => {
    const q = upcomingQuery.trim().toLowerCase();
    const st = normalizeStatus(upcomingStatus);

    return (upcoming_burials || []).filter((x) => {
      const matchesStatus = st === "all" ? true : normalizeStatus(x.status) === st;

      if (!q) return matchesStatus;

      const bag = [
        x.deceased_name,
        x.plot_code,
        x.plot_label, // in case backend still returns plot_label
        x.status,
        x.scheduled_time,
        x.scheduled_date,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .join(" ");

      return matchesStatus && bag.includes(q);
    });
  }, [upcoming_burials, upcomingQuery, upcomingStatus]);

  const upcomingCountLabel = useMemo(() => {
    const total = upcoming_burials.length;
    const shown = upcomingFiltered.length;
    if (!total) return "0";
    if (shown === total) return String(total);
    return `${shown} of ${total}`;
  }, [upcoming_burials.length, upcomingFiltered.length]);

  if (loading) {
    return (
      <div className="p-6 pb-20 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="h-8 w-48 rounded bg-slate-200 animate-pulse" />
            <div className="mt-2 h-4 w-96 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="h-9 w-28 rounded bg-slate-200 animate-pulse" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-24 rounded bg-slate-200 animate-pulse" />
                <div className="mt-2 h-3 w-44 rounded bg-slate-200 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="h-5 w-56 rounded bg-slate-200 animate-pulse" />
            <div className="mt-2 h-4 w-72 rounded bg-slate-200 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-64 rounded bg-slate-200 animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of cemetery operations, plots, burials, and maintenance.
          </p>
          {lastUpdatedAt ? (
            <div className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              Updated {format(lastUpdatedAt, "MMM d, yyyy h:mm a")}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fetchMetrics()}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCcw className={["h-4 w-4", refreshing ? "animate-spin" : ""].join(" ")} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-rose-200">
          <AlertTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Dashboard failed to load
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <div className="break-words">{error}</div>
            <div>
              <Button variant="outline" onClick={() => fetchMetrics()}>
                Try again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Deceased"
          value={counts.total_deceased}
          icon={MapPin}
          subtext="Recorded interments"
        />
        <StatCard
          title="Registered Visitors"
          value={counts.total_visitors}
          icon={Users}
          subtext="Active accounts"
        />
        <StatCard
          title="Pending Burials"
          value={counts.pending_burials}
          icon={CalendarClock}
          subtext="Awaiting approval"
        />
        <StatCard
          title="Active Maintenance"
          value={counts.active_maintenance}
          icon={Activity}
          subtext="Open tickets"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Plot Status Chart */}
        <Card className="col-span-3 overflow-hidden">
          <CardHeader>
            <CardTitle>Plot Availability</CardTitle>
            <CardDescription>Current status distribution of all plots</CardDescription>
          </CardHeader>

          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={86}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>

                  <RechartsTooltip
                    formatter={(value, name) => [value, name]}
                    contentStyle={{ borderRadius: 12 }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              <strong>{counts.available_plots ?? 0}</strong> plots available out of{" "}
              <strong>{counts.total_plots ?? 0}</strong> total.
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Burials */}
        <Card className="col-span-4 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle>Upcoming Burials</CardTitle>
                <CardDescription>
                  Showing {upcomingCountLabel} upcoming services
                </CardDescription>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="w-full sm:w-[220px]">
                  <Label className="text-xs text-slate-500">Search</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      value={upcomingQuery}
                      onChange={(e) => setUpcomingQuery(e.target.value)}
                      placeholder="Deceased, plot, status..."
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="w-full sm:w-[160px]">
                  <Label className="text-xs text-slate-500">Status</Label>
                  <Select value={upcomingStatus} onValueChange={setUpcomingStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {upcomingFiltered.length === 0 ? (
              <div className="rounded-md border bg-slate-50 p-6 text-center text-sm text-muted-foreground">
                No upcoming burials match your filters.
              </div>
            ) : (
              <div className="max-h-[380px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead>Deceased</TableHead>
                      <TableHead>Date and Time</TableHead>
                      <TableHead>Plot</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {upcomingFiltered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.deceased_name || "Unknown"}
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold">
                              {safeDateLabel(item.scheduled_date)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.scheduled_time || "TBD"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>{item.plot_code || item.plot_label || "N/A"}</TableCell>

                        <TableCell>
                          <StatusBadge status={item.status || "pending"} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Maintenance */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Recent Maintenance Tickets</CardTitle>
            <CardDescription>Latest reported issues</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 self-start sm:self-auto"
            onClick={() => {
              // Optional: wire to your route later, example:
              // navigate("/admin/maintenance");
            }}
          >
            View All <ArrowUpRight className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {recent_maintenance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      No open maintenance requests.
                    </TableCell>
                  </TableRow>
                ) : (
                  recent_maintenance.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">
                        {ticket.requester_name || "Unknown"}
                      </TableCell>

                      <TableCell className="text-sm">
                        {ticket.request_type}
                        {ticket.category ? (
                          <span className="text-muted-foreground"> ({ticket.category})</span>
                        ) : null}
                      </TableCell>

                      <TableCell>
                        <PriorityBadge priority={ticket.priority} />
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {String(ticket.status || "").replace("_", " ") || "unknown"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right text-muted-foreground">
                        {safeShortDate(ticket.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Helper Components ---------------- */

function StatCard({ title, value, icon: Icon, subtext }) {
  const displayValue = value == null || value === "" ? "0" : String(value);

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-white to-slate-50" />
      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>

        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center">
          <Icon className="h-4 w-4 text-slate-600" />
        </div>
      </CardHeader>

      <CardContent className="relative">
        <div className="text-2xl font-bold">{displayValue}</div>
        <p className="text-xs text-muted-foreground">{subtext}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  const s = normalizeStatus(status);

  const styles = {
    pending: "bg-yellow-100 text-yellow-900 hover:bg-yellow-100",
    approved: "bg-blue-100 text-blue-900 hover:bg-blue-100",
    confirmed: "bg-indigo-100 text-indigo-900 hover:bg-indigo-100",
    completed: "bg-green-100 text-green-900 hover:bg-green-100",
    cancelled: "bg-red-100 text-red-900 hover:bg-red-100",
    canceled: "bg-red-100 text-red-900 hover:bg-red-100",
    rejected: "bg-red-100 text-red-900 hover:bg-red-100",
  };

  const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";

  return <Badge className={styles[s] || "bg-slate-100 text-slate-900"}>{label}</Badge>;
}

function PriorityBadge({ priority }) {
  const p = normalizeStatus(priority);

  const styles = {
    low: "text-slate-500",
    medium: "text-blue-600",
    high: "text-orange-600",
    urgent: "text-red-600 font-semibold",
  };

  const label = p ? p.toUpperCase() : "N/A";

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${styles[p] || "text-slate-500"}`}>
      <AlertCircle className="h-3 w-3" />
      {label}
    </span>
  );
}
