// frontend/src/views/admin/components/ViewModal.jsx
import { useMemo, useState } from "react";
import { X, Copy, Check, Info } from "lucide-react";

// shadcn/ui
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";

/* ---------- helpers ---------- */
const labelize = (k) =>
  String(k).replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const isNil = (v) => v == null || v === "";
const isDateKey = (k) =>
  /(^|_)(date|datetime|created|updated|created_at|updated_at)\b/i.test(k);
const isMoneyKey = (k) => /(price|amount|fee|cost)/i.test(k);
const isCoordKey = (k) => /(coord|latitude|longitude|lat|lng)/i.test(k);
const isStatusKey = (k) => /(status)/i.test(k);

const fmtMoney = (v) => {
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `₱${n.toFixed(2)}`;
  }
};
const fmtDate = (v) => {
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleString();
};

function normalizeEntry(k, raw) {
  const label = labelize(k);
  let iconNode = null;
  let value = raw;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if ("value" in raw) value = raw.value;
    if ("icon" in raw) {
      const ic = raw.icon;
      if (ic && typeof ic === "object") iconNode = ic;
      else if (typeof ic === "function") {
        const IconComp = ic;
        iconNode = <IconComp size={16} />;
      }
    }
  }

  let valueText;
  if (isNil(value)) valueText = "—";
  else if (isDateKey(k)) valueText = fmtDate(value);
  else if (isMoneyKey(k)) valueText = fmtMoney(value);
  else if (isCoordKey(k) && typeof value === "string") {
    const m = value.match(/(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)/);
    valueText = m
      ? `${parseFloat(m[1]).toFixed(6)}, ${parseFloat(m[3]).toFixed(6)}`
      : String(value);
  } else if (typeof value === "object") valueText = JSON.stringify(value);
  else valueText = String(value);

  return { label, valueRaw: value, valueText, iconNode };
}

function StatusPill({ text }) {
  const t = (text || "").toString().toLowerCase();
  const cls =
    t === "available"
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : t === "reserved"
      ? "bg-amber-100 text-amber-700 ring-amber-200"
      : t === "occupied"
      ? "bg-rose-100 text-rose-700 ring-rose-200"
      : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-semibold ring-1 ${cls}`}>
      {text ?? "—"}
    </span>
  );
}

function CopyButton({ text, className = "" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text ?? "");
          setCopied(true);
          setTimeout(() => setCopied(false), 900);
        } catch {}
      }}
      className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-50 ${className}`}
      title="Copy"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function ViewModal({ open, onClose, data }) {
  const entries = useMemo(() => Object.entries(data || {}), [data]);
  const get = (k) => {
    const v = data?.[k];
    return v && typeof v === "object" && "value" in v ? v.value : v;
  };
  const title = get("plot_code") || get("id") || "Plot Details";

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose?.() : null)}>
      <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Full details for this record</DialogDescription>
        </DialogHeader>

        <div className="max-h-[64vh] overflow-auto pr-1 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {entries.map(([k, raw]) => {
              const { label, valueText, iconNode } = normalizeEntry(k, raw);

              if (isStatusKey(k)) {
                return (
                  <div
                    key={k}
                    className="border border-slate-200 rounded-xl p-3 bg-white"
                  >
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                      {label}
                    </div>
                    <StatusPill text={valueText} />
                  </div>
                );
              }

              return (
                <div
                  key={k}
                  className="group border border-slate-200 rounded-xl p-3 bg-white/80 hover:bg-white transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600">
                      {iconNode ? (
                        iconNode
                      ) : (
                        <span className="text-[11px] font-semibold">
                          {label.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                          {label}
                        </div>
                        <CopyButton
                          text={
                            typeof raw === "object" && raw && "value" in raw
                              ? raw.value
                              : valueText
                          }
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </div>

                      <div
                        className={
                          "mt-0.5 text-sm font-medium text-slate-900 break-words " +
                          (isMoneyKey(k) ? "tabular-nums" : "")
                        }
                      >
                        {valueText}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 text-[11px] text-slate-500 flex items-center gap-2">
          <Info size={14} /> Press{" "}
          <span className="px-1.5 py-0.5 border rounded bg-slate-50">Esc</span> to
          close
        </div>
      </DialogContent>
    </Dialog>
  );
}
