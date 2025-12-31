// frontend/src/views/staff/pages/ViewTickets.jsx
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "../../../components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../../components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";
import { Eye, Trash2, CheckCircle2, XCircle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { Badge } from "../../../components/ui/badge";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

// /staff/change-status/:id (type sent in body)
const STATUS_ENDPOINT = (id) => `${API_BASE}/staff/change-status/${id}`;

// ---- helpers ----
function pad2(n) { const s = String(n); return s.length === 1 ? `0${s}` : s; }
function formatDisplayDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.toLocaleString(undefined, { month: "long" });
  const day = pad2(d.getDate());
  const year = d.getFullYear();
  return `${month}, ${day}, ${year}`;
}

export default function ViewTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ type: "all", status: "all" });

  // 🔐 auth token from localStorage
  const authRaw = typeof window !== "undefined" ? localStorage.getItem("auth") : null;
  const token = useMemo(() => {
    try { const parsed = authRaw ? JSON.parse(authRaw) : null; return parsed?.token ?? null; }
    catch { return null; }
  }, [authRaw]);

  // Modals
  const [viewTicket, setViewTicket] = useState(null);
  const [deleteTicket, setDeleteTicket] = useState(null);

  // Fetch tickets (with token)
  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/staff/get-all-tickets/`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching tickets:", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchTickets();
  }, [token]);

  // Sort: pending (latest first) → approved → canceled
  const sortedTickets = useMemo(() => {
    const rank = { pending: 0, approved: 1, canceled: 2, cancelled: 2 };
    return [...tickets]
      .sort((a, b) => {
        const oa = rank[String(a.status).toLowerCase()] ?? 3;
        const ob = rank[String(b.status).toLowerCase()] ?? 3;
        if (oa !== ob) return oa - ob;
        return new Date(b.created_at) - new Date(a.created_at);
      })
      .filter((t) =>
        (filters.type === "all" || t.type === filters.type) &&
        (filters.status === "all" || String(t.status).toLowerCase() === filters.status)
      );
  }, [tickets, filters]);

  function statusBadge(status) {
    const s = String(status || "").toLowerCase();
    if (s === "approved")
      return <Badge className="bg-green-600 hover:bg-green-600 text-white">Approved</Badge>;
    if (s === "canceled" || s === "cancelled")
      return <Badge className="bg-red-600 hover:bg-red-600 text-white">Canceled</Badge>;
    return <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white">Pending</Badge>;
  }

  // ---- Actions ----
  async function updateStatus(ticket, newStatus /* "approved" | "canceled" */) {
    const payloadStatus = String(newStatus).toLowerCase(); // ensure lowercase
    try {
      const res = await fetch(STATUS_ENDPOINT(ticket.id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: payloadStatus, type: ticket.type }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();

      // Update local list
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticket.id && t.type === ticket.type ? { ...t, ...updated } : t
        )
      );
    } catch (err) {
      console.error("Failed to update status:", err);
      // TODO: toast error
    }
  }

  return (
    <Card className="m-4">
      {/* HEADER — title only */}
      <div className="px-6 pt-6">
        <h2 className="text-xl font-semibold leading-none tracking-tight">View Tickets</h2>
        <p className="text-sm text-muted-foreground">Manage burial & maintenance requests</p>
      </div>

      {/* FILTERS */}
      <div className="px-6 pb-4 pt-2 flex flex-col sm:flex-row gap-2 justify-end">
        <div className="w-full sm:w-44">
          <Label className="sr-only">Ticket Type</Label>
          <Select
            value={filters.type}
            onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="burial">Burial</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-44">
          <Label className="sr-only">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All</SelectItem>
              {/* lowercase values for requests; nice labels for UI */}
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <CardContent>
        <Separator className="mb-4" />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Deceased Name</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested On</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : sortedTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">No tickets found.</TableCell>
              </TableRow>
            ) : (
              sortedTickets.map((t) => {
                const s = String(t.status).toLowerCase();
                const approveDisabled = s === "approved" || s === "canceled" || s === "cancelled";

                return (
                  <TableRow key={`${t.type}-${t.id}`}>
                    <TableCell className="capitalize">{t.type}</TableCell>
                    <TableCell>{t.deceased_name || "—"}</TableCell>
                    <TableCell>{t.family_contact_name || "—"}</TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
                    <TableCell>{t.created_at ? formatDisplayDate(t.created_at) : "—"}</TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      {/* View */}
                      <Button size="icon" variant="outline" onClick={() => setViewTicket(t)} title="View">
                        <Eye className="w-4 h-4" />
                      </Button>

                      {/* Approve (confirm) */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="outline" title="Approve" disabled={approveDisabled}>
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Approve this ticket?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will mark the ticket as <b>approved</b>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>No</AlertDialogCancel>
                            {/* send lowercase "approved" */}
                            <AlertDialogAction onClick={() => updateStatus(t, "approved")}>
                              Yes, approve
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {/* Cancel (confirm) */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="destructive"
                            title="Cancel"
                            disabled={s === "canceled" || s === "cancelled"}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel this ticket?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will mark the ticket as <b>canceled</b>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>No</AlertDialogCancel>
                            {/* send lowercase "canceled" */}
                            <AlertDialogAction onClick={() => updateStatus(t, "canceled")}>
                              Yes, cancel
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* View Modal — read-only inputs in a clean grid */}
      <Dialog open={!!viewTicket} onOpenChange={() => setViewTicket(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Ticket Details</DialogTitle></DialogHeader>
          {viewTicket && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Ticket ID</Label><Input value={String(viewTicket.id ?? "")} readOnly /></div>
              <div className="space-y-2"><Label>Type</Label><Input value={String(viewTicket.type ?? "")} readOnly /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Deceased Name</Label><Input value={String(viewTicket.deceased_name ?? "")} readOnly /></div>
              <div className="space-y-2"><Label>Requested By</Label><Input value={String(viewTicket.family_contact_name ?? "")} readOnly /></div>
              <div className="space-y-2"><Label>Status</Label><Input value={String(viewTicket.status ?? "")} readOnly /></div>
              <div className="space-y-2"><Label>Requested On</Label><Input value={viewTicket.created_at ? formatDisplayDate(viewTicket.created_at) : ""} readOnly /></div>
              {viewTicket.birth_date ? (<div className="space-y-2"><Label>Birth Date</Label><Input value={formatDisplayDate(viewTicket.birth_date)} readOnly /></div>) : null}
              {viewTicket.death_date ? (<div className="space-y-2"><Label>Death Date</Label><Input value={formatDisplayDate(viewTicket.death_date)} readOnly /></div>) : null}
              {viewTicket.burial_date ? (<div className="space-y-2"><Label>Burial Date</Label><Input value={formatDisplayDate(viewTicket.burial_date)} readOnly /></div>) : null}
            </div>
          )}
          <DialogFooter className="mt-4"><Button onClick={() => setViewTicket(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
