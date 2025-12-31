// frontend/src/utitlities/alerts.js
// Keeps the same public API: subscribe, removeToast, showSuccess, showError,
// confirmWarning({ title, message, confirmText, cancelText }), resolveConfirm, AlertsStore

let listeners = [];
let idCounter = 1;
const toasts = [];

// kept for backward compatibility; no longer used when Swal is present
let confirmResolver = null;

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export function subscribe(cb) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((x) => x !== cb);
  };
}

export function removeToast(id) {
  const i = toasts.findIndex((t) => t.id === id);
  if (i !== -1) {
    toasts.splice(i, 1);
    notify();
  }
}

function pushToast({ type, message, duration = 3000 }) {
  const id = idCounter++;
  toasts.push({ id, type, message, duration });
  notify();
  if (duration && duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
  return id;
}

function hasSwal() {
  return typeof window !== "undefined" && !!window.Swal;
}

/* ---------------- Success / Error (SweetAlert2 toast, fallback to local) ---------------- */
export function showSuccess(message, opts = {}) {
  const duration = opts.duration ?? 3000;
  if (hasSwal()) {
    return window.Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: message || "Success",
      showConfirmButton: false,
      timer: duration,
      timerProgressBar: true,
    });
  }
  return pushToast({ type: "success", message, duration });
}

export function showError(message, opts = {}) {
  const duration = opts.duration ?? 3000;
  if (hasSwal()) {
    return window.Swal.fire({
      toast: true,
      position: "top-end",
      icon: "error",
      title: message || "Error",
      showConfirmButton: false,
      timer: duration,
      timerProgressBar: true,
    });
  }
  return pushToast({ type: "error", message, duration });
}

/* ---------------- Confirm (SweetAlert2 modal, fallback to local) ---------------- */
/**
 * Usage (unchanged):
 *   const ok = await confirmWarning({ title: "Delete this plot?", message: "This action cannot be undone." });
 *   if (!ok) return;
 */
export function confirmWarning({
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
} = {}) {
  // Sensible defaults so the dialog is never empty
  const _title = (title && String(title).trim()) || "Are you sure?";
  const _message = (message && String(message).trim()) || "Please confirm this action.";

  if (hasSwal()) {
    return window.Swal.fire({
      icon: "warning",
      title: _title,
      html: `<div style="font-size:14px;line-height:1.35">${_message}</div>`,
      showCancelButton: true,
      reverseButtons: true,
      focusCancel: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      width: 420,
      allowOutsideClick: false,
      allowEscapeKey: true,
    }).then((res) => !!res.isConfirmed);
  }

  // Fallback to legacy in-app confirm toast (kept for compatibility)
  return new Promise((resolve) => {
    confirmResolver = resolve;
    toasts.length = 0; // clear existing toasts
    toasts.push({
      id: "confirm",
      type: "confirm",
      title: _title,
      message: _message,
      confirmText,
      cancelText,
    });
    notify();
  });
}

/**
 * Back-compat for the old in-app confirm widget.
 * If SweetAlert2 is used, this is a no-op (never needed).
 */
export function resolveConfirm(ok) {
  if (confirmResolver) confirmResolver(ok);
  confirmResolver = null;
  toasts.length = 0;
  notify();
}

export const AlertsStore = { subscribe, removeToast };
