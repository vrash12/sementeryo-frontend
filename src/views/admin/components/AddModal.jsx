// frontend/src/views/admin/components/AddModal.jsx
import { useEffect, useState } from "react";
import { X } from "lucide-react";

// shadcn/ui
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";

export default function AddModal({ open, onClose, data, onSubmit, title = "Add Plot" }) {
  const [form, setForm] = useState(data || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setForm(data || {});
  }, [open, data]);

  const handleChange = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!onSubmit) return;
    setError("");
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const HIDDEN_KEYS = new Set(["_feature", "created_at", "updated_at"]);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose?.() : null)}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Fill in the details below. You can add latitude & longitude or a combined coordinates string.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-5">
          {/* When no data is provided, show minimal helpful seed */}
          {Object.keys(form).length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {["plot_code", "plot_name", "plot_type", "size_sqm", "status", "latitude", "longitude"].map((k) => (
                <div key={k} className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 capitalize">
                    {k.replaceAll("_", " ")}
                  </label>

                  {k === "status" ? (
                    <select
                      value={form[k] ?? ""}
                      onChange={(e) => handleChange(k, e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-0"
                    >
                      <option value="">— Select Status —</option>
                      <option value="available">Available</option>
                      <option value="reserved">Reserved</option>
                      <option value="occupied">Occupied</option>
                    </select>
                  ) : (
                    <Input
                      value={form[k] ?? ""}
                      onChange={(e) => handleChange(k, e.target.value)}
                      className="h-9"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Dynamic renderer (same pattern as EditModal) */}
          {Object.keys(form).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(form)
                .filter(([k]) => !HIDDEN_KEYS.has(k))
                .map(([k, v]) => {
                  if (k === "status") {
                    return (
                      <div key={k} className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600 capitalize">
                          {k.replaceAll("_", " ")}
                        </label>
                        <select
                          value={v ?? ""}
                          onChange={(e) => handleChange(k, e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-0"
                        >
                          <option value="">— Select Status —</option>
                          <option value="available">Available</option>
                          <option value="reserved">Reserved</option>
                          <option value="occupied">Occupied</option>
                        </select>
                      </div>
                    );
                  }

                  return (
                    <div key={k} className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600 capitalize">
                        {k.replaceAll("_", " ")}
                      </label>
                      <Input
                        value={v ?? ""}
                        onChange={(e) => handleChange(k, e.target.value)}
                        className="h-9"
                      />
                    </div>
                  );
                })}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>

        <p className="mt-2 text-[11px] text-slate-500">
          Tip: You can fill <span className="font-medium">latitude</span> &{" "}
          <span className="font-medium">longitude</span>, or provide a{" "}
          <span className="font-medium">coordinates</span> string like{" "}
          <code>15.495391, 120.555058</code> or <code>POINT (120.555058 15.495391)</code>.
        </p>
      </DialogContent>
    </Dialog>
  );
}
