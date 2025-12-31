// frontend/src/components/AlertsHost.jsx
import { useEffect, useState } from "react";
import { AlertsStore, removeToast, resolveConfirm } from "../utitlities/alerts.js";
import { Check, XCircle, X } from "lucide-react";

export default function AlertsHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const unsubscribe = AlertsStore.subscribe(setItems);
    return () => unsubscribe();
  }, []);

  const hasSwal = typeof window !== "undefined" && !!window.Swal;
  const toastItems = items.filter((t) => t.type !== "confirm");
  const confirmItems = hasSwal ? [] : items.filter((t) => t.type === "confirm"); // fallback only

  return (
    <>
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3">
        {toastItems.map((t) => (
          <div
            key={t.id}
            role="status"
            className={[
              "min-w-[280px] max-w-[420px] rounded-xl px-4 py-3 shadow-lg border flex items-start gap-3",
              t.type === "success" ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200",
            ].join(" ")}
          >
            <div
              className={[
                "mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full",
                t.type === "success" ? "bg-emerald-100" : "bg-rose-100",
              ].join(" ")}
            >
              {t.type === "success" ? (
                <Check size={16} className="text-emerald-600" />
              ) : (
                <XCircle size={16} className="text-rose-600" />
              )}
            </div>
            <div className="text-sm text-slate-800 flex-1">{t.message}</div>
            <button
              onClick={() => removeToast(t.id)}
              className="opacity-60 hover:opacity-100 transition"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Fallback confirm modal (used only if Swal isn't loaded) */}
      {confirmItems.length > 0 &&
        confirmItems.map((t) => {
          const title = (t.title && String(t.title).trim()) || "Are you sure?";
          const message = (t.message && String(t.message).trim()) || "Please confirm this action.";
          const confirmText = t.confirmText || "OK";
          const cancelText = t.cancelText || "Cancel";

          return (
            <div
              key="confirm"
              className="fixed inset-0 flex items-center justify-center bg-black/40 z-[99999]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
            >
              <div className="bg-white rounded-xl p-6 shadow-lg max-w-sm w-full">
                <h2 id="confirm-title" className="text-lg font-semibold mb-2">
                  {title}
                </h2>
                <p className="text-sm text-slate-700 mb-4">{message}</p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => resolveConfirm(false)}
                    className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300"
                  >
                    {cancelText}
                  </button>
                  <button
                    onClick={() => resolveConfirm(true)}
                    className="px-3 py-1 rounded bg-rose-600 text-white hover:bg-rose-700"
                  >
                    {confirmText}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
    </>
  );
}
