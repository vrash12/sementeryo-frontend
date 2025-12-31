// src/views/visitor/components/ReservationDialog.jsx
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { toast } from "sonner";

// ✅ keep this import (as you requested)
import { reservePlot } from "../js/reservation";

/**
 * reserveFn (optional):
 * - if provided, it will be used instead of the default reservePlot()
 * - admin/staff pages should pass their own reserve function
 */
export default function ReservationDialog({
  open,
  onClose,
  plot,
  onSuccess,
  reserveFn, // ✅ new prop
}) {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) setNotes("");
  }, [open]);

  const handleReserve = async () => {
    if (!plot?.id) {
      toast.error("Plot ID is missing.");
      return;
    }

    setLoading(true);
    try {
      const fn = typeof reserveFn === "function" ? reserveFn : reservePlot;

      await fn(plot.id, notes);

      toast.success("Reservation submitted successfully!");
      onSuccess?.();
      onClose?.();
    } catch (error) {
      console.error("[ReservationDialog] reserve error:", error);
      toast.error(error?.message || "Failed to reserve plot.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reserve Plot {plot?.plot_name}</DialogTitle>
          <DialogDescription>
            This will lock the plot pending approval. Add notes below (optional).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Notes / Purpose (Optional)
            </label>
            <Textarea
              placeholder="e.g., Planning for family member..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleReserve}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Reservation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
