import { useEffect, useMemo, useRef, useState } from "react";
import { X, Edit3 } from "lucide-react";

export default function EditModal({
  open,
  title = "Edit Record",
  fields = [],
  record = null,
  submitLabel = "Update",
  onSubmit,
  onClose,
}) {
  const containerRef = useRef(null);

  const initialValues = useMemo(() => {
    const out = {};
    fields.forEach((f) => {
      if (record && typeof record[f.name] !== "undefined") {
        out[f.name] = record[f.name];
      } else if (typeof f.defaultValue !== "undefined") {
        out[f.name] = f.defaultValue;
      } else if (f.type === "switch" || f.type === "checkbox") {
        out[f.name] = false;
      } else {
        out[f.name] = "";
      }
    });
    return out;
  }, [fields, record]);

  const [values, setValues] = useState(initialValues);
  const [submitting, setSubmitting] = useState(false);

  // Track which fields are currently toggled into "edit" mode (used for passwords)
  const [editToggle, setEditToggle] = useState({}); // { [fieldName]: true|false }
  const toggleEdit = (name, next) =>
    setEditToggle((p) => ({ ...p, [name]: typeof next === "boolean" ? next : !p[name] }));

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      // reset edit toggles for fresh open
      const initToggles = {};
      fields.forEach((f) => {
        if (f.type === "password") initToggles[f.name] = false; // disabled by default
      });
      setEditToggle(initToggles);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open, initialValues, fields]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && open && onClose?.();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  if (!record) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200">
        <div className="w-full max-w-md animate-in zoom-in-95 duration-200">
          <div className="rounded-3xl bg-white shadow-2xl border border-gray-100 p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Edit3 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Record Selected</h3>
            <p className="text-gray-600 mb-6">Please select a record to edit.</p>
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors duration-200 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const set = (name, v) => setValues((prev) => ({ ...prev, [name]: v }));

  const handleBackdropClick = (e) => {
    if (e.target === containerRef.current) onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      // Build payload; omit password fields that are NOT toggled on
      const payload = { ...values };
      fields.forEach((f) => {
        if (f.type === "password" && !editToggle[f.name]) {
          delete payload[f.name];
        }
      });
      await onSubmit(payload, record);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (f, index) => {
    const common =
      "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-300 transition-all duration-200 text-gray-900 placeholder-gray-500";
    const labelCls = "block text-sm font-semibold text-gray-900 mb-2";
    const req = f.required ? (
      <span className="ml-1 text-rose-500" title="Required">
        *
      </span>
    ) : null;

    if (f.readOnly || f.disabled) {
      return (
        <div
          key={f.name}
          className="group"
          style={{ animationDelay: `${index * 100}ms`, animation: "slideInUp 0.5s ease-out forwards" }}
        >
          <label className={labelCls}>
            {f.label}
            <span className="ml-2 text-xs text-gray-500">(read-only)</span>
          </label>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-sm text-gray-600 font-medium flex-1 truncate">
              {values[f.name] || "Not set"}
            </span>
          </div>
        </div>
      );
    }

    switch (f.type) {
      case "select":
        return (
          <div
            key={f.name}
            className="group"
            style={{ animationDelay: `${index * 100}ms`, animation: "slideInUp 0.5s ease-out forwards" }}
          >
            <label className={labelCls}>
              {f.label}
              {req}
            </label>
            <div className="relative">
              <select
                className={`${common} appearance-none bg-white cursor-pointer`}
                value={values[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
                required={!!f.required}
              >
                <option value="" disabled>
                  {f.placeholder || "Select an option..."}
                </option>
                {(f.options || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label ?? opt.value}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        );

      case "textarea":
        return (
          <div
            key={f.name}
            className="group"
            style={{ animationDelay: `${index * 100}ms`, animation: "slideInUp 0.5s ease-out forwards" }}
          >
            <label className={labelCls}>
              {f.label}
              {req}
            </label>
            <textarea
              className={`${common} min-h-[120px] resize-vertical`}
              placeholder={f.placeholder || "Enter your text here..."}
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              required={!!f.required}
            />
          </div>
        );

      case "switch":
      case "checkbox":
        return (
          <div
            key={f.name}
            className="group col-span-2"
            style={{ animationDelay: `${index * 100}ms`, animation: "slideInUp 0.5s ease-out forwards" }}
          >
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors duration-200">
              <div className="relative">
                <input
                  id={`edit-field-${f.name}`}
                  type="checkbox"
                  className="sr-only"
                  checked={!!values[f.name]}
                  onChange={(e) => set(f.name, e.target.checked)}
                />
                <div
                  className={`w-6 h-6 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                    values[f.name] ? "bg-emerald-500 border-emerald-500" : "bg-white border-gray-300 hover:border-emerald-300"
                  }`}
                  onClick={() => set(f.name, !values[f.name])}
                >
                  {values[f.name] && (
                    <svg className="w-4 h-4 text-white absolute top-0.5 left-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <label htmlFor={`edit-field-${f.name}`} className="text-sm font-medium text-gray-900 cursor-pointer">
                {f.label}
                {req}
              </label>
            </div>
          </div>
        );

      case "number":
        return (
          <div
            key={f.name}
            className="group"
            style={{ animationDelay: `${index * 100}ms`, animation: "slideInUp 0.5s ease-out forwards" }}
          >
            <label className={labelCls}>
              {f.label}
              {req}
            </label>
            <input
              type="number"
              className={common}
              placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}...`}
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              required={!!f.required}
              min={f.min}
              max={f.max}
              step={f.step}
            />
          </div>
        );

      case "email":
        return (
          <div
            key={f.name}
            className="group"
            style={{ animationDelay: `${index * 100}ms`, animation: "slideInUp 0.5s ease-out forwards" }}
          >
            <label className={labelCls}>
              {f.label}
              {req}
            </label>
            <input
              type="email"
              className={common}
              placeholder={f.placeholder || "Enter email address..."}
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              required={!!f.required}
            />
          </div>
        );

      case "password": {
        const isEditing = !!editToggle[f.name]; // false by default
        return (
          <div
            key={f.name}
            className="group"
            style={{ animationDelay: `${index * 100}ms`, animation: "slideInUp 0.5s ease-out forwards" }}
          >
            <label className={labelCls}>
              {f.label}
              {isEditing && req}
            </label>
            <div className="flex gap-3">
              <input
                type="password"
                className={`${common} ${!isEditing ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`}
                placeholder={
                  isEditing
                    ? f.placeholder || "Enter new password..."
                    : "Current password unchanged"
                }
                value={values[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
                disabled={!isEditing}
                required={!!f.required && isEditing}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => {
                  const next = !isEditing;
                  toggleEdit(f.name, next);
                  if (!next) {
                    // Turning OFF edit mode: clear any typed value
                    set(f.name, "");
                  }
                }}
                className={`shrink-0 px-4 py-2.5 rounded-xl font-medium transition-colors duration-200 ${
                  isEditing
                    ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
                title={isEditing ? "Keep existing password" : "Change Password"}
              >
                {isEditing ? "Keep Current" : "Change Password"}
              </button>
            </div>
            {!isEditing && (
              <p className="mt-2 text-xs text-gray-500">
                Password will remain unchanged unless you click <span className="font-medium">Change Password</span>.
              </p>
            )}
          </div>
        );
      }

      default:
        return (
          <div
            key={f.name}
            className="group"
            style={{ animationDelay: `${index * 100}ms`, animation: "slideInUp 0.5s ease-out forwards" }}
          >
            <label className={labelCls}>
              {f.label}
              {req}
            </label>
            <input
              type={f.type || "text"}
              className={common}
              placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}...`}
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              required={!!f.required}
            />
          </div>
        );
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-300"
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-3xl max-h-[90vh] animate-in zoom-in-95 duration-300">
        <div className="rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
          {/* Gradient Header */}
          <div className="relative bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">{title}</h3>
                  <p className="text-emerald-100 text-sm">
                    {record?.first_name && record?.last_name
                      ? `Editing ${record.first_name} ${record.last_name}`
                      : record?.username
                      ? `Editing ${record.username}`
                      : record?.email
                      ? `Editing ${record.email}`
                      : "Update the information below"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors duration-200"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-10 -translate-x-10"></div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-8 py-6">
            <div className="max-h-[50vh] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{fields.map(renderField)}</div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-4 border-t border-gray-100 pt-6 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors duration-200 font-medium"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200 font-medium shadow-lg shadow-emerald-600/25 flex items-center gap-2 min-w-[120px] justify-center"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4" />
                    {submitLabel}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style >{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes zoom-in-95 {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-in {
          animation-fill-mode: both;
        }

        .fade-in {
          animation: fade-in var(--duration, 300ms) ease-out;
        }

        .zoom-in-95 {
          animation: zoom-in-95 var(--duration, 300ms) ease-out;
        }
      `}</style>
    </div>
  );
}
