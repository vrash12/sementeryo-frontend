// frontend/src/views/admin/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { 
  Users, 
  MapPin, 
  Activity, 
  CalendarClock, 
  ArrowUpRight, 
  AlertCircle 
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend 
} from "recharts";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAuth } from "@/utils/auth";
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "";
// Colors for the Pie Chart
const COLORS = {
  available: "#22c55e", // green-500
  occupied: "#ef4444",  // red-500
  reserved: "#f59e0b",  // amber-500
  maintenance: "#64748b" // slate-500
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMetrics();
  }, []);



async function fetchMetrics() {
  try {
    setLoading(true);

    const auth = getAuth();
    if (!auth?.token) {
      throw new Error("Not authenticated");
    }

    // ✅ use the same base as other admin pages
    const res = await fetch(`${API_BASE}/admin/metrics`, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
    });

    const ct = res.headers.get("content-type") || "";

    // If status is not ok, read either JSON or text for a meaningful error
    if (!res.ok) {
      const body = ct.includes("application/json")
        ? await res.json()
        : await res.text();

      const message = ct.includes("application/json")
        ? body.error || body.message || JSON.stringify(body)
        : body.slice(0, 200);

      throw new Error(message || `HTTP ${res.status}`);
    }

    // If server returned HTML (e.g. <!doctype ...>), don't try res.json()
    if (!ct.includes("application/json")) {
      const text = await res.text();
      console.error("[Dashboard] Non-JSON response from /admin/metrics:", text);
      throw new Error("Server returned HTML instead of JSON for /admin/metrics");
    }

    const json = await res.json();
    setData(json);
  } catch (err) {
    console.error("[Dashboard] fetchMetrics error:", err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

  if (loading) return <div className="p-8 text-center">Loading Dashboard...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!data) return null;

  const { counts, plot_stats, upcoming_burials, recent_maintenance } = data;

  // Prepare Chart Data
  const chartData = plot_stats.map(item => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    value: parseInt(item.count, 10),
    color: COLORS[item.status] || "#cbd5e1"
  }));

  return (
    <div className="space-y-6 p-6 pb-20">
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of cemetery operations and statistics.</p>
        </div>
        <Button variant="outline" onClick={fetchMetrics}>
          Refresh
        </Button>
      </div>

      {/* 2. Key Metrics Cards */}
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
        
        {/* 3. Plot Status Chart (Occupies 3 cols) */}
        <Card className="col-span-3">
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
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              <strong>{counts.available_plots}</strong> plots available out of <strong>{counts.total_plots}</strong> total.
            </div>
          </CardContent>
        </Card>

        {/* 4. Upcoming Schedule (Occupies 4 cols) */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Upcoming Burials</CardTitle>
            <CardDescription>Next 5 scheduled services</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming_burials.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No upcoming burials scheduled.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deceased</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Plot</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcoming_burials.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.deceased_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">
                            {format(new Date(item.scheduled_date), "MMM d, yyyy")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.scheduled_time || "TBD"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{item.plot_code || "N/A"}</TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. Recent Maintenance Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Maintenance Tickets</CardTitle>
            <CardDescription>Latest reported issues</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="gap-1">
            View All <ArrowUpRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
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
                    <TableCell>{ticket.request_type} ({ticket.category})</TableCell>
                    <TableCell>
                      <PriorityBadge priority={ticket.priority} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {ticket.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {format(new Date(ticket.created_at), "MMM d")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Helper Components ---

function StatCard({ title, value, icon: Icon, subtext }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtext}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    approved: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    completed: "bg-green-100 text-green-800 hover:bg-green-100",
    cancelled: "bg-red-100 text-red-800 hover:bg-red-100",
  };
  return (
    <Badge className={styles[status] || "bg-gray-100 text-gray-800"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    low: "text-slate-500",
    medium: "text-blue-500",
    high: "text-orange-500",
    urgent: "text-red-500 font-bold",
  };
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${styles[priority]}`}>
      <AlertCircle className="h-3 w-3" />
      {priority.toUpperCase()}
    </span>
  );
}