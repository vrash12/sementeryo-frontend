//frontend/src/views/visitor/pages/MyReservations.jsx
import { useEffect, useState } from "react";
import { getMyReservations, cancelReservation } from "../js/reservation";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Loader2, CalendarX, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function MyReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const data = await getMyReservations();
      setReservations(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const handleCancel = async (id) => {
    if (!confirm("Are you sure you want to cancel this reservation?")) return;
    setActionLoading(id);
    try {
      await cancelReservation(id);
      toast.success("Reservation cancelled.");
      fetchReservations(); // Refresh list
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" /></div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6 font-poppins">
      <h1 className="text-3xl font-bold text-slate-900">My Reservations</h1>
      
      {reservations.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
          <CalendarX className="h-12 w-12 mx-auto text-slate-400 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No Reservations Found</h3>
          <p className="text-slate-500">You haven't reserved any burial plots yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reservations.map((res) => (
            <Card key={res.id} className="overflow-hidden border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Plot: {res.plot_code || "Unknown"}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{res.section_name}</p>
                </div>
                <StatusBadge status={res.status} />
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-slate-700 mt-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Date Requested:</span>
                    <span>{new Date(res.reservation_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Size:</span>
                    <span>{res.size_sqm} sqm</span>
                  </div>
                  {res.notes && (
                    <div className="bg-slate-50 p-3 rounded-md text-xs italic text-slate-600 mt-3 border">
                      "{res.notes}"
                    </div>
                  )}
                </div>
                
                {res.status === 'pending' && (
                  <div className="mt-4 pt-4 border-t flex justify-end">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleCancel(res.id)}
                      disabled={actionLoading === res.id}
                    >
                      {actionLoading === res.id ? "Cancelling..." : "Cancel Reservation"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected: "bg-rose-100 text-rose-800 border-rose-200",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <Badge className={`${styles[status] || styles.pending} border capitalize`}>
      {status}
    </Badge>
  );
}